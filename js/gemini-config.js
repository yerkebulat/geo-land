/**
 * Google Gemini API (AI Studio free tier) for open-question grading.
 *
 * Do NOT commit real API keys — GitHub push protection will block you.
 *
 * Local / private pilot options:
 * 1) Create js/gemini-config.local.js (gitignored) with your key, OR
 * 2) Paste key only on your machine and never commit, OR
 * 3) Later: Cloudflare Worker so the key stays server-side
 *
 * Get a key: https://aistudio.google.com/apikey
 */
window.GEMINI_CONFIG = {
  enabled: false,
  apiKey: "YOUR_GEMINI_API_KEY",
  model: "gemini-2.0-flash",
};
