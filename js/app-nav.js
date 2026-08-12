/* Shared app navigation chrome */
function renderAppNav(active) {
  const user = Auth.current();
  const name = user ? Auth.displayName(user) : "";
  const roleBadge =
    user && user.role === "teacher"
      ? `<span class="badge badge-teacher" data-i18n="role_teacher">Мұғалім</span>`
      : `<span class="badge badge-student" data-i18n="role_student">Оқушы</span>`;

  return `
  <nav class="nav">
    <div class="nav-inner">
      <a class="logo" href="app.html">
        <span class="logo-mark" aria-hidden="true">
          <img src="assets/logo-earth.webp" alt="" width="40" height="40" />
        </span>
        <span class="logo-text">Geo-Land</span>
      </a>
      <ul class="nav-links">
        <li><a href="app.html" class="${active === "dash" ? "active" : ""}" data-i18n="nav_dashboard">Басты бет</a></li>
        ${
          user && user.role === "teacher"
            ? `<li><a href="teacher.html" class="${active === "teacher" ? "active" : ""}" data-i18n="card_teacher">Оқушы нәтижелері</a></li>`
            : `<li><a href="history.html" class="${active === "history" ? "active" : ""}" data-i18n="card_history">Менің нәтижелерім</a></li>`
        }
      </ul>
      <div class="nav-actions">
        <div class="lang-toggle" aria-label="Language">
          <button type="button" data-lang="kk" class="active">ҚАЗ</button>
          <button type="button" data-lang="en">EN</button>
        </div>
        ${
          user
            ? `<div class="user-chip">${roleBadge} <strong>${escapeHtml(name)}</strong></div>
               <button type="button" class="btn btn-ghost btn-sm" id="btn-logout" data-i18n="nav_logout">Шығу</button>`
            : ""
        }
      </div>
    </div>
  </nav>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mountAppNav(active) {
  const host = document.getElementById("app-nav");
  if (!host) return;
  host.innerHTML = renderAppNav(active);
  Lang.bindToggles();
  Lang.apply();
  const logout = document.getElementById("btn-logout");
  if (logout) {
    logout.addEventListener("click", () => {
      Auth.logout();
      window.location.href = "index.html";
    });
  }
  window.addEventListener("langchange", () => {
    const u = Auth.current();
    if (!u) return;
    const chip = document.querySelector(".user-chip strong");
    if (chip) chip.textContent = Auth.displayName(u);
  });
}

function storageBannerHtml() {
  const cloud = Storage.isCloud();
  const key = cloud ? "storage_firebase" : "storage_local";
  return `<div class="storage-banner" data-i18n="${key}"></div>`;
}

async function ensureStorageBanner(container) {
  await Storage.init();
  if (!container) return;
  container.innerHTML = storageBannerHtml();
  Lang.apply();
}

window.mountAppNav = mountAppNav;
window.ensureStorageBanner = ensureStorageBanner;
window.escapeHtml = escapeHtml;
