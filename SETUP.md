# Geo-Land setup

## 1. GitHub Pages (publish the site)

1. Push this repo to GitHub (`yerkebulat/geo-land`).
2. **Settings → Pages → Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: `main` / folder: `/ (root)`
3. Wait 1–2 minutes. Site URL:

   `https://yerkebulat.github.io/geo-land/`

4. Open the URL and test login.

> All links use **relative paths**, so the site works on the project Pages URL.

---

## 2. Firebase (so teacher sees student work from any device)

Without Firebase, submissions stay in each browser’s **localStorage** only (demo mode).

### Create project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. **Add project** → name e.g. `geo-land`
3. Skip Google Analytics (optional)

### Enable Firestore

1. **Build → Firestore Database → Create database**
2. Start in **production mode**
3. Pick a region (e.g. `europe-west` or nearest)

### Security rules (school pilot)

**Firestore → Rules** — for a closed pilot with 4 known accounts you can use open rules **only if you accept that anyone who finds the site could write data**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /submissions/{id} {
      allow read, write: if true;
    }
  }
}
```

Later you should switch to Firebase Auth + stricter rules.

### Web app config

1. Project **Settings** (gear) → **Your apps** → Web (`</>`)
2. Nickname: `geo-land-web` → Register
3. Copy the config object into `js/firebase-config.js`:

```js
window.FIREBASE_CONFIG = {
  enabled: true,
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

4. Commit and push. Banner on the dashboard should say **Firebase connected**.

---

## 3. Accounts (v1 — no registration)

| Role    | Login                 | Password         |
|---------|-----------------------|------------------|
| Teacher | `nursultan.utebayev`  | `nursultan1234!` |
| Student | `arsen.sydykov`       | `arsen1234!`     |
| Student | `yerulan.kongrat`     | `yerulan1234!`   |
| Student | `yerkebulan.tazabek`  | `yerkebulan1234!`|

Edit accounts in `js/auth.js`.

> Passwords live in frontend JS — fine for a private class pilot, **not** for public registration.

---

## 4. Gemini API via Cloudflare Worker (AI open-question grading)

**Do not put API keys in the repo.** Use a free Cloudflare Worker (see full steps in **`worker/README.md`**).

### Short version

1. Create Gemini key: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)  
2. Cloudflare → Workers → create `geo-land-gemini-grade` → paste code from `worker/gemini-grade/src/index.js`  
3. Worker **Settings → Secrets** → `GEMINI_API_KEY` = your key  
4. Copy worker URL (`https://….workers.dev`) into `js/gemini-config.js`:

```js
window.GEMINI_CONFIG = {
  enabled: true,
  mode: "worker",
  workerUrl: "https://geo-land-gemini-grade.YOUR_SUBDOMAIN.workers.dev",
  model: "gemini-2.0-flash",
};
```

5. Commit & push — safe (no secret in git). Live Pages + local both use the worker.

If Gemini/worker is off, open answers still save; teacher grades manually.

Open set: `data/open-1.json` (14 questions, 30 points).

---

## 5. Adding more tests / calculations

1. Copy `data/test-1.json` → `data/test-2.json` (or `calc-2.json`).
2. Edit questions / `correct` index (0-based).
3. Add a card link in `app.html` (e.g. `test.html?id=test-2`).

Open questions + AI marking: planned later.

---

## 6. Answer keys

MCQ keys are in `data/test-1.json` field `"correct"` (0 = A, 1 = B, …).

Please have Nursultan review keys, especially multi-select items and “which does not belong” questions. Edit JSON and redeploy if anything is wrong.

---

## 7. Local preview

```bash
cd geo-land
python3 -m http.server 8080
```

Open `http://localhost:8080`
