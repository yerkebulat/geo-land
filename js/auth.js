/* Accounts live on the server (Cloudflare Worker + KV, hashed passwords).
   The browser only keeps a signed session token in localStorage. */
const Auth = {
  SESSION_KEY: "geoland_session",

  _url(path) {
    const base = (window.ACCOUNTS_CONFIG && window.ACCOUNTS_CONFIG.url) || "";
    return base.replace(/\/+$/, "") + path;
  },

  /** Call the accounts API. Returns { ok, status, data }. Network failure -> status 0. */
  async api(method, path, body) {
    const s = this.current();
    const headers = { "Content-Type": "application/json" };
    if (s && s.token) headers.Authorization = "Bearer " + s.token;
    try {
      const res = await fetch(this._url(path), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let data = {};
      try {
        data = await res.json();
      } catch {}
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { error: "network" } };
    }
  },

  _save(token, user) {
    const session = { username: user.username, role: user.role, name: user.name, token, at: Date.now() };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return session;
  },

  async login(username, password) {
    const res = await this.api("POST", "/login", {
      username: String(username || "").trim().toLowerCase(),
      password: String(password || ""),
    });
    if (!res.ok) return { ok: false, error: res.status === 0 ? "network" : "invalid" };
    return { ok: true, user: this._save(res.data.token, res.data.user) };
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
  },

  current() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.token) {
        // Old sessions from before server accounts: sign in again
        localStorage.removeItem(this.SESSION_KEY);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  },

  require(role) {
    const user = this.current();
    if (!user) {
      window.location.href = "index.html#login";
      return null;
    }
    if (role && user.role !== role) {
      window.location.href = "app.html";
      return null;
    }
    return user;
  },

  /** Check the token with the server; refresh the stored name; sign out if revoked. */
  async verify() {
    const s = this.current();
    if (!s) return null;
    const res = await this.api("GET", "/me");
    if (res.status === 401) {
      this.logout();
      window.location.href = "index.html#login";
      return null;
    }
    if (res.ok && res.data.user) {
      const u = res.data.user;
      if (JSON.stringify(u.name) !== JSON.stringify(s.name) || u.role !== s.role) {
        this._save(s.token, u);
        window.dispatchEvent(new CustomEvent("sessionupdate"));
      }
    }
    return this.current();
  },

  /** Replace the stored token (after changing own password). */
  updateToken(token, user) {
    return this._save(token, user || this.current());
  },

  displayName(user, lang) {
    if (!user) return "";
    const l = lang || (window.Lang && Lang.current) || "kk";
    const n = user.name;
    if (!n) return user.username;
    return (l === "en" ? n.en || n.kk : n.kk || n.en) || user.username;
  },
};

window.Auth = Auth;
