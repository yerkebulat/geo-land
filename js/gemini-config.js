/**
 * Google Gemini API (AI Studio free tier) for open-question grading.
 *
 * 1. Open https://aistudio.google.com/apikey
 * 2. Create API key
 * 3. Paste below and set enabled: true
 *
 * WARNING: On GitHub Pages the key is visible in the browser.
 * For a private pilot (4 users) this is acceptable; rotate the key if leaked.
 * Later: move to Cloudflare Worker proxy.
 */
window.GEMINI_CONFIG = {
  enabled: false,
  apiKey: "YOUR_GEMINI_API_KEY",
  /** Free-tier friendly model; change if Google renames it */
  model: "gemini-2.0-flash",
};
