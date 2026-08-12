function taskLabel(sub) {
  const t = sub.taskTitle;
  if (t && typeof t === "object") return t[Lang.current] || t.kk || t.en || sub.taskId;
  return sub.taskId || "—";
}

function studentName(username) {
  const u = (window.USERS_PUBLIC || []).find((x) => x.username === username);
  if (!u) return username;
  return Auth.displayName(u);
}

function statusPill(sub) {
  if (sub.status === "auto") return `<span class="status-pill done">${Lang.t("status_auto")}</span>`;
  if (sub.status === "ai_marked") return `<span class="status-pill done">${Lang.t("status_ai")}</span>`;
  if (sub.status === "marked") return `<span class="status-pill done">${Lang.t("status_marked")}</span>`;
  return `<span class="status-pill pending">${Lang.t("status_pending")}</span>`;
}

function scoreText(sub) {
  if (sub.status === "marked" && sub.teacherScore != null) {
    return `${sub.teacherScore} / ${sub.maxScore}`;
  }
  if (sub.score != null) return `${sub.score} / ${sub.maxScore}`;
  return `— / ${sub.maxScore}`;
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

async function bootTeacher() {
  const user = Auth.require("teacher");
  if (!user) return;
  mountAppNav("teacher");
  await Storage.init();
  ensureStorageBanner(document.getElementById("storage-banner-host"));

  const list = await Storage.listSubmissions();
  // only student work
  const filtered = list.filter((s) => s.role !== "teacher" || s.username !== user.username);
  // Prefer showing all non-empty; show student submissions (all submissions from students)
  const students = Auth.listStudents().map((s) => s.username);
  const studentSubs = list.filter((s) => students.includes(s.username));

  window.__teacherList = studentSubs;
  renderTeacherTable(studentSubs);

  window.addEventListener("langchange", () => renderTeacherTable(window.__teacherList || []));
}

function renderTeacherTable(list) {
  const root = document.getElementById("teacher-root");
  if (!list.length) {
    root.innerHTML = `<div class="empty-state"><div class="big">📭</div><p data-i18n="no_submissions">Әзірге жіберілген жұмыс жоқ.</p></div>`;
    Lang.apply();
    return;
  }

  root.innerHTML = `
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th data-i18n="th_student">Оқушы</th>
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
              <td><strong>${escapeHtml(studentName(s.username))}</strong><br/><span style="color:var(--text-dim);font-size:0.8rem">${escapeHtml(s.username)}</span></td>
              <td>${escapeHtml(taskLabel(s))} <span style="color:var(--text-dim);font-size:0.8rem">(${s.type})</span></td>
              <td>${scoreText(s)}</td>
              <td>${statusPill(s)}</td>
              <td>${formatDate(s.createdAt)}</td>
              <td class="actions-cell">
                <a class="btn btn-ghost btn-sm" href="submission.html?id=${encodeURIComponent(s.id)}">${Lang.t("view")}</a>
                <button type="button" class="btn btn-danger btn-sm btn-delete-attempt" data-id="${escapeHtml(s.id)}" data-label="${escapeHtml(taskLabel(s) + " · " + s.username)}">${Lang.t("delete")}</button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
  Lang.apply();

  root.querySelectorAll(".btn-delete-attempt").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const label = btn.dataset.label || id;
      const msg =
        Lang.current === "kk"
          ? `Бұл талпынысты жоясыз ба?\n${label}\n\nБұл әрекетті қайтаруға болмайды.`
          : `Delete this attempt?\n${label}\n\nThis cannot be undone.`;
      if (!confirm(msg)) return;
      btn.disabled = true;
      try {
        await Storage.deleteSubmission(id);
        window.__teacherList = (window.__teacherList || []).filter((x) => x.id !== id);
        renderTeacherTable(window.__teacherList);
      } catch (e) {
        console.error(e);
        alert(Lang.t("delete_failed"));
        btn.disabled = false;
      }
    });
  });
}

window.bootTeacher = bootTeacher;
