/**
 * Teacher-authored open question sets.
 * Firestore: open_sets/{id}
 * Storage: open-images/{setId}/{file}
 * Local fallback: localStorage geoland_open_sets
 */
const OpenSets = {
  LS_KEY: "geoland_open_sets",
  MAX_IMAGE_BYTES: 2.5 * 1024 * 1024,

  _uid(prefix) {
    return (
      (prefix || "x") +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 8)
    );
  },

  async _ready() {
    await Storage.init();
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

  _totalPoints(questions) {
    return (questions || []).reduce((s, q) => s + (Number(q.points) || 1), 0);
  },

  async listAll() {
    await this._ready();
    if (Storage.mode === "firebase" && Storage._db) {
      try {
        const snap = await Storage._db.collection("open_sets").orderBy("updatedAt", "desc").get();
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e) {
        // fallback without index / empty
        console.warn("open_sets orderBy failed", e);
        const snap = await Storage._db.collection("open_sets").get();
        return snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      }
    }
    return this._readLocal().sort((a, b) =>
      (b.updatedAt || "").localeCompare(a.updatedAt || "")
    );
  },

  async listPublished() {
    const all = await this.listAll();
    return all.filter((s) => s.published);
  },

  async get(id) {
    await this._ready();
    if (!id) return null;
    if (Storage.mode === "firebase" && Storage._db) {
      const snap = await Storage._db.collection("open_sets").doc(id).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() };
    }
    return this._readLocal().find((x) => x.id === id) || null;
  },

  async save(set, username) {
    await this._ready();
    const now = new Date().toISOString();
    const questions = (set.questions || []).map((q, i) => ({
      id: q.id || this._uid("oq"),
      order: i,
      text: String(q.text || "").trim(),
      points: Math.max(0.5, Number(q.points) || 1),
      imageUrl: q.imageUrl || "",
      modelAnswer: q.modelAnswer ? String(q.modelAnswer).trim() : "",
    }));
    const doc = {
      id: set.id || this._uid("os"),
      title: String(set.title || "").trim() || "Open set",
      description: String(set.description || "").trim(),
      published: !!set.published,
      createdBy: set.createdBy || username || "nursultan.utebayev",
      createdAt: set.createdAt || now,
      updatedAt: now,
      questions,
      totalPoints: this._totalPoints(questions),
      questionCount: questions.length,
    };

    if (Storage.mode === "firebase" && Storage._db) {
      await Storage._db.collection("open_sets").doc(doc.id).set(doc, { merge: true });
    } else {
      const list = this._readLocal();
      const i = list.findIndex((x) => x.id === doc.id);
      if (i >= 0) list[i] = doc;
      else list.push(doc);
      this._writeLocal(list);
    }
    return doc;
  },

  async delete(id) {
    await this._ready();
    if (Storage.mode === "firebase" && Storage._db) {
      await Storage._db.collection("open_sets").doc(id).delete();
      return true;
    }
    this._writeLocal(this._readLocal().filter((x) => x.id !== id));
    return true;
  },

  async setPublished(id, published) {
    const set = await this.get(id);
    if (!set) return null;
    set.published = !!published;
    return this.save(set, set.createdBy);
  },

  /**
   * Upload image file → Storage URL, or return https URL as-is.
   */
  async resolveImage(fileOrUrl, setId) {
    if (!fileOrUrl) return "";
    if (typeof fileOrUrl === "string") {
      const u = fileOrUrl.trim();
      if (!u) return "";
      if (/^https?:\/\//i.test(u)) return u;
      throw new Error("invalid_url");
    }
    const file = fileOrUrl;
    if (!file.type || !file.type.startsWith("image/")) throw new Error("not_image");
    if (file.size > this.MAX_IMAGE_BYTES) throw new Error("image_too_large");

    await this._ready();
    if (Storage.mode === "firebase" && window.firebase && firebase.storage) {
      const path = `open-images/${setId || "draft"}/${this._uid("img")}_${file.name.replace(
        /[^\w.\-]+/g,
        "_"
      )}`;
      const ref = firebase.storage().ref().child(path);
      await ref.put(file);
      return await ref.getDownloadURL();
    }

    // local fallback: data URL (works offline, heavy)
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /** Normalize set to shape open-runner expects */
  toTask(set) {
    if (!set) return null;
    const questions = (set.questions || []).map((q) => ({
      id: q.id,
      points: q.points || 1,
      text: q.text, // string OK for tField
      imageUrl: q.imageUrl || "",
      modelAnswer: q.modelAnswer || "",
      rubric: q.modelAnswer
        ? ""
        : "Grade using the question, geography olympiad standards, and the student answer. Partial credit allowed.",
    }));
    return {
      id: set.id,
      title: set.title,
      description: set.description || "",
      intro:
        Lang && Lang.current === "en"
          ? "Write full answers. AI will draft a score; your teacher can adjust it."
          : "Жауаптарыңызды толық жазыңыз. AI алдын ала бағалайды; мұғалім түзете алады.",
      totalPoints: set.totalPoints || this._totalPoints(questions),
      questions,
      source: "dynamic",
    };
  },
};

window.OpenSets = OpenSets;
