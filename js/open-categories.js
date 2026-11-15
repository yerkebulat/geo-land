/**
 * Open-question topic categories (shared teacher + student).
 * 9 topic tracks + Аралас (mixed).
 */
const OPEN_CATEGORIES = [
  { id: "geology", icon: "🪨", kk: "Геология", en: "Geology", ru: "Геология" },
  { id: "geomorphology", icon: "⛰️", kk: "Геоморфология", en: "Geomorphology", ru: "Геоморфология" },
  { id: "cartography", icon: "📐", kk: "Картография", en: "Cartography", ru: "Картография" },
  { id: "physical", icon: "🌍", kk: "Физ Гео", en: "Physical Geo", ru: "Физ. география" },
  { id: "social", icon: "👥", kk: "Әлеуметтік Гео", en: "Social Geo", ru: "Соц. география" },
  { id: "economic", icon: "🏭", kk: "Экон Гео", en: "Economic Geo", ru: "Экон. география" },
  { id: "country", icon: "🇰🇿", kk: "Елтану", en: "Country studies", ru: "Страноведение" },
  { id: "world_map", icon: "🗺️", kk: "Әлем картасы", en: "World map", ru: "Карта мира" },
  { id: "international", icon: "🌐", kk: "Халықаралық Гео", en: "International Geo", ru: "Международная география" },
  { id: "mixed", icon: "🔀", kk: "Аралас", en: "Mixed", ru: "Смешанные" },
];

const OpenCategories = {
  list() {
    return OPEN_CATEGORIES.slice();
  },

  get(id) {
    return OPEN_CATEGORIES.find((c) => c.id === id) || null;
  },

  label(id, lang) {
    const c = this.get(id);
    if (!c) return id || "—";
    const L = lang || (window.Lang && Lang.current) || "kk";
    return c[L] || c.kk || c.en || id;
  },

  icon(id) {
    const c = this.get(id);
    return (c && c.icon) || "✍️";
  },

  optionsHtml(selectedId) {
    return OPEN_CATEGORIES.map((c) => {
      const lab = this.label(c.id);
      const sel = c.id === selectedId ? " selected" : "";
      return `<option value="${c.id}"${sel}>${c.icon} ${lab}</option>`;
    }).join("");
  },

  /** Clickable chips for teacher form */
  chipsHtml(selectedId) {
    return OPEN_CATEGORIES.map((c) => {
      const lab = this.label(c.id);
      const on = c.id === selectedId ? " is-on" : "";
      return `<button type="button" class="cat-chip${on}" data-cat="${c.id}">
        <span>${c.icon}</span> ${escapeHtml(lab)}
      </button>`;
    }).join("");
  },
};

window.OPEN_CATEGORIES = OPEN_CATEGORIES;
window.OpenCategories = OpenCategories;
