/* View a single submission; teacher can grade calc sets */
const LETTERS = ["A", "B", "C", "D", "E", "F"];

function tField(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[Lang.current] || obj.kk || obj.en || "";
}

async function bootSubmission() {
  const user = Auth.require();
  if (!user) return;
  mountAppNav(user.role === "teacher" ? "teacher" : "history");
  await Storage.init();
  ensureStorageBanner(document.getElementById("storage-banner-host"));

  const id = new URLSearchParams(location.search).get("id");
  const root = document.getElementById("sub-root");
  if (!id) {
    root.innerHTML = `<div class="empty-state" data-i18n="not_found">Табылмады</div>`;
    Lang.apply();
    return;
  }

  const sub = await Storage.getSubmission(id);
  if (!sub) {
    root.innerHTML = `<div class="empty-state" data-i18n="not_found">Табылмады</div>`;
    Lang.apply();
    return;
  }

  // Access control: students only own; teacher all
  if (user.role !== "teacher" && sub.username !== user.username) {
    root.innerHTML = `<div class="empty-state" data-i18n="not_found">Табылмады</div>`;
    Lang.apply();
    return;
  }

  window.__sub = sub;
  await renderSubmission(sub, user);
  window.addEventListener("langchange", () => renderSubmission(window.__sub, user));
}

async function renderSubmission(sub, user) {
  const root = document.getElementById("sub-root");
  const backHref = user.role === "teacher" ? "teacher.html" : "history.html";
  const title = tField(sub.taskTitle) || sub.taskId;

  let body = "";
  if (sub.type === "test") {
    body = await renderTestSubmission(sub);
  } else if (sub.type === "calc") {
    body = await renderCalcSubmission(sub, user);
  } else if (sub.type === "open") {
    body = await renderOpenSubmission(sub, user);
  } else {
    body = `<pre>${escapeHtml(JSON.stringify(sub.answers, null, 2))}</pre>`;
  }

  const scoreLine =
    sub.status === "marked" && sub.teacherScore != null
      ? `${sub.teacherScore} / ${sub.maxScore}`
      : sub.score != null
        ? `${sub.score} / ${sub.maxScore}`
        : `— / ${sub.maxScore}`;

  const statusNote =
    sub.status === "ai_marked"
      ? `<br/><span style="color:var(--text-muted)">${Lang.t("status_ai")}</span>`
      : "";

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(sub.username)} · ${sub.type} · ${scoreLine}
          ${statusNote}
          ${sub.teacherComment ? `<br/><span style="color:var(--text-muted)">${Lang.t("teacher_comment")}: ${escapeHtml(sub.teacherComment)}</span>` : ""}
          ${
            sub.details && sub.details.ai && sub.details.ai.summary
              ? `<br/><span style="color:var(--text-muted)">${Lang.t("ai_summary")}: ${escapeHtml(
                  sub.details.ai.summary
                )}</span>`
              : ""
          }
        </p>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">
        <a href="${backHref}" class="btn btn-ghost btn-sm" data-i18n="back">Артқа</a>
        ${
          user.role === "teacher"
            ? `<button type="button" class="btn btn-danger btn-sm" id="btn-delete-sub" data-i18n="delete">${Lang.t(
                "delete"
              )}</button>`
            : ""
        }
      </div>
    </div>
    ${body}
  `;
  Lang.apply();

  if (user.role === "teacher") {
    const del = document.getElementById("btn-delete-sub");
    if (del) {
      del.addEventListener("click", async () => {
        const msg =
          Lang.current === "kk"
            ? "Бұл талпынысты жоясыз ба? Қайтаруға болмайды."
            : "Delete this attempt? This cannot be undone.";
        if (!confirm(msg)) return;
        del.disabled = true;
        try {
          await Storage.deleteSubmission(sub.id);
          window.location.href = "teacher.html";
        } catch (e) {
          console.error(e);
          alert(Lang.t("delete_failed"));
          del.disabled = false;
        }
      });
    }
  }

  if (user.role === "teacher" && (sub.type === "calc" || sub.type === "open")) {
    const form = document.getElementById("grade-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const score = Number(document.getElementById("grade-score").value);
        const comment = document.getElementById("grade-comment").value;
        if (Number.isNaN(score) || score < 0 || score > sub.maxScore) {
          alert(Lang.t("mark_score", { max: sub.maxScore }));
          return;
        }
        const updated = await Storage.updateSubmission(sub.id, {
          teacherScore: score,
          score: score,
          teacherComment: comment,
          status: "marked",
          gradedBy: user.username,
          gradedAt: new Date().toISOString(),
        });
        window.__sub =
          updated || {
            ...sub,
            teacherScore: score,
            score,
            teacherComment: comment,
            status: "marked",
          };
        alert(Lang.t("mark_saved"));
        renderSubmission(window.__sub, user);
      });
    }
  }
}

async function renderTestSubmission(sub) {
  let test = null;
  try {
    const res = await fetch(`data/${sub.taskId}.json`);
    if (res.ok) test = await res.json();
  } catch {}

  if (!test) {
    return `<div class="detail-panel"><pre>${escapeHtml(JSON.stringify(sub.answers, null, 2))}</pre></div>`;
  }

  const lang = Lang.current;
  return test.questions
    .map((q, i) => {
      const chosen = sub.answers[q.id];
      const d = (sub.details && sub.details[q.id]) || {};
      const opts = q.options[lang] || q.options.kk || [];
      const optHtml = opts
        .map((opt, oi) => {
          let cls = "option";
          if (oi === q.correct) cls += " correct";
          if (chosen === oi && chosen !== q.correct) cls += " wrong";
          if (chosen === oi) cls += " selected";
          return `<div class="${cls}" style="cursor:default">
            <span class="option-letter">${LETTERS[oi]}</span>
            <span>${escapeHtml(opt)}</span>
          </div>`;
        })
        .join("");
      return `<div class="question-card">
        <div class="q-num">#${i + 1} · ${d.ok ? "✓" : "✗"}</div>
        <div class="q-text">${escapeHtml(tField(q.text))}</div>
        <div class="options">${optHtml}</div>
      </div>`;
    })
    .join("");
}

async function renderCalcSubmission(sub, user) {
  let calc = null;
  try {
    const res = await fetch(`data/${sub.taskId}.json`);
    if (res.ok) calc = await res.json();
  } catch {}

  const problems = calc ? calc.problems : Object.keys(sub.answers).map((id) => ({ id, text: id, points: 1 }));

  let html = problems
    .map((p, i) => {
      const ans = sub.answers[p.id] || "";
      return `<div class="question-card">
        <div class="q-num">#${i + 1}</div>
        <div class="q-text">${escapeHtml(tField(p.text) || p.id)}</div>
        <div class="answer-row">
          <div class="label" data-i18n="student_answer">${Lang.t("student_answer")}</div>
          <div>${escapeHtml(ans || Lang.t("empty_answer"))}</div>
        </div>
      </div>`;
    })
    .join("");

  if (user.role === "teacher") {
    html += teacherGradeForm(sub);
  }

  return html;
}

async function renderOpenSubmission(sub, user) {
  let task = null;
  try {
    const res = await fetch(`data/${sub.taskId}.json`);
    if (res.ok) task = await res.json();
  } catch {}

  const per =
    (sub.details && sub.details.perQuestion) ||
    (sub.details && sub.details.ai && sub.details.perQuestion) ||
    {};
  const questions = task
    ? task.questions
    : Object.keys(sub.answers || {}).map((id) => ({ id, text: id, points: 1 }));

  let html = questions
    .map((q, i) => {
      const ans = (sub.answers && sub.answers[q.id]) || "";
      const d = per[q.id] || {};
      const scoreBit =
        d.score != null
          ? `<span class="q-num" style="float:right">AI: ${d.score}/${d.max != null ? d.max : q.points || 1}</span>`
          : "";
      return `<div class="question-card">
        <div class="q-num">#${i + 1} · ${q.points || 1} ${Lang.t("points_short")}${scoreBit}</div>
        <div class="q-text" style="white-space:pre-wrap">${escapeHtml(tField(q.text) || q.id)}</div>
        <div class="answer-row">
          <div class="label">${Lang.t("student_answer")}</div>
          <div style="white-space:pre-wrap">${escapeHtml(ans || Lang.t("empty_answer"))}</div>
        </div>
        ${
          d.feedback
            ? `<div class="answer-row"><div class="label">${Lang.t(
                "ai_feedback"
              )}</div><div>${escapeHtml(d.feedback)}</div></div>`
            : ""
        }
        ${
          task && q.modelAnswer && user.role === "teacher"
            ? `<div class="answer-row"><div class="label">${Lang.t(
                "model_answer"
              )}</div><div style="white-space:pre-wrap;color:var(--text-muted)">${escapeHtml(
                tField(q.modelAnswer)
              )}</div></div>`
            : ""
        }
      </div>`;
    })
    .join("");

  if (user.role === "teacher") {
    html += teacherGradeForm(sub);
  }

  return html;
}

function teacherGradeForm(sub) {
  const current =
    sub.teacherScore != null ? sub.teacherScore : sub.score != null ? sub.score : "";
  return `
      <div class="detail-panel">
        <h3 data-i18n="mark">${Lang.t("mark")}</h3>
        <p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:0.75rem">${Lang.t(
          "mark_override_hint"
        )}</p>
        <form id="grade-form">
          <div class="mark-row">
            <div class="form-group">
              <label for="grade-score">${Lang.t("mark_score", { max: sub.maxScore })}</label>
              <input id="grade-score" type="number" min="0" max="${sub.maxScore}" step="0.5" value="${current}" required />
            </div>
            <div class="form-group" style="flex:2">
              <label for="grade-comment" data-i18n="mark_comment">${Lang.t("mark_comment")}</label>
              <input id="grade-comment" type="text" value="${escapeHtml(sub.teacherComment || "")}" />
            </div>
            <button type="submit" class="btn btn-primary" data-i18n="mark_save">${Lang.t("mark_save")}</button>
          </div>
        </form>
      </div>`;
}

window.bootSubmission = bootSubmission;
