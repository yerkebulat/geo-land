/**
 * Dual storage: Firebase Firestore when configured, else localStorage.
 * Collection: submissions
 * Doc shape:
 * {
 *   id, username, role, type: 'test'|'calc',
 *   taskId, taskTitle, answers, score, maxScore,
 *   status: 'auto'|'pending'|'marked',
 *   teacherScore, teacherComment, gradedBy, gradedAt,
 *   createdAt, updatedAt, details
 * }
 */
const Storage = {
  mode: "local", // 'local' | 'firebase'
  _db: null,
  _ready: null,
  LS_KEY: "geoland_submissions",

  async init() {
    if (this._ready) return this._ready;
    this._ready = this._init();
    return this._ready;
  },

  async _init() {
    const cfg = window.FIREBASE_CONFIG;
    if (cfg && cfg.enabled && cfg.apiKey && cfg.apiKey !== "YOUR_API_KEY") {
      try {
        if (!window.firebase) {
          console.warn("Firebase SDK not loaded");
          this.mode = "local";
          return this.mode;
        }
        if (!firebase.apps.length) {
          firebase.initializeApp({
            apiKey: cfg.apiKey,
            authDomain: cfg.authDomain,
            projectId: cfg.projectId,
            storageBucket: cfg.storageBucket,
            messagingSenderId: cfg.messagingSenderId,
            appId: cfg.appId,
          });
        }
        this._db = firebase.firestore();
        // lightweight connectivity check
        await this._db.collection("submissions").limit(1).get();
        this.mode = "firebase";
      } catch (e) {
        console.warn("Firebase init failed, using localStorage", e);
        this.mode = "local";
      }
    } else {
      this.mode = "local";
    }
    return this.mode;
  },

  _uid() {
    return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  },

  _readLocal() {
    try {
      return JSON.parse(localStorage.getItem(this.LS_KEY) || "[]");
    } catch {
      return [];
    }
  },

  _writeLocal(list) {
    localStorage.setItem(this.LS_KEY, JSON.stringify(list));
  },

  async saveSubmission(sub) {
    await this.init();
    const now = new Date().toISOString();
    const doc = {
      id: sub.id || this._uid(),
      username: sub.username,
      role: sub.role || "student",
      type: sub.type,
      taskId: sub.taskId,
      taskTitle: sub.taskTitle || {},
      answers: sub.answers || {},
      score: sub.score ?? null,
      maxScore: sub.maxScore ?? 0,
      status: sub.status || "pending",
      teacherScore: sub.teacherScore ?? null,
      teacherComment: sub.teacherComment || "",
      gradedBy: sub.gradedBy || null,
      gradedAt: sub.gradedAt || null,
      details: sub.details || null,
      createdAt: sub.createdAt || now,
      updatedAt: now,
    };

    if (this.mode === "firebase") {
      await this._db.collection("submissions").doc(doc.id).set(doc, { merge: true });
    } else {
      const list = this._readLocal();
      const i = list.findIndex((x) => x.id === doc.id);
      if (i >= 0) list[i] = doc;
      else list.push(doc);
      this._writeLocal(list);
    }
    return doc;
  },

  async updateSubmission(id, patch) {
    await this.init();
    const now = new Date().toISOString();
    if (this.mode === "firebase") {
      await this._db
        .collection("submissions")
        .doc(id)
        .set({ ...patch, updatedAt: now }, { merge: true });
      const snap = await this._db.collection("submissions").doc(id).get();
      return snap.exists ? snap.data() : null;
    }
    const list = this._readLocal();
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return null;
    list[i] = { ...list[i], ...patch, updatedAt: now };
    this._writeLocal(list);
    return list[i];
  },

  async getSubmission(id) {
    await this.init();
    if (this.mode === "firebase") {
      const snap = await this._db.collection("submissions").doc(id).get();
      return snap.exists ? snap.data() : null;
    }
    return this._readLocal().find((x) => x.id === id) || null;
  },

  async listSubmissions({ username, type } = {}) {
    await this.init();
    let list = [];
    if (this.mode === "firebase") {
      let q = this._db.collection("submissions").orderBy("createdAt", "desc");
      // simple client filter to avoid composite indexes during setup
      const snap = await q.get();
      list = snap.docs.map((d) => d.data());
    } else {
      list = this._readLocal().slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    }
    if (username) list = list.filter((x) => x.username === username);
    if (type) list = list.filter((x) => x.type === type);
    return list;
  },

  async deleteSubmission(id) {
    await this.init();
    if (!id) return false;
    if (this.mode === "firebase") {
      await this._db.collection("submissions").doc(id).delete();
      return true;
    }
    const list = this._readLocal();
    const next = list.filter((x) => x.id !== id);
    if (next.length === list.length) return false;
    this._writeLocal(next);
    return true;
  },

  isCloud() {
    return this.mode === "firebase";
  },
};

window.Storage = Storage;
