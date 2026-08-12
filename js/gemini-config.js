/**
 * Gemini grading config for Geo-Land.
 *
 * PRODUCTION: Cloudflare Worker — key stays on the server (GEMINI_API_KEY secret).
 * LOCAL override (optional): js/gemini-config.local.js (gitignored).
 *
 * Worker: https://geo-land-gemini-grade.yerkebulantazabek.workers.dev
 * Deploy code: worker/gemini-grade/src/index.js
 */
window.GEMINI_CONFIG = {
  enabled: true,
  mode: "worker",
  workerUrl: "https://geo-land-gemini-grade.yerkebulantazabek.workers.dev",
  apiKey: "YOUR_GEMINI_API_KEY",
  model: "gemini-2.5-flash",
};
