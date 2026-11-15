/* Teacher: manage student accounts (server-side, via geo-land-accounts Worker) */
(function () {
  const t = (k, v) => Lang.t(k, v);
  const ERR = {
    network: "err_network",
    unauthorized: "session_expired",
    bad_login: "err_bad_login",
    exists: "err_exists",
    weak_password: "err_weak_password",
    name_required: "err_name_required",
    wrong_password: "err_wrong_password",
  };
  const errText = (res) => t(ERR[(res.data && res.data.error) || ""] || (res.status === 0 ? "err_network" : "err_generic"));

  function genPassword() {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    const a = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(a, (x) => chars[x % chars.length]).join("");
  }

  let users = [];
  let me = null;

  function rowHtml(u) {
    const isMe = me && u.username === me.username;
    const name = escapeHtml(u.name && u.name.kk ? u.name.kk : u.username);
    const en = u.name && u.name.en ? `<div class="acc-sub">${escapeHtml(u.name.en)}</div>` : "";
    const role =
      u.role === "teacher"
        ? `<span class="badge badge-teacher" data-i18n="role_teacher">${t("role_teacher")}</span>`
        : `<span class="badge badge-student" data-i18n="role_student">${t("role_student")}</span>`;
    const acts = [
      `<button type="button" class="btn btn-ghost btn-sm" data-act="name" data-u="${escapeHtml(u.username)}" data-i18n="acc_edit_name">${t("acc_edit_name")}</button>`,
    ];
    if (u.role === "student") {
      acts.push(
        `<button type="button" class="btn btn-ghost btn-sm" data-act="pw" data-u="${escapeHtml(u.username)}" data-i18n="acc_change_pw">${t("acc_change_pw")}</button>`,
        `<button type="button" class="btn btn-danger btn-sm" data-act="del" data-u="${escapeHtml(u.username)}" data-i18n="delete">${t("delete")}</button>`
      );
    }
    return `<tr>
      <td><strong>${name}</strong>${isMe ? ` <span class="acc-sub" data-i18n="acc_you">${t("acc_you")}</span>` : ""}${en}</td>
      <td><code>${escapeHtml(u.username)}</code></td>
      <td>${role}</td>
      <td><div class="acc-actions">${acts.join("")}</div></td>
    </tr>`;
  }

  function renderList() {
    const host = document.getElementById("acc-list");
    if (!host) return;
    const n = users.filter((u) => u.role === "student").length;
    document.getElementById("acc-count").textContent = t("acc_count", { n });
    host.innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr>
        <th data-i18n="acc_col_name">${t("acc_col_name")}</th>
        <th data-i18n="acc_login">${t("acc_login")}</th>
        <th data-i18n="acc_col_role">${t("acc_col_role")}</th>
        <th data-i18n="th_actions">${t("th_actions")}</th>
      </tr></thead>
      <tbody>${users.map(rowHtml).join("")}</tbody></table></div>`;
  }

  async function load() {
    const host = document.getElementById("acc-list");
    host.innerHTML = `<p class="acc-msg" data-i18n="loading">${t("loading")}</p>`;
    const res = await Auth.api("GET", "/admin/users");
    if (!res.ok) {
      host.innerHTML = `<p class="acc-msg is-error">${escapeHtml(errText(res))}</p>`;
      return;
    }
    users = res.data.users || [];
    window.__accountList = users;
    window.dispatchEvent(new CustomEvent("accountsloaded"));
    renderList();
  }

  /* ——— Small modal (one or two fields) ——— */
  function openDialog({ title, hint, fields, submitKey, onSubmit }) {
    const ov = document.getElementById("acc-modal");
    ov.querySelector("h2").textContent = title;
    ov.querySelector(".hint").textContent = hint || "";
    ov.querySelector(".hint").hidden = !hint;
    const fwrap = ov.querySelector(".acc-fields");
    fwrap.innerHTML = fields
      .map(
        (f, i) => `<div class="form-group">
          <label for="acc-f${i}">${escapeHtml(f.label)}</label>
          <div class="acc-input-row">
            <input id="acc-f${i}" type="${f.type || "text"}" value="${escapeHtml(f.value || "")}" autocomplete="off" ${f.type === "password" ? 'autocomplete="new-password"' : ""} />
            ${f.gen ? `<button type="button" class="btn btn-ghost btn-sm" data-gen="${i}">${escapeHtml(t("acc_generate"))}</button>` : ""}
          </div>
          ${f.help ? `<p class="acc-help">${escapeHtml(f.help)}</p>` : ""}
        </div>`
      )
      .join("");
    fwrap.querySelectorAll("[data-gen]").forEach((b) =>
      b.addEventListener("click", () => {
        const inp = document.getElementById("acc-f" + b.dataset.gen);
        inp.type = "text";
        inp.value = genPassword();
      })
    );
    const err = ov.querySelector(".form-error");
    err.textContent = "";
    const submit = ov.querySelector('button[type="submit"]');
    submit.textContent = t(submitKey || "save");
    const form = ov.querySelector("form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const vals = fields.map((_, i) => document.getElementById("acc-f" + i).value);
      submit.disabled = true;
      const msg = await onSubmit(vals);
      submit.disabled = false;
      if (msg) err.textContent = msg;
      else close();
    };
    const close = () => ov.classList.remove("open");
    ov.querySelector(".modal-close").onclick = close;
    ov.querySelector("[data-cancel]").onclick = close;
    ov.onclick = (e) => {
      if (e.target === ov) close();
    };
    ov.classList.add("open");
    setTimeout(() => {
      const first = document.getElementById("acc-f0");
      if (first) first.focus();
    }, 50);
  }

  function flash(key, vars) {
    const el = document.getElementById("acc-flash");
    el.textContent = t(key, vars);
    el.hidden = false;
    clearTimeout(flash._t);
    flash._t = setTimeout(() => (el.hidden = true), 6000);
  }

  async function onAction(act, login) {
    const u = users.find((x) => x.username === login);
    if (!u) return;
    const nm = (u.name && u.name.kk) || u.username;
    if (act === "pw") {
      openDialog({
        title: t("acc_new_password_for", { name: nm }),
        fields: [{ label: t("acc_new_pw"), type: "text", value: genPassword(), gen: true, help: t("acc_password_hint") }],
        onSubmit: async ([pw]) => {
          const res = await Auth.api("PATCH", "/admin/users/" + encodeURIComponent(login), { password: pw });
          if (!res.ok) return errText(res);
          flash("acc_saved_pw", { name: nm, login });
          return "";
        },
      });
    } else if (act === "name") {
      openDialog({
        title: t("acc_edit_name"),
        hint: login,
        fields: [
          { label: t("acc_name_kk"), value: (u.name && u.name.kk) || "" },
          { label: t("acc_name_en"), value: (u.name && u.name.en) || "" },
        ],
        onSubmit: async ([kk, en]) => {
          const res = await Auth.api("PATCH", "/admin/users/" + encodeURIComponent(login), { nameKk: kk, nameEn: en });
          if (!res.ok) return errText(res);
          await load();
          if (me && login === me.username) Auth.verify();
          return "";
        },
      });
    } else if (act === "del") {
      if (!confirm(t("acc_delete_confirm", { name: nm, login }))) return;
      const res = await Auth.api("DELETE", "/admin/users/" + encodeURIComponent(login));
      if (!res.ok) return alert(errText(res));
      flash("acc_deleted", { name: nm });
      await load();
    }
  }

  function bindForms() {
    const add = document.getElementById("acc-add-form");
    const gen = document.getElementById("acc-add-gen");
    gen.addEventListener("click", () => {
      const p = document.getElementById("acc-add-pass");
      p.type = "text";
      p.value = genPassword();
    });
    add.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = document.getElementById("acc-add-error");
      err.textContent = "";
      const body = {
        nameKk: document.getElementById("acc-add-name").value,
        nameEn: document.getElementById("acc-add-name-en").value,
        username: document.getElementById("acc-add-login").value.trim().toLowerCase(),
        password: document.getElementById("acc-add-pass").value,
      };
      const btn = add.querySelector('button[type="submit"]');
      btn.disabled = true;
      const res = await Auth.api("POST", "/admin/users", body);
      btn.disabled = false;
      if (!res.ok) {
        err.textContent = errText(res);
        return;
      }
      flash("acc_created", { name: res.data.user.name.kk, login: res.data.user.username });
      add.reset();
      document.getElementById("acc-add-pass").type = "text";
      await load();
    });

    const mine = document.getElementById("acc-my-form");
    mine.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = document.getElementById("acc-my-error");
      err.textContent = "";
      const oldPw = document.getElementById("acc-my-old").value;
      const p1 = document.getElementById("acc-my-new").value;
      const p2 = document.getElementById("acc-my-new2").value;
      if (p1 !== p2) {
        err.textContent = t("err_mismatch");
        return;
      }
      const btn = mine.querySelector('button[type="submit"]');
      btn.disabled = true;
      const res = await Auth.api("POST", "/me/password", { oldPassword: oldPw, newPassword: p1 });
      btn.disabled = false;
      if (!res.ok) {
        err.textContent = errText(res);
        return;
      }
      Auth.updateToken(res.data.token, res.data.user);
      mine.reset();
      flash("acc_my_saved");
    });

    document.getElementById("acc-list").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (b) onAction(b.dataset.act, b.dataset.u);
    });
  }

  window.bootAccountsAdmin = function () {
    me = Auth.current();
    if (!me || me.role !== "teacher") return;
    bindForms();
    load();
    window.addEventListener("langchange", renderList);
    if (location.hash === "#students") {
      setTimeout(() => document.getElementById("students").scrollIntoView(), 50);
    }
  };
})();
