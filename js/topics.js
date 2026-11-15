/* Shared topic list (landing page "Olympiad map" + student dashboard).
   One source of truth for icons and Google Drive folder links.
   Labels come from i18n keys topic_N / topic_N_s. Load after js/i18n.js. */
const DRIVE_FOLDER = "https://drive.google.com/drive/folders/";

const GEO_TOPICS = [
  { n: 1, icon: "🪨", folder: "1MBjen6sY16ns0DoCUg2LglvWXHTtTiwA" }, // Geology
  { n: 2, icon: "⛰️", folder: "1zgj2xyEBKQ8kuZq2EakGM6vRCzEeBrGx" }, // Geomorphology
  { n: 3, icon: "🌊", folder: "1-u8afSqFr020SLyaPz0fnJCoRtR2SCUx" }, // Oceanology
  { n: 4, icon: "💧", folder: "13WNOZAvoGMmLueo8fyDVHBMPPwtG-MZ5" }, // Hydrology
  { n: 5, icon: "👥", folder: "1f2RZq4ILV23XsAUn4mAcAZMFoa4couMS" }, // Demographics
  { n: 6, icon: "🏙️", folder: "1zT8gi5n0tL84bC2IzXbmUjycNKA-1G-7" }, // Urban studies
  { n: 7, icon: "🗺️", folder: "1MnhcoGYseG85DwcXlBowNxs8XufxUW4M" }, // Political geography
  { n: 8, icon: "🌦️", folder: "12HFfjyG00nF51bmyeUOSYlQ9in73lHBp" }, // Climatology
  { n: 9, icon: "🏭", folder: "1TpHujsrdryoyWaYslj3Od8Ze-kY2MVrk" }, // Economic geography
  { n: 10, icon: "📐", folder: "1IH_XK7JEupF9AmuTCMjWCfYiDa3oeGLg" }, // Cartography
  { n: 11, icon: "🌿", folder: "1cpLI6Bx7603L61MqjCStX3AiBa__gAD9" }, // Biogeography
  { n: 12, icon: "🇰🇿", folder: "1cswsAGtAN9GV4-2IvGihsGe7t-pqWyCi" }, // Geography of Kazakhstan
];

function topicCardsHtml() {
  const t = (k) => (window.Lang ? Lang.t(k) : k);
  return GEO_TOPICS.map(
    (x) => `<a class="topic-card" href="${DRIVE_FOLDER}${x.folder}" target="_blank" rel="noopener noreferrer">
      <span class="topic-icon" aria-hidden="true">${x.icon}</span>
      <h3 data-i18n="topic_${x.n}">${t(`topic_${x.n}`)}</h3>
      <p data-i18n="topic_${x.n}_s">${t(`topic_${x.n}_s`)}</p>
    </a>`
  ).join("");
}

/** Fill every element with [data-topic-grid] (call before Lang.apply) */
function renderTopicGrids(root) {
  (root || document).querySelectorAll("[data-topic-grid]").forEach((el) => {
    el.innerHTML = topicCardsHtml();
  });
}

window.GEO_TOPICS = GEO_TOPICS;
window.topicCardsHtml = topicCardsHtml;
window.renderTopicGrids = renderTopicGrids;
