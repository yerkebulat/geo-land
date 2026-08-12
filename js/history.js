function taskLabel(sub) {
  const t = sub.taskTitle;
  if (t && typeof t === "object") return t[Lang.current] || t.kk || t.en || sub.taskId;
  return sub.taskId || "—";
}

function statusPill(sub) {
  if (sub.status === "auto") return `<span class="status-pill done" data-i18n="status_auto">Авто</span>`;
  if (sub.status === "ai_marked") return `<span class="status-pill done" data-i18n="status_ai">AI</span>`;
  if (sub.status === "marked") return `<span class="status-pill done" data-i18n="status_marked">Бағаланды</span>`;
  return `<span class="status-pill pending" data-i18n="status_pending">Тексеруде</span>`;
}

function scoreText(sub) {
  if (sub.status === "marked" && sub.teacherScore != null) {
    return `${sub.teacherScore} / ${sub.maxScore}`;
  }
  if (sub.score != null) return `${sub.score} / ${sub.maxScore}`;
  return `— / ${sub.maxScore || "—"}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(Lang.current === "kk" ? "kk-KZ" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

async function bootHistory() {
  const user = Auth.require();
  if (!user) return;
  mountAppNav("history");
  await Storage.init();
  ensureStorageBanner(document.getElementById("storage-banner-host"));

  const list = await Storage.listSubmissions({ username: user.username });
  renderHistory(list);

  window.addEventListener("langchange", () => renderHistory(list));
}

function renderHistory(list) {
  const root = document.getElementById("history-root");
  document.getElementById("page-title").textContent = Lang.t("card_history");

  if (!list.length) {
    root.innerHTML = `<div class="empty-state"><div class="big">📭</div><p data-i18n="no_submissions">Әзірге жіберілген жұмыс жоқ.</p>
      <a href="app.html" class="btn btn-primary" data-i18n="to_dashboard">Басты бетке</a></div>`;
    Lang.apply();
    return;
  }

  root.innerHTML = `
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th data-i18n="th_task">Тапсырма</th>
            <th data-i18n="th_score">Ұпай</th>
            <th data-i18n="th_status">Күйі</th>
            <th data-i18n="th_date">Күні</th>
            <th data-i18n="th_actions">Әрекет</th>
          </tr>
        </thead>
        <tbody>
          ${list
            .map(
              (s) => `<tr>
              <td>${escapeHtml(taskLabel(s))} <span style="color:var(--text-dim);font-size:0.8rem">(${s.type})</span></td>
              <td>${scoreText(s)}</td>
              <td>${statusPill(s)}</td>
              <td>${formatDate(s.createdAt)}</td>
              <td><a class="btn btn-ghost btn-sm" href="submission.html?id=${encodeURIComponent(s.id)}" data-i18n="view">Қарау</a></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
  Lang.apply();
}

window.bootHistory = bootHistory;
