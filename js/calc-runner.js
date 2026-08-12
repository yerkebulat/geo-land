/* Calculation set runner — free text, teacher grades */
async function loadCalc(id) {
  const res = await fetch(`data/${id}.json`);
  if (!res.ok) throw new Error("not found");
  return res.json();
}

function tField(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[Lang.current] || obj.kk || obj.en || "";
}

function renderCalc(calc, state) {
  const root = document.getElementById("calc-root");

  if (state.mode === "done") {
    root.innerHTML = `
      <div class="result-banner">
        <p data-i18n="result_title">Нәтиже</p>
        <div class="score" style="font-size:1.75rem">✓</div>
        <p style="color:var(--teal-bright)" data-i18n="calc_submit_ok">Есептер жіберілді.</p>
        <div class="quiz-actions" style="justify-content:center;border:none">
          <a href="history.html" class="btn btn-ghost" data-i18n="card_history">Менің нәтижелерім</a>
          <a href="app.html" class="btn btn-primary" data-i18n="to_dashboard">Басты бетке</a>
        </div>
      </div>`;
    Lang.apply();
    return;
  }

  const answered = calc.problems.filter((p) => (state.answers[p.id] || "").trim()).length;

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${escapeHtml(tField(calc.title))}</h1>
        <p>${escapeHtml(tField(calc.description))}</p>
      </div>
      <a href="app.html" class="btn btn-ghost btn-sm" data-i18n="back">Артқа</a>
    </div>
    <p style="color:var(--text-muted);margin-bottom:1.25rem;max-width:40rem">${escapeHtml(tField(calc.intro))}</p>
    <div class="quiz-progress"><div class="quiz-progress-bar" style="width:${Math.round((answered / calc.problems.length) * 100)}%"></div></div>
    <div id="problems"></div>
    <div class="quiz-actions">
      <button type="button" class="btn btn-primary" id="btn-submit-calc" data-i18n="submit">Жіберу</button>
    </div>
  `;

  const host = document.getElementById("problems");
  calc.problems.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "question-card";
    card.innerHTML = `
      <div class="q-num">#${i + 1} · ${p.points || 1} ${Lang.t("points_short")}</div>
      <div class="q-text">${escapeHtml(tField(p.text))}</div>
      <div class="calc-answer">
        <textarea data-pid="${p.id}" rows="2" placeholder="${Lang.current === "kk" ? "Жауабыңыз…" : "Your answer…"}">${escapeHtml(state.answers[p.id] || "")}</textarea>
      </div>
    `;
    host.appendChild(card);
  });

  host.querySelectorAll("textarea").forEach((ta) => {
    ta.addEventListener("input", () => {
      state.answers[ta.dataset.pid] = ta.value;
    });
  });

  document.getElementById("btn-submit-calc").addEventListener("click", () => submitCalc(calc, state));
  Lang.apply();
}

async function submitCalc(calc, state) {
  const user = Auth.current();
  if (!user) return;
  const empty = calc.problems.filter((p) => !(state.answers[p.id] || "").trim()).length;
  if (empty > 0) {
    const msg =
      Lang.current === "kk"
        ? `${empty} есеп бос. Бәрібір жібересіз бе?`
        : `${empty} problem(s) empty. Submit anyway?`;
    if (!confirm(msg)) return;
  }

  await Storage.saveSubmission({
    username: user.username,
    role: user.role,
    type: "calc",
    taskId: calc.id,
    taskTitle: calc.title,
    answers: state.answers,
    score: null,
    maxScore: calc.totalPoints,
    status: "pending",
    details: null,
  });

  state.mode = "done";
  renderCalc(calc, state);
}

async function bootCalc() {
  const user = Auth.require();
  if (!user) return;
  mountAppNav("dash");
  await Storage.init();
  ensureStorageBanner(document.getElementById("storage-banner-host"));

  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "calc-1";
  const root = document.getElementById("calc-root");
  root.innerHTML = `<p class="empty-state" data-i18n="loading">Жүктелуде…</p>`;
  Lang.apply();

  try {
    const calc = await loadCalc(id);
    const state = { answers: {}, mode: "take" };
    renderCalc(calc, state);
    window.addEventListener("langchange", () => {
      // preserve textarea values already in state
      calc.problems.forEach((p) => {
        const ta = document.querySelector(`textarea[data-pid="${p.id}"]`);
        if (ta) state.answers[p.id] = ta.value;
      });
      renderCalc(calc, state);
    });
  } catch {
    root.innerHTML = `<div class="empty-state"><div class="big">🧮</div><p data-i18n="not_found">Табылмады</p>
      <a href="app.html" class="btn btn-ghost" data-i18n="back">Артқа</a></div>`;
    Lang.apply();
  }
}

window.bootCalc = bootCalc;
