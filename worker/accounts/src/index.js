/**
 * Geo-Land: accounts Worker (login + teacher-managed student accounts)
 *
 * Bindings:
 *   ACCOUNTS        KV namespace, keys "user:<login>"
 *   SESSION_SECRET  Secret, HMAC key for session tokens (never commit it)
 * Vars:
 *   ALLOWED_ORIGINS comma-separated list of allowed browser origins
 *
 * Passwords: PBKDF2-SHA256, 100000 iterations, 16-byte random salt per user.
 * Tokens: base64url(payload).base64url(HMAC-SHA256(payload)), 30 days,
 *   invalidated when the user is deleted or their password changes ("v").
 *
 * Routes:
 *   GET    /                         health
 *   POST   /login                    {username, password} -> {token, user}
 *   GET    /me                       (token) -> {user}
 *   POST   /me/password              (token) {oldPassword, newPassword}
 *   GET    /admin/users              (teacher) -> {users}
 *   POST   /admin/users              (teacher) {username, password, nameKk, nameEn?}
 *   PATCH  /admin/users/:login       (teacher) {password?, nameKk?, nameEn?}
 *   DELETE /admin/users/:login       (teacher) students only
 */

const ITER = 100000;
const TOKEN_TTL_S = 30 * 24 * 3600;
const LOGIN_RE = /^[a-z0-9][a-z0-9._-]{1,39}$/;
const DEFAULT_ORIGINS = ["https://geo-land.org", "https://www.geo-land.org"];

const enc = new TextEncoder();

function b64u(bytes) {
  let s = "";
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function pbkdf2(password, saltBytes, iter) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: iter }, key, 256);
  return b64u(bits);
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64u(salt), hash: await pbkdf2(password, salt, ITER), iter: ITER };
}
async function verifyPassword(rec, password) {
  const h = await pbkdf2(password, unb64u(rec.salt), rec.iter || ITER);
  return timingSafeEqual(h, rec.hash);
}

async function hmac(env, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
async function makeToken(env, rec) {
  const payload = b64u(enc.encode(JSON.stringify({ u: rec.username, r: rec.role, v: rec.ver || 1, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S })));
  return payload + "." + (await hmac(env, payload));
}
async function readToken(env, request) {
  const h = request.headers.get("Authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const [payload, sig] = tok.split(".");
  if (!payload || !sig) return null;
  if (!timingSafeEqual(await hmac(env, payload), sig)) return null;
  let p;
  try {
    p = JSON.parse(new TextDecoder().decode(unb64u(payload)));
  } catch {
    return null;
  }
  if (!p || !p.u || p.exp < Math.floor(Date.now() / 1000)) return null;
  const rec = await getUser(env, p.u);
  if (!rec || (rec.ver || 1) !== p.v) return null; // deleted or password changed
  return rec;
}

async function getUser(env, login) {
  return env.ACCOUNTS.get("user:" + login, "json");
}

async function readIndex(env) {
  return (await env.ACCOUNTS.get("index:users", "json")) || [];
}

async function writeIndex(env, fn) {
  await env.ACCOUNTS.put("index:users", JSON.stringify(fn(await readIndex(env))));
}
async function putUser(env, rec) {
  await env.ACCOUNTS.put("user:" + rec.username, JSON.stringify(rec));
}
function publicUser(rec) {
  return { username: rec.username, role: rec.role, name: { kk: rec.nameKk || "", en: rec.nameEn || "" }, createdAt: rec.createdAt || null, updatedAt: rec.updatedAt || null };
}
function cleanName(v) {
  return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, 120);
}
function checkPassword(pw) {
  return typeof pw === "string" && pw.length >= 6 && pw.length <= 128;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const list = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const allowed = list.length ? list : DEFAULT_ORIGINS;
  const h = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}
function json(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(request, env) },
  });
}
async function body(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const m = request.method;
    const J = (data, status) => json(request, env, data, status);

    if (m === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (!env.SESSION_SECRET || !env.ACCOUNTS) return J({ error: "not_configured" }, 500);
    if (path === "/" && m === "GET") return J({ service: "geo-land-accounts", ok: true });

    try {
      if (path === "/login" && m === "POST") {
        const b = await body(request);
        const login = String(b.username || "").trim().toLowerCase();
        const pw = String(b.password || "");
        const rec = LOGIN_RE.test(login) ? await getUser(env, login) : null;
        if (!rec || !(await verifyPassword(rec, pw))) return J({ error: "invalid_credentials" }, 401);
        return J({ token: await makeToken(env, rec), user: publicUser(rec) });
      }

      const me = await readToken(env, request);
      if (!me) return J({ error: "unauthorized" }, 401);

      if (path === "/me" && m === "GET") return J({ user: publicUser(me) });

      if (path === "/me/password" && m === "POST") {
        const b = await body(request);
        if (!(await verifyPassword(me, String(b.oldPassword || "")))) return J({ error: "wrong_password" }, 403);
        if (!checkPassword(b.newPassword)) return J({ error: "weak_password" }, 400);
        Object.assign(me, await hashPassword(b.newPassword), { ver: (me.ver || 1) + 1, updatedAt: new Date().toISOString() });
        await putUser(env, me);
        return J({ ok: true, token: await makeToken(env, me), user: publicUser(me) });
      }

      if (!path.startsWith("/admin/")) return J({ error: "not_found" }, 404);
      if (me.role !== "teacher") return J({ error: "forbidden" }, 403);

      if (path === "/admin/users" && m === "GET") {
        // KV list() is eventually consistent, so also read the index kept on create/delete
        const names = new Set((await readIndex(env)).map((l) => "user:" + l));
        let cursor;
        do {
          const page = await env.ACCOUNTS.list({ prefix: "user:", cursor });
          for (const k of page.keys) names.add(k.name);
          cursor = page.list_complete ? null : page.cursor;
        } while (cursor);
        const users = [];
        for (const name of names) {
          const rec = await env.ACCOUNTS.get(name, "json");
          if (rec) users.push(publicUser(rec));
        }
        users.sort((a, b) => (a.role === b.role ? a.username.localeCompare(b.username) : a.role === "teacher" ? -1 : 1));
        return J({ users });
      }

      if (path === "/admin/users" && m === "POST") {
        const b = await body(request);
        const login = String(b.username || "").trim().toLowerCase();
        const nameKk = cleanName(b.nameKk);
        if (!LOGIN_RE.test(login)) return J({ error: "bad_login" }, 400);
        if (!nameKk) return J({ error: "name_required" }, 400);
        if (!checkPassword(b.password)) return J({ error: "weak_password" }, 400);
        if (await getUser(env, login)) return J({ error: "exists" }, 409);
        const now = new Date().toISOString();
        const rec = { username: login, role: "student", nameKk, nameEn: cleanName(b.nameEn), ...(await hashPassword(b.password)), ver: 1, createdAt: now, updatedAt: now };
        await putUser(env, rec);
        await writeIndex(env, (idx) => (idx.includes(login) ? idx : idx.concat(login)));
        return J({ user: publicUser(rec) }, 201);
      }

      const mm = /^\/admin\/users\/([^/]+)$/.exec(path);
      if (mm) {
        const login = decodeURIComponent(mm[1]).toLowerCase();
        const rec = await getUser(env, login);
        if (!rec) return J({ error: "not_found" }, 404);

        if (m === "PATCH") {
          const b = await body(request);
          if (b.nameKk !== undefined) {
            const n = cleanName(b.nameKk);
            if (!n) return J({ error: "name_required" }, 400);
            rec.nameKk = n;
          }
          if (b.nameEn !== undefined) rec.nameEn = cleanName(b.nameEn);
          if (b.password !== undefined) {
            if (!checkPassword(b.password)) return J({ error: "weak_password" }, 400);
            Object.assign(rec, await hashPassword(b.password), { ver: (rec.ver || 1) + 1 });
          }
          rec.updatedAt = new Date().toISOString();
          await putUser(env, rec);
          return J({ user: publicUser(rec) });
        }

        if (m === "DELETE") {
          if (rec.role !== "student") return J({ error: "cannot_delete_teacher" }, 400);
          await env.ACCOUNTS.delete("user:" + login);
          await writeIndex(env, (idx) => idx.filter((x) => x !== login));
          return J({ ok: true });
        }
      }
      return J({ error: "not_found" }, 404);
    } catch (e) {
      return J({ error: "server_error" }, 500);
    }
  },
};
