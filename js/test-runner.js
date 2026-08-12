/* Test runner: load, answer, auto-grade, save */
const LETTERS = ["A", "B", "C", "D", "E", "F"];

async function loadTest(id) {
  const res = await fetch(`data/${id}.json`);
  if (!res.ok) throw new Error("not found");
  return res.json();
}

function tField(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[Lang.current] || obj.kk || obj.en || "";
}

function renderTest(test, state) {
  const root = document.getElementById("test-root");
  const lang = Lang.current;
  const total = test.questions.length;
  const answered = Object.keys(state.answers).filter((k) => state.answers[k] != null).length;
  const pct = Math.round((answered / total) * 100);

  if (state.mode === "result") {
    root.innerHTML = renderResult(test, state);
    Lang.apply();
    bindResultActions(test, state);
    return;
  }

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${escapeHtml(tField(test.title))}</h1>
        <p>${escapeHtml(tField(test.description))}</p>
      </div>
      <a href="app.html" class="btn btn-ghost btn-sm" data-i18n="back">Артқа</a>
    </div>
    <div class="quiz-progress"><div class="quiz-progress-bar" style="width:${pct}%"></div></div>
    <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:1rem">
      <span data-i18n="answered">Жауап берілді</span>: <strong>${answered}</strong>
      <span data-i18n="of">/</span> ${total}
    </p>
    <div id="questions"></div>
    <div class="quiz-actions">
      <button type="button" class="btn btn-primary" id="btn-submit" data-i18n="submit">Жіберу</button>
    </div>
  `;

  const qHost = document.getElementById("questions");
  test.questions.forEach((q, i) => {
    const selected = state.answers[q.id];
    const card = document.createElement("div");
    card.className = "question-card";
    card.dataset.qid = q.id;

    let statementsHtml = "";
    if (q.statements) {
      const sts = q.statements[lang] || q.statements.kk || [];
      statementsHtml = `<ul class="q-statements">${sts.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`;
    }

    const opts = q.options[lang] || q.options.kk || [];
    const optionsHtml = opts
      .map((opt, oi) => {
        const sel = selected === oi ? "selected" : "";
        return `<button type="button" class="option ${sel}" data-qid="${q.id}" data-oi="${oi}">
          <span class="option-letter">${LETTERS[oi] || oi + 1}</span>
          <span>${escapeHtml(opt)}</span>
        </button>`;
      })
      .join("");

    card.innerHTML = `
      <div class="q-num">#${i + 1} · ${q.points || 1} ${Lang.t("points_short")}</div>
      <div class="q-text">${escapeHtml(tField(q.text))}</div>
      ${statementsHtml}
      <div class="options">${optionsHtml}</div>
    `;
    qHost.appendChild(card);
  });

  Lang.apply();

  root.querySelectorAll(".option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const qid = btn.dataset.qid;
      const oi = Number(btn.dataset.oi);
      state.answers[qid] = oi;
      renderTest(test, state);
      // scroll position roughly preserved by re-render — improve later if needed
    });
  });

  document.getElementById("btn-submit").addEventListener("click", () => submitTest(test, state));
}

function gradeTest(test, answers) {
  let score = 0;
  let correctCount = 0;
  const details = {};
  test.questions.forEach((q) => {
    const chosen = answers[q.id];
    const ok = chosen === q.correct;
    const pts = ok ? q.points || 1 : 0;
    if (ok) {
      score += pts;
      correctCount += 1;
    }
    details[q.id] = { chosen, correct: q.correct, ok, points: pts };
  });
  return { score, correctCount, maxScore: test.totalPoints, details };
}

async function submitTest(test, state) {
  const user = Auth.current();
  if (!user) return;
  const total = test.questions.length;
  const answered = Object.keys(state.answers).length;
  if (answered < total) {
    const msg =
      Lang.current === "kk"
        ? `Тек ${answered}/${total} сұраққа жауап берілді. Бәрібір жібересіз бе?`
        : `Only ${answered}/${total} answered. Submit anyway?`;
    if (!confirm(msg)) return;
  }

  const graded = gradeTest(test, state.answers);
  state.graded = graded;
  state.mode = "result";

  const sub = await Storage.saveSubmission({
    username: user.username,
    role: user.role,
    type: "test",
    taskId: test.id,
    taskTitle: test.title,
    answers: state.answers,
    score: graded.score,
    maxScore: graded.maxScore,
    status: "auto",
    details: graded.details,
  });
  state.submissionId = sub.id;
  renderTest(test, state);
}

function renderResult(test, state) {
  const g = state.graded;
  const lang = Lang.current;
  let review = "";

  if (state.showReview) {
    review = test.questions
      .map((q, i) => {
        const d = g.details[q.id] || {};
        const opts = q.options[lang] || q.options.kk || [];
        const optBtns = opts
          .map((opt, oi) => {
            let cls = "option";
            if (oi === q.correct) cls += " correct";
            if (d.chosen === oi && !d.ok) cls += " wrong";
            if (d.chosen === oi) cls += " selected";
            return `<div class="${cls}" style="cursor:default">
              <span class="option-letter">${LETTERS[oi]}</span>
              <span>${escapeHtml(opt)}</span>
            </div>`;
          })
          .join("");
        let statementsHtml = "";
        if (q.statements) {
          const sts = q.statements[lang] || q.statements.kk || [];
          statementsHtml = `<ul class="q-statements">${sts.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`;
        }
        return `<div class="question-card">
          <div class="q-num">#${i + 1} · ${d.ok ? "✓" : "✗"} · ${d.points || 0}/${q.points || 1}</div>
          <div class="q-text">${escapeHtml(tField(q.text))}</div>
          ${statementsHtml}
          <div class="options">${optBtns}</div>
        </div>`;
      })
      .join("");
  }

  return `
    <div class="result-banner">
      <p data-i18n="result_title">Нәтиже</p>
      <div class="score">${g.score}<span> / ${g.maxScore}</span></div>
      <p style="color:var(--text-muted)">${g.correctCount} <span data-i18n="result_correct">дұрыс</span>
        · ${test.questions.length} <span data-i18n="q_of">сұрақ</span></p>
      <p style="margin-top:0.75rem;color:var(--teal-bright);font-size:0.9rem" data-i18n="result_saved">Нәтиже сақталды.</p>
      <div class="quiz-actions" style="justify-content:center;border:none">
        <button type="button" class="btn btn-ghost" id="btn-review" data-i18n="review_answers">Жауаптарды қарау</button>
        <a href="test.html?id=${test.id}&retry=1" class="btn btn-primary" data-i18n="try_again">Қайта тапсыру</a>
        <a href="app.html" class="btn btn-teal" data-i18n="to_dashboard">Басты бетке</a>
      </div>
    </div>
    ${review}
  `;
}

function bindResultActions(test, state) {
  const btn = document.getElementById("btn-review");
  if (btn) {
    btn.addEventListener("click", () => {
      state.showReview = !state.showReview;
      renderTest(test, state);
    });
  }
}

async function bootTest() {
  const user = Auth.require();
  if (!user) return;
  mountAppNav("dash");
  await Storage.init();
  ensureStorageBanner(document.getElementById("storage-banner-host"));

  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "test-1";
  const root = document.getElementById("test-root");
  root.innerHTML = `<p class="empty-state" data-i18n="loading">Жүктелуде…</p>`;
  Lang.apply();

  try {
    const test = await loadTest(id);
    const state = { answers: {}, mode: "take", graded: null, showReview: false };
    renderTest(test, state);
    window.addEventListener("langchange", () => renderTest(test, state));
  } catch (e) {
    root.innerHTML = `<div class="empty-state"><div class="big">🗺️</div><p data-i18n="not_found">Табылмады</p>
      <a href="app.html" class="btn btn-ghost" data-i18n="back">Артқа</a></div>`;
    Lang.apply();
  }
}

window.bootTest = bootTest;
