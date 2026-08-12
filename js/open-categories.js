/**
 * Open-question topic categories (shared teacher + student).
 * id is stable in Firestore; labels via Lang / local maps.
 */
const OPEN_CATEGORIES = [
  { id: "geology", icon: "🪨", kk: "Геология", en: "Geology" },
  { id: "geomorphology", icon: "⛰️", kk: "Геоморфология", en: "Geomorphology" },
  { id: "cartography", icon: "📐", kk: "Картография", en: "Cartography" },
  { id: "physical", icon: "🌍", kk: "Физ Гео", en: "Physical Geo" },
  { id: "social", icon: "👥", kk: "Әлеуметтік Гео", en: "Social Geo" },
  { id: "economic", icon: "🏭", kk: "Экон Гео", en: "Economic Geo" },
  { id: "country", icon: "🇰🇿", kk: "Елтану", en: "Country studies" },
  { id: "world_map", icon: "🗺️", kk: "Әлем картасы", en: "World map" },
  { id: "international", icon: "🌐", kk: "Халықаралық Гео", en: "International Geo" },
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

  /** <option> list for teacher form */
  optionsHtml(selectedId) {
    return OPEN_CATEGORIES.map((c) => {
      const lab = this.label(c.id);
      const sel = c.id === selectedId ? " selected" : "";
      return `<option value="${c.id}"${sel}>${c.icon} ${lab}</option>`;
    }).join("");
  },
};

window.OPEN_CATEGORIES = OPEN_CATEGORIES;
window.OpenCategories = OpenCategories;
