/**
 * Gemini grading config for Geo-Land.
 *
 * PRODUCTION (recommended): Cloudflare Worker — key stays on the server.
 *   mode: "worker"
 *   workerUrl: your workers.dev URL from worker/README.md
 *
 * LOCAL only (optional): js/gemini-config.local.js (gitignored) with mode "direct"
 *   and apiKey — never commit that file.
 *
 * Get a Gemini key: https://aistudio.google.com/apikey
 * Deploy worker: see worker/README.md
 */
window.GEMINI_CONFIG = {
  enabled: false,
  /** "worker" = Cloudflare proxy (safe for GitHub Pages). "direct" = browser→Gemini (local only). */
  mode: "worker",
  /** e.g. https://geo-land-gemini-grade.yourname.workers.dev */
  workerUrl: "https://geo-land-gemini-grade.YOUR_SUBDOMAIN.workers.dev",
  /** Used only when mode is "direct" (do not commit a real key). */
  apiKey: "YOUR_GEMINI_API_KEY",
  model: "gemini-2.0-flash",
};
