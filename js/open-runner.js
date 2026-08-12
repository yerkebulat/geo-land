/* Open questions: free-text + Gemini draft grade + save */
function tField(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[Lang.current] || obj.kk || obj.en || "";
}

async function loadOpen(id) {
  // Prefer teacher-created sets in Firebase / local open_sets
  try {
    if (window.OpenSets) {
      const set = await OpenSets.get(id);
      if (set) {
        // students only take published (teacher may preview)
        const user = Auth.current();
        if (!set.published && !(user && user.role === "teacher")) {
          throw new Error("not_published");
        }
        return OpenSets.toTask(set);
      }
    }
  } catch (e) {
    if (e.message === "not_published") throw e;
  }
  const res = await fetch(`data/${id}.json`);
  if (!res.ok) throw new Error("not found");
  return res.json();
}

function renderOpen(task, state) {
  const root = document.getElementById("open-root");

  if (state.mode === "done") {
    const g = state.gradeResult;
    const aiOk = g && g.ok;
    const scoreLine =
      state.savedScore != null
        ? `${state.savedScore} / ${task.totalPoints}`
        : `— / ${task.totalPoints}`;

    let per = "";
    if (state.perQuestion && Object.keys(state.perQuestion).length) {
      per = task.questions
        .map((q, i) => {
          const d = state.perQuestion[q.id] || {};
          return `<div class="question-card">
            <div class="q-num">#${i + 1} · ${d.score != null ? d.score : "—"}/${q.points}</div>
            <div class="q-text" style="white-space:pre-wrap">${escapeHtml(tField(q.text))}</div>
            ${q.imageUrl ? `<div class="q-img-preview"><img src="${escapeHtml(q.imageUrl)}" alt="" /></div>` : ""}
            <div class="answer-row">
              <div class="label" data-i18n="your_answer">${Lang.t("your_answer")}</div>
              <div>${escapeHtml((state.answers[q.id] || "").trim() || Lang.t("empty_answer"))}</div>
            </div>
            ${
              d.feedback
                ? `<div class="answer-row"><div class="label" data-i18n="ai_feedback">${Lang.t(
                    "ai_feedback"
                  )}</div><div>${escapeHtml(d.feedback)}</div></div>`
                : ""
            }
          </div>`;
        })
        .join("");
    }

    root.innerHTML = `
      <div class="result-banner">
        <p data-i18n="result_title">Нәтиже</p>
        <div class="score">${escapeHtml(String(scoreLine.split(" / ")[0]))}<span> / ${
      task.totalPoints
    }</span></div>
        <p style="color:var(--text-muted);font-size:0.92rem;max-width:28rem;margin:0.5rem auto">
          ${
            aiOk
              ? escapeHtml(g.summary || Lang.t("open_ai_done"))
              : escapeHtml(Lang.t("open_ai_failed_saved"))
          }
        </p>
        <p style="margin-top:0.5rem;color:var(--teal);font-size:0.88rem" data-i18n="result_saved">${Lang.t(
          "result_saved"
        )}</p>
        <div class="quiz-actions" style="justify-content:center;border:none">
          <a href="history.html" class="btn btn-ghost" data-i18n="card_history">${Lang.t(
            "card_history"
          )}</a>
          <a href="app.html" class="btn btn-primary" data-i18n="to_dashboard">${Lang.t(
            "to_dashboard"
          )}</a>
        </div>
      </div>
      ${per}`;
    Lang.apply();
    return;
  }

  if (state.mode === "grading") {
    root.innerHTML = `
      <div class="result-banner">
        <p data-i18n="open_grading">AI бағалауда…</p>
        <p style="color:var(--text-muted);margin-top:0.75rem" data-i18n="open_grading_hint">${Lang.t(
          "open_grading_hint"
        )}</p>
      </div>`;
    Lang.apply();
    return;
  }

  const answered = task.questions.filter((q) => (state.answers[q.id] || "").trim()).length;

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${escapeHtml(tField(task.title))}</h1>
        <p>${escapeHtml(tField(task.description))}</p>
      </div>
      <a href="app.html" class="btn btn-ghost btn-sm" data-i18n="back">Артқа</a>
    </div>
    <p style="color:var(--text-muted);margin-bottom:1.15rem;max-width:42rem">${escapeHtml(
      tField(task.intro)
    )}</p>
    ${
      !GeminiGrader.isConfigured()
        ? `<div class="storage-banner" data-i18n="open_no_gemini">${Lang.t("open_no_gemini")}</div>`
        : ""
    }
    <div class="quiz-progress"><div class="quiz-progress-bar" style="width:${Math.round(
      (answered / task.questions.length) * 100
    )}%"></div></div>
    <div id="open-questions"></div>
    <div class="quiz-actions">
      <button type="button" class="btn btn-primary" id="btn-submit-open" data-i18n="submit">Жіберу</button>
    </div>
  `;

  const host = document.getElementById("open-questions");
  task.questions.forEach((q, i) => {
    const card = document.createElement("div");
    card.className = "question-card";
    card.innerHTML = `
      <div class="q-num">#${i + 1} · ${q.points || 1} ${Lang.t("points_short")}</div>
      <div class="q-text" style="white-space:pre-wrap">${escapeHtml(tField(q.text))}</div>
      ${
        q.imageUrl
          ? `<div class="q-img-preview"><img src="${escapeHtml(q.imageUrl)}" alt="" /></div>`
          : ""
      }
      <div class="calc-answer">
        <textarea data-qid="${q.id}" rows="4" placeholder="${
      Lang.current === "kk" ? "Жауабыңызды жазыңыз…" : "Write your answer…"
    }">${escapeHtml(state.answers[q.id] || "")}</textarea>
      </div>
    `;
    host.appendChild(card);
  });

  host.querySelectorAll("textarea").forEach((ta) => {
    ta.addEventListener("input", () => {
      state.answers[ta.dataset.qid] = ta.value;
    });
  });

  document.getElementById("btn-submit-open").addEventListener("click", () => submitOpen(task, state));
  Lang.apply();
}

async function submitOpen(task, state) {
  const user = Auth.current();
  if (!user) return;

  const empty = task.questions.filter((q) => !(state.answers[q.id] || "").trim()).length;
  if (empty > 0) {
    const msg =
      Lang.current === "kk"
        ? `${empty} сұрақ бос. Бәрібір жібересіз бе?`
        : `${empty} question(s) empty. Submit anyway?`;
    if (!confirm(msg)) return;
  }

  // freeze answers from DOM
  document.querySelectorAll("textarea[data-qid]").forEach((ta) => {
    state.answers[ta.dataset.qid] = ta.value;
  });

  state.mode = "grading";
  renderOpen(task, state);

  let gradeResult = { ok: false };
  if (GeminiGrader.isConfigured()) {
    gradeResult = await GeminiGrader.gradeOpenSet(task, state.answers, Lang.current);
  }

  let score = null;
  let status = "pending";
  let perQuestion = {};
  let details = { ai: null };

  if (gradeResult.ok) {
    score = gradeResult.totalScore;
    status = "ai_marked";
    perQuestion = gradeResult.perQuestion;
    details = {
      ai: {
        model: gradeResult.model,
        summary: gradeResult.summary,
        at: new Date().toISOString(),
      },
      perQuestion,
    };
  } else {
    status = "pending";
    details = { aiError: gradeResult.error || "none", perQuestion: {} };
  }

  await Storage.saveSubmission({
    username: user.username,
    role: user.role,
    type: "open",
    taskId: task.id,
    taskTitle: task.title,
    answers: state.answers,
    score,
    maxScore: task.totalPoints,
    status,
    details,
    teacherScore: null,
    teacherComment: "",
  });

  state.gradeResult = gradeResult;
  state.perQuestion = perQuestion;
  state.savedScore = score;
  state.mode = "done";
  renderOpen(task, state);
}

async function bootOpen() {
  const user = Auth.require();
  if (!user) return;
  mountAppNav("dash");
  await Storage.init();
  ensureStorageBanner(document.getElementById("storage-banner-host"));

  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "open-1";
  const root = document.getElementById("open-root");
  root.innerHTML = `<p class="empty-state" data-i18n="loading">Жүктелуде…</p>`;
  Lang.apply();

  try {
    const task = await loadOpen(id);
    const state = { answers: {}, mode: "take" };
    renderOpen(task, state);
    window.addEventListener("langchange", () => {
      document.querySelectorAll("textarea[data-qid]").forEach((ta) => {
        state.answers[ta.dataset.qid] = ta.value;
      });
      renderOpen(task, state);
    });
  } catch (e) {
    const msg =
      e && e.message === "not_published" ? Lang.t("open_not_published") : Lang.t("not_found");
    root.innerHTML = `<div class="empty-state"><div class="big">✍️</div><p>${escapeHtml(msg)}</p>
      <a href="app.html" class="btn btn-ghost" data-i18n="back">Артқа</a></div>`;
    Lang.apply();
  }
}

window.bootOpen = bootOpen;
