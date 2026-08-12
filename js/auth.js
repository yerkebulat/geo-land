/* Hardcoded accounts — client-side only (school pilot). Not cryptographically secure. */
const USERS = [
  {
    username: "nursultan.utebayev",
    password: "nursultan1234!",
    role: "teacher",
    name: { kk: "Нұрсұлтан Утебаев", en: "Nursultan Utebayev" },
  },
  {
    username: "arsen.sydykov",
    password: "arsen1234!",
    role: "student",
    name: { kk: "Арсен Сыдықов", en: "Arsen Sydykov" },
  },
  {
    username: "yerulan.kongrat",
    password: "yerulan1234!",
    role: "student",
    name: { kk: "Ерулан Қонғырат", en: "Yerulan Kongrat" },
  },
  {
    username: "yerkebulan.tazabek",
    password: "yerkebulan1234!",
    role: "student",
    name: { kk: "Еркебұлан Тазабек", en: "Yerkebulan Tazabek" },
  },
  {
    username: "user1",
    password: "password1!",
    role: "student",
    name: { kk: "User 1", en: "User 1" },
  },
  {
    username: "user2",
    password: "password2!",
    role: "student",
    name: { kk: "User 2", en: "User 2" },
  },
  {
    username: "user3",
    password: "password3!",
    role: "student",
    name: { kk: "User 3", en: "User 3" },
  },
];

const Auth = {
  SESSION_KEY: "geoland_session",

  login(username, password) {
    const u = String(username || "").trim().toLowerCase();
    const p = String(password || "");
    const user = USERS.find(
      (x) => x.username === u && x.password === p
    );
    if (!user) return { ok: false };
    const session = {
      username: user.username,
      role: user.role,
      name: user.name,
      at: Date.now(),
    };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return { ok: true, user: session };
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
  },

  current() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
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

  displayName(user, lang) {
    if (!user) return "";
    const l = lang || (window.Lang && Lang.current) || "kk";
    return (user.name && (user.name[l] || user.name.en || user.name.kk)) || user.username;
  },

  listStudents() {
    return USERS.filter((u) => u.role === "student").map((u) => ({
      username: u.username,
      name: u.name,
      role: u.role,
    }));
  },
};

window.Auth = Auth;
window.USERS_PUBLIC = USERS.map(({ username, role, name }) => ({ username, role, name }));
