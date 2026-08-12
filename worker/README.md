# Geo-Land — Cloudflare Worker (Gemini grading)

Keeps your **Gemini API key on the server**. The GitHub Pages site only calls this worker.

## Option A — Dashboard (no install, ~5 minutes)

### 1. Create worker

1. Open [https://dash.cloudflare.com](https://dash.cloudflare.com) → sign up / log in (free)
2. **Workers & Pages** → **Create** → **Create Worker**
3. Name: `geo-land-gemini-grade` → **Deploy**
4. **Edit code** → delete the default code
5. Open `worker/gemini-grade/src/index.js` from this repo, **copy all**, paste into the editor
6. **Deploy**

### 2. Add the secret key

1. Worker → **Settings** → **Variables and Secrets**
2. **Add** → **Secret**
   - Name: `GEMINI_API_KEY`
   - Value: your key from [AI Studio](https://aistudio.google.com/apikey)
3. Save

Optional variables (plain text):

| Name | Example |
|------|---------|
| `GEMINI_MODEL` | `gemini-2.0-flash` |
| `ALLOWED_ORIGINS` | `https://yerkebulat.github.io,http://localhost:8080` |

### 3. Copy worker URL

Looks like:

`https://geo-land-gemini-grade.<your-subdomain>.workers.dev`

Test in browser (GET): should show `{"service":"geo-land-gemini-grade","ok":true}`

### 4. Wire the website

Edit `js/gemini-config.js`:

```js
window.GEMINI_CONFIG = {
  enabled: true,
  mode: "worker",
  workerUrl: "https://geo-land-gemini-grade.YOUR_SUBDOMAIN.workers.dev",
  model: "gemini-2.0-flash",
};
```

Commit & push (safe — **no API key** in the repo).

---

## Option B — Wrangler CLI

```bash
cd worker/gemini-grade
npm i -g wrangler   # if needed
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

Then put the printed URL into `js/gemini-config.js` as above.

---

## Security notes

- Key never goes to GitHub or the browser
- CORS only allows your GitHub Pages + localhost
- Free Cloudflare Workers tier is enough for a small class

## If grading fails

1. Worker GET URL works?
2. Secret `GEMINI_API_KEY` set?
3. `workerUrl` in `gemini-config.js` exact (https, no trailing slash issues)?
4. Browser console Network tab → POST to worker → status/body
