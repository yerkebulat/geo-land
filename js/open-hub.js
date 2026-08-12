/* Student/teacher: pick open-question category, then choose a set */

/** Built-in pack treated as a published set under Аралас (not in Firestore) */
function builtInMixedSet() {
  return {
    id: "open-1",
    title:
      Lang.current === "en"
        ? "Open questions #1 — Mixed (built-in)"
        : "Ашық сұрақтар №1 — Аралас (кірістірілген)",
    description:
      Lang.current === "en"
        ? "Mineralogy, geopolitics, meteorology · 14 questions · 30 pts · AI + teacher"
        : "Минералогия, геосаясат, метеорология · 14 сұрақ · 30 б · AI + мұғалім",
    category: "mixed",
    published: true,
    questionCount: 14,
    totalPoints: 30,
    builtIn: true,
  };
}

async function bootOpenHub() {
  const user = Auth.require();
  if (!user) return;
  mountAppNav("dash");
  await Storage.init();

  const params = new URLSearchParams(location.search);
  const cat = params.get("cat");

  if (cat && OpenCategories.get(cat)) {
    await renderCategorySets(user, cat);
  } else {
    await renderCategoryGrid(user);
  }

  window.addEventListener("langchange", async () => {
    const p = new URLSearchParams(location.search);
    const c = p.get("cat");
    if (c && OpenCategories.get(c)) await renderCategorySets(user, c);
    else await renderCategoryGrid(user);
  });
}

async function loadPublishedSets() {
  let published = [];
  try {
    published = await OpenSets.listPublished();
  } catch (e) {
    console.warn(e);
  }
  return published;
}

/** Teacher sets + built-in open-1 only under mixed */
function setsForCategory(published, catId) {
  const list = published.filter((s) => s.category === catId);
  if (catId === "mixed") {
    // Avoid duplicate if teacher somehow used id open-1
    if (!list.some((s) => s.id === "open-1")) {
      list.unshift(builtInMixedSet());
    }
  }
  return list;
}

async function renderCategoryGrid(user) {
  const root = document.getElementById("open-hub-root");
  const published = await loadPublishedSets();

  const counts = {};
  OpenCategories.list().forEach((c) => {
    counts[c.id] = setsForCategory(published, c.id).length;
  });

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1 data-i18n="open_hub_title">${Lang.t("open_hub_title")}</h1>
        <p data-i18n="open_hub_lead">${Lang.t("open_hub_lead")}</p>
      </div>
      <a href="app.html" class="btn btn-ghost btn-sm" data-i18n="back">${Lang.t("back")}</a>
    </div>
    <div class="cat-grid">
      ${OpenCategories.list()
        .map((c) => {
          const n = counts[c.id] || 0;
          return `
          <a class="cat-card" href="open-hub.html?cat=${encodeURIComponent(c.id)}">
            <span class="cat-icon">${c.icon}</span>
            <h3>${escapeHtml(OpenCategories.label(c.id))}</h3>
            <p class="meta">${n} ${Lang.t("open_sets_count")}</p>
          </a>`;
        })
        .join("")}
    </div>
  `;
  Lang.apply();
}

async function renderCategorySets(user, catId) {
  const root = document.getElementById("open-hub-root");
  root.innerHTML = `<p class="empty-state">${Lang.t("loading")}</p>`;

  const published = await loadPublishedSets();
  const sets = setsForCategory(published, catId);

  const label = OpenCategories.label(catId);
  const icon = OpenCategories.icon(catId);

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${icon} ${escapeHtml(label)}</h1>
        <p data-i18n="open_hub_pick_set">${Lang.t("open_hub_pick_set")}</p>
      </div>
      <a href="open-hub.html" class="btn btn-ghost btn-sm">${Lang.t("back")}</a>
    </div>
    ${
      !sets.length
        ? `<div class="empty-state"><div class="big">📭</div><p>${Lang.t(
            "open_hub_empty_cat"
          )}</p>
           ${
             user.role === "teacher"
               ? `<a class="btn btn-primary" href="teacher-open.html?new=1">${Lang.t(
                   "open_create_new"
                 )}</a>`
               : ""
           }</div>`
        : `<div class="dash-grid">
            ${sets
              .map(
                (s) => `
              <div class="dash-card">
                <span class="icon">${s.builtIn ? "📦" : icon}</span>
                <h3>${escapeHtml(s.title)}</h3>
                <p>${escapeHtml(s.description || "")}</p>
                <p class="meta">${s.questionCount || 0} ${Lang.t("q_of")} · ${
                  s.totalPoints || 0
                } ${Lang.t("points_short")}${
                  s.builtIn
                    ? ` · <span data-i18n="open_built_in">${Lang.t("open_built_in")}</span>`
                    : ""
                }</p>
                <a class="btn btn-primary btn-sm" href="open.html?id=${encodeURIComponent(
                  s.id
                )}">${Lang.t("start")}</a>
              </div>`
              )
              .join("")}
          </div>`
    }
  `;
  Lang.apply();
}

window.bootOpenHub = bootOpenHub;
