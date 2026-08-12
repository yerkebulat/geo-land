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
              <th>${t("open_category")}</th>
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
                  <td>${OpenCategories.icon(s.category)} ${escapeHtml(OpenCategories.label(s.category))}</td>
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
      const id = btn.dataset.id;
      const row = mine.find((s) => s.id === id);
      const label = row ? row.title : id;
      const msg =
        Lang.current === "kk"
          ? `Жинақты толығымен жоясыз ба?\n«${label}»\n\nБарлық сұрақтар өшеді. Қайтаруға болмайды.`
          : `Delete this entire set?\n«${label}»\n\nAll questions in it will be removed. This cannot be undone.`;
      if (!confirm(msg)) return;
      btn.disabled = true;
      try {
        await OpenSets.delete(id);
        await renderList(user);
      } catch (e) {
        console.error(e);
        alert(t("delete_failed"));
        btn.disabled = false;
      }
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

  // single = 1 question quick submit; patch = multi-question pack
  const isNew = !set;
  const state = {
    id: set ? set.id : OpenSets._uid("os"),
    title: set ? set.title : "",
    description: set ? set.description || "" : "",
    category: set ? set.category || "mixed" : "mixed",
    mode: set && set.questions && set.questions.length > 1 ? "patch" : "single",
    published: set ? !!set.published : true,
    createdAt: set ? set.createdAt : null,
    createdBy: set ? set.createdBy : user.username,
    questions: set && set.questions && set.questions.length
      ? set.questions.map((q) => ({ ...q }))
      : [emptyQuestion()],
  };

  function paint() {
    // single mode keeps only first question visible for editing simplicity
    if (state.mode === "single" && state.questions.length > 1) {
      // keep all in state when switching from patch; show all if already multi on edit
    }

    const modeSingleOn = state.mode === "single" ? " is-on" : "";
    const modePatchOn = state.mode === "patch" ? " is-on" : "";

    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${set ? t("open_edit_title") : t("open_create_new")}</h1>
          <p data-i18n="open_edit_lead">${t("open_edit_lead")}</p>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">
          <a href="teacher-open.html" class="btn btn-ghost btn-sm">${t("back")}</a>
          ${
            set
              ? `<button type="button" class="btn btn-danger btn-sm" id="btn-delete-whole-set">${t(
                  "open_delete_set"
                )}</button>`
              : ""
          }
        </div>
      </div>

      <div class="card" style="margin-bottom:1rem">
        <div class="form-group">
          <label>${t("open_submit_mode")}</label>
          <div class="mode-row">
            <button type="button" class="mode-chip${modeSingleOn}" id="mode-single">${t(
      "open_mode_single"
    )}</button>
            <button type="button" class="mode-chip${modePatchOn}" id="mode-patch">${t(
      "open_mode_patch"
    )}</button>
          </div>
          <p class="meta" style="margin-top:0.4rem">${
            state.mode === "single" ? t("open_mode_single_hint") : t("open_mode_patch_hint")
          }</p>
        </div>

        <div class="form-group">
          <label>${t("open_category")}</label>
          <div class="cat-chip-row" id="cat-chips">${OpenCategories.chipsHtml(state.category)}</div>
          <input type="hidden" id="set-category" value="${escapeHtml(state.category)}" />
        </div>

        <div class="form-group">
          <label>${t("open_set_title")} ${
      state.mode === "single"
        ? `<span style="font-weight:400;color:var(--text-dim)">(${t("optional")})</span>`
        : ""
    }</label>
          <input id="set-title" type="text" value="${escapeHtml(state.title)}" placeholder="${
      state.mode === "single" ? t("open_title_auto") : ""
    }" />
        </div>
        <div class="form-group" ${state.mode === "single" ? 'style="display:none"' : ""}>
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
        <button type="button" class="btn btn-ghost" id="btn-add-q" ${
          state.mode === "single" ? "hidden" : ""
        }>${t("open_add_question")}</button>
        <button type="button" class="btn btn-primary" id="btn-save-set">${
          state.mode === "single" ? t("open_submit_one") : t("save")
        }</button>
      </div>
      <p id="save-status" style="color:var(--text-muted);font-size:0.88rem;margin-top:0.75rem"></p>
    `;

    const qList = document.getElementById("q-list");
    const visibleQs =
      state.mode === "single" ? state.questions.slice(0, 1) : state.questions;
    visibleQs.forEach((q, i) => {
      const card = document.createElement("div");
      card.className = "question-card";
      const canRemoveOne = state.questions.length > 1 || state.mode === "patch";
      card.innerHTML = `
        <div class="q-num" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem">
          <span>${state.mode === "single" ? t("open_one_question") : "#" + (i + 1)}</span>
          <button type="button" class="btn btn-danger btn-sm btn-rm-q" data-i="${i}" title="${t(
        "open_delete_question"
      )}">${t("open_delete_question")}</button>
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

    document.getElementById("mode-single").onclick = () => {
      state.mode = "single";
      if (!state.questions.length) state.questions = [emptyQuestion()];
      paint();
    };
    document.getElementById("mode-patch").onclick = () => {
      state.mode = "patch";
      paint();
    };

    root.querySelectorAll(".cat-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.category = btn.dataset.cat;
        paint();
      });
    });

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
      btn.addEventListener("click", async () => {
        const i = Number(btn.dataset.i);
        // Sync DOM into state first
        root.querySelectorAll(".q-text-in").forEach((el) => {
          state.questions[Number(el.dataset.i)].text = el.value;
        });

        if (state.questions.length <= 1) {
          // Only one question left → deleting it means delete whole set (if saved) or reset form
          if (set) {
            const msg =
              Lang.current === "kk"
                ? "Бұл жинақта бір ғана сұрақ қалды. Жинақты толығымен жоясыз ба?"
                : "This set has only one question. Delete the entire set?";
            if (!confirm(msg)) return;
            try {
              await OpenSets.delete(state.id);
              window.location.href = "teacher-open.html";
            } catch (e) {
              console.error(e);
              alert(t("delete_failed"));
            }
          } else {
            if (!confirm(t("open_delete_question_confirm"))) return;
            state.questions = [emptyQuestion()];
            state.title = "";
            paint();
          }
          return;
        }

        if (!confirm(t("open_delete_question_confirm"))) return;
        state.questions.splice(i, 1);
        if (state.questions.length === 1) state.mode = "single";

        // Auto-save if editing an existing set so deletion sticks immediately
        if (set) {
          try {
            const title =
              document.getElementById("set-title").value.trim() ||
              state.title ||
              "Open set";
            const descEl = document.getElementById("set-desc");
            await OpenSets.save(
              {
                id: state.id,
                title,
                description: descEl ? descEl.value : state.description,
                category: state.category,
                published: document.getElementById("set-published").checked,
                createdAt: state.createdAt,
                createdBy: state.createdBy,
                questions: state.questions,
              },
              user.username
            );
            const st = document.getElementById("save-status");
            if (st) st.textContent = t("open_question_deleted_saved");
          } catch (e) {
            console.error(e);
            alert(t("delete_failed"));
          }
        }
        paint();
      });
    });

    const delWhole = document.getElementById("btn-delete-whole-set");
    if (delWhole) {
      delWhole.onclick = async () => {
        const label = state.title || state.id;
        const msg =
          Lang.current === "kk"
            ? `Жинақты толығымен жоясыз ба?\n«${label}»\n\nБарлық сұрақтар өшеді.`
            : `Delete this entire set?\n«${label}»\n\nAll questions will be removed.`;
        if (!confirm(msg)) return;
        delWhole.disabled = true;
        try {
          await OpenSets.delete(state.id);
          window.location.href = "teacher-open.html";
        } catch (e) {
          console.error(e);
          alert(t("delete_failed"));
          delWhole.disabled = false;
        }
      };
    }

    const addBtn = document.getElementById("btn-add-q");
    if (addBtn) {
      addBtn.onclick = () => {
        state.mode = "patch";
        state.questions.push(emptyQuestion());
        paint();
      };
    }

    document.getElementById("btn-save-set").onclick = async () => {
      const status = document.getElementById("save-status");
      // sync latest text from DOM before save
      root.querySelectorAll(".q-text-in").forEach((el) => {
        state.questions[Number(el.dataset.i)].text = el.value;
      });
      root.querySelectorAll(".q-pts-in").forEach((el) => {
        state.questions[Number(el.dataset.i)].points = Number(el.value) || 1;
      });
      root.querySelectorAll(".q-model-in").forEach((el) => {
        state.questions[Number(el.dataset.i)].modelAnswer = el.value;
      });
      root.querySelectorAll(".q-url-in").forEach((el) => {
        state.questions[Number(el.dataset.i)].imageUrl = el.value.trim();
      });

      let qs = state.questions;
      if (state.mode === "single") qs = state.questions.slice(0, 1);

      const emptyQ = qs.some((q) => !String(q.text || "").trim());
      if (emptyQ) {
        alert(t("open_q_required"));
        return;
      }

      let title = document.getElementById("set-title").value.trim();
      if (!title) {
        if (state.mode === "single") {
          const first = String(qs[0].text || "").trim();
          title = first.length > 60 ? first.slice(0, 57) + "…" : first;
        } else {
          alert(t("open_title_required"));
          return;
        }
      }

      const category = state.category || document.getElementById("set-category").value;
      if (!category || !OpenCategories.get(category)) {
        alert(t("open_category_required"));
        return;
      }

      status.textContent = t("saving");
      try {
        for (const q of qs) {
          const u = (q.imageUrl || "").trim();
          if (u && !/^https?:\/\//i.test(u)) {
            throw new Error("invalid_url");
          }
          q.imageUrl = u;
        }
        const descEl = document.getElementById("set-desc");
        const saved = await OpenSets.save(
          {
            id: state.id,
            title,
            description: descEl ? descEl.value : state.description,
            category,
            published: document.getElementById("set-published").checked,
            createdAt: state.createdAt,
            createdBy: state.createdBy,
            questions: qs,
          },
          user.username
        );
        state.category = category;
        state.questions = qs;
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
