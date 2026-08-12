/* Teacher: create / edit / publish open question sets (teacher only) */

function t(key) {
  return Lang.t(key);
}

async function bootTeacherOpen() {
  const user = Auth.require("teacher");
  if (!user) return;
  if (user.username !== "nursultan.utebayev") {
    alert(Lang.t("open_create_forbidden"));
    window.location.href = "app.html";
    return;
  }
  mountAppNav("teacher-open");
  await Storage.init();

  const params = new URLSearchParams(location.search);
  const editId = params.get("id");
  const mode = params.get("mode") || (editId ? "edit" : "list");

  if (mode === "edit" || editId === "new" || params.get("new") === "1") {
    await renderEditor(user, editId === "new" || params.get("new") === "1" ? null : editId);
  } else {
    await renderList(user);
  }

  window.addEventListener("langchange", async () => {
    const p = new URLSearchParams(location.search);
    if (p.get("id") || p.get("new") === "1") {
      await renderEditor(user, p.get("new") === "1" || p.get("id") === "new" ? null : p.get("id"));
    } else {
      await renderList(user);
    }
  });
}

async function renderList(user) {
  const root = document.getElementById("teacher-open-root");
  root.innerHTML = `<p class="empty-state">${t("loading")}</p>`;
  const sets = await OpenSets.listAll();
  // only this teacher's sets
  const mine = sets.filter((s) => s.createdBy === user.username || !s.createdBy);

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1 data-i18n="open_manage_title">${t("open_manage_title")}</h1>
        <p data-i18n="open_manage_lead">${t("open_manage_lead")}</p>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <a href="app.html" class="btn btn-ghost btn-sm">${t("back")}</a>
        <a href="teacher-open.html?new=1" class="btn btn-primary btn-sm">${t("open_create_new")}</a>
      </div>
    </div>
    ${
      !mine.length
        ? `<div class="empty-state"><div class="big">✍️</div><p>${t("open_no_sets")}</p>
           <a href="teacher-open.html?new=1" class="btn btn-primary">${t("open_create_new")}</a></div>`
        : `<div class="table-wrap"><table class="data">
            <thead><tr>
              <th>${t("th_task")}</th>
              <th>${t("th_score")}</th>
              <th>${t("th_status")}</th>
              <th>${t("th_date")}</th>
              <th>${t("th_actions")}</th>
            </tr></thead>
            <tbody>
              ${mine
                .map(
                  (s) => `<tr>
                  <td><strong>${escapeHtml(s.title)}</strong><br/>
                    <span style="color:var(--text-dim);font-size:0.8rem">${s.questionCount || 0} ${t("q_of")}</span></td>
                  <td>${s.totalPoints || 0} ${t("points_short")}</td>
                  <td>${
                    s.published
                      ? `<span class="status-pill done">${t("open_published")}</span>`
                      : `<span class="status-pill pending">${t("open_draft")}</span>`
                  }</td>
                  <td>${formatDate(s.updatedAt)}</td>
                  <td class="actions-cell">
                    <a class="btn btn-ghost btn-sm" href="teacher-open.html?id=${encodeURIComponent(s.id)}">${t("edit")}</a>
                    <button type="button" class="btn btn-ghost btn-sm btn-toggle-pub" data-id="${escapeHtml(s.id)}" data-pub="${
                    s.published ? "1" : "0"
                  }">${s.published ? t("open_unpublish") : t("open_publish")}</button>
                    <a class="btn btn-ghost btn-sm" href="open.html?id=${encodeURIComponent(s.id)}" target="_blank">${t("view")}</a>
                    <button type="button" class="btn btn-danger btn-sm btn-del-set" data-id="${escapeHtml(s.id)}">${t("delete")}</button>
                  </td>
                </tr>`
                )
                .join("")}
            </tbody></table></div>`
    }
  `;
  Lang.apply();

  root.querySelectorAll(".btn-toggle-pub").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const pub = btn.dataset.pub !== "1";
      btn.disabled = true;
      await OpenSets.setPublished(id, pub);
      renderList(user);
    });
  });
  root.querySelectorAll(".btn-del-set").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(t("open_delete_set_confirm"))) return;
      await OpenSets.delete(btn.dataset.id);
      renderList(user);
    });
  });
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

function emptyQuestion() {
  return {
    id: OpenSets._uid("oq"),
    text: "",
    points: 1,
    imageUrl: "",
    modelAnswer: "",
  };
}

async function renderEditor(user, setId) {
  const root = document.getElementById("teacher-open-root");
  root.innerHTML = `<p class="empty-state">${t("loading")}</p>`;

  let set = setId ? await OpenSets.get(setId) : null;
  if (setId && !set) {
    root.innerHTML = `<div class="empty-state"><p>${t("not_found")}</p><a href="teacher-open.html" class="btn btn-ghost">${t(
      "back"
    )}</a></div>`;
    return;
  }

  const state = {
    id: set ? set.id : OpenSets._uid("os"),
    title: set ? set.title : "",
    description: set ? set.description || "" : "",
    published: set ? !!set.published : false,
    createdAt: set ? set.createdAt : null,
    createdBy: set ? set.createdBy : user.username,
    questions: set && set.questions && set.questions.length
      ? set.questions.map((q) => ({ ...q }))
      : [emptyQuestion()],
  };

  function paint() {
    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${set ? t("open_edit_title") : t("open_create_new")}</h1>
          <p data-i18n="open_edit_lead">${t("open_edit_lead")}</p>
        </div>
        <a href="teacher-open.html" class="btn btn-ghost btn-sm">${t("back")}</a>
      </div>
      <div class="card" style="margin-bottom:1rem">
        <div class="form-group">
          <label>${t("open_set_title")}</label>
          <input id="set-title" type="text" value="${escapeHtml(state.title)}" />
        </div>
        <div class="form-group">
          <label>${t("open_set_desc")}</label>
          <textarea id="set-desc" rows="2">${escapeHtml(state.description)}</textarea>
        </div>
        <label class="check-row">
          <input type="checkbox" id="set-published" ${state.published ? "checked" : ""} />
          <span>${t("open_publish")}</span>
        </label>
      </div>
      <div id="q-list"></div>
      <div class="quiz-actions" style="justify-content:space-between">
        <button type="button" class="btn btn-ghost" id="btn-add-q">${t("open_add_question")}</button>
        <button type="button" class="btn btn-primary" id="btn-save-set">${t("save")}</button>
      </div>
      <p id="save-status" style="color:var(--text-muted);font-size:0.88rem;margin-top:0.75rem"></p>
    `;

    const qList = document.getElementById("q-list");
    state.questions.forEach((q, i) => {
      const card = document.createElement("div");
      card.className = "question-card";
      card.innerHTML = `
        <div class="q-num">#${i + 1}
          <button type="button" class="btn btn-danger btn-sm btn-rm-q" data-i="${i}" style="float:right">${t(
        "delete"
      )}</button>
        </div>
        <div class="form-group">
          <label>${t("open_q_text")}</label>
          <textarea class="q-text-in" data-i="${i}" rows="3">${escapeHtml(q.text || "")}</textarea>
        </div>
        <div class="form-group">
          <label>${t("open_q_points")}</label>
          <input class="q-pts-in" data-i="${i}" type="number" min="0.5" step="0.5" value="${q.points || 1}" style="max-width:8rem" />
        </div>
        <div class="form-group">
          <label>${t("open_q_image")}</label>
          <input class="q-url-in" data-i="${i}" type="url" placeholder="https://..." value="${escapeHtml(
        q.imageUrl || ""
      )}" />
          <p class="meta" style="margin-top:0.35rem">${t("open_q_image_hint")}</p>
          ${
            q.imageUrl && /^https?:\/\//i.test(q.imageUrl)
              ? `<div class="q-img-preview"><img src="${escapeHtml(q.imageUrl)}" alt="" /></div>`
              : ""
          }
        </div>
        <div class="form-group">
          <label>${t("open_q_model")} <span style="font-weight:400;color:var(--text-dim)">(${t(
        "optional"
      )})</span></label>
          <textarea class="q-model-in" data-i="${i}" rows="2" placeholder="${t(
        "open_q_model_hint"
      )}">${escapeHtml(q.modelAnswer || "")}</textarea>
        </div>
      `;
      qList.appendChild(card);
    });

    Lang.apply();

    root.querySelectorAll(".q-text-in").forEach((el) => {
      el.addEventListener("input", () => {
        state.questions[Number(el.dataset.i)].text = el.value;
      });
    });
    root.querySelectorAll(".q-pts-in").forEach((el) => {
      el.addEventListener("input", () => {
        state.questions[Number(el.dataset.i)].points = Number(el.value) || 1;
      });
    });
    root.querySelectorAll(".q-url-in").forEach((el) => {
      el.addEventListener("change", () => {
        const i = Number(el.dataset.i);
        state.questions[i].imageUrl = el.value.trim();
        paint();
      });
    });
    root.querySelectorAll(".q-model-in").forEach((el) => {
      el.addEventListener("input", () => {
        state.questions[Number(el.dataset.i)].modelAnswer = el.value;
      });
    });
    root.querySelectorAll(".btn-rm-q").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.i);
        if (state.questions.length <= 1) return;
        state.questions.splice(i, 1);
        paint();
      });
    });

    document.getElementById("btn-add-q").onclick = () => {
      state.questions.push(emptyQuestion());
      paint();
    };

    document.getElementById("btn-save-set").onclick = async () => {
      const status = document.getElementById("save-status");
      const title = document.getElementById("set-title").value.trim();
      if (!title) {
        alert(t("open_title_required"));
        return;
      }
      const emptyQ = state.questions.some((q) => !String(q.text || "").trim());
      if (emptyQ) {
        alert(t("open_q_required"));
        return;
      }
      status.textContent = t("saving");
      try {
        for (const q of state.questions) {
          const u = (q.imageUrl || "").trim();
          if (u && !/^https?:\/\//i.test(u)) {
            throw new Error("invalid_url");
          }
          q.imageUrl = u;
        }
        const saved = await OpenSets.save(
          {
            id: state.id,
            title,
            description: document.getElementById("set-desc").value,
            published: document.getElementById("set-published").checked,
            createdAt: state.createdAt,
            createdBy: state.createdBy,
            questions: state.questions,
          },
          user.username
        );
        status.textContent = t("saved_ok");
        state.id = saved.id;
        state.createdAt = saved.createdAt;
        history.replaceState({}, "", `teacher-open.html?id=${encodeURIComponent(saved.id)}`);
      } catch (e) {
        console.error(e);
        status.textContent = e.message === "invalid_url" ? t("open_invalid_url") : t("save_failed");
      }
    };
  }

  paint();
}

window.bootTeacherOpen = bootTeacherOpen;
