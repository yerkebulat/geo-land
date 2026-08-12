# Custom domain for Geo-Land (Cloudflare + GitHub Pages)

Your site today: `https://yerkebulat.github.io/geo-land/`  
Repo: `https://github.com/yerkebulat/geo-land`  
Worker: `https://geo-land-gemini-grade.yerkebulantazabek.workers.dev`

After this guide, it will be e.g. `https://geoland.kz` (your real name).

**Replace `YOURDOMAIN.com` everywhere with your real domain.**

---

## Part A — Buy the domain on Cloudflare

1. Open [https://dash.cloudflare.com](https://dash.cloudflare.com) (same account as the Worker if possible).
2. Left menu → **Domain Registration** → **Register Domains**  
   (or: [https://dash.cloudflare.com/?to=/:account/domains/register](https://dash.cloudflare.com/?to=/:account/domains/register))
3. Search a name, e.g. `geoland.kz`, `geo-land.kz`, `nugeo.kz`.
4. Add to cart → pay → complete purchase.
5. Domain appears under your account. DNS is **already on Cloudflare** (easiest path).

### If you already bought the domain elsewhere (Namecheap, etc.)

1. Cloudflare dashboard → **Add a site** → enter `YOURDOMAIN.com`.
2. Choose **Free** plan → Continue.
3. Cloudflare shows **2 nameservers** (e.g. `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`).
4. At your registrar → DNS / Nameservers → change to those **two** Cloudflare nameservers.
5. Wait until Cloudflare status is **Active** (can take minutes to 24h).

---

## Part B — DNS records (Cloudflare)

1. Cloudflare → select **YOURDOMAIN.com**.
2. Left → **DNS** → **Records**.
3. Delete conflicting old records for `@` / `www` if any (old parking pages, etc.).

### B1 — Apex domain (`YOURDOMAIN.com`)

Add **four** records (one for each IP):

| Type | Name | Content (IPv4) | Proxy status |
|------|------|----------------|--------------|
| **A** | `@` | `185.199.108.153` | **DNS only** (grey cloud) |
| **A** | `@` | `185.199.109.153` | **DNS only** |
| **A** | `@` | `185.199.110.153` | **DNS only** |
| **A** | `@` | `185.199.111.153` | **DNS only** |

**Important:** Proxy = **DNS only** (grey cloud), **not** orange Proxied — at least until HTTPS works on GitHub. Orange proxy often breaks GitHub Pages SSL setup.

Optional IPv6 (recommended):

| Type | Name | Content | Proxy |
|------|------|---------|--------|
| **AAAA** | `@` | `2606:50c0:8000::153` | DNS only |
| **AAAA** | `@` | `2606:50c0:8001::153` | DNS only |
| **AAAA** | `@` | `2606:50c0:8002::153` | DNS only |
| **AAAA** | `@` | `2606:50c0:8003::153` | DNS only |

### B2 — www (`www.YOURDOMAIN.com`)

| Type | Name | Content | Proxy |
|------|------|---------|--------|
| **CNAME** | `www` | `yerkebulat.github.io` | **DNS only** |

Save all records.

---

## Part C — GitHub Pages custom domain

1. Open [https://github.com/yerkebulat/geo-land/settings/pages](https://github.com/yerkebulat/geo-land/settings/pages)
2. Under **Custom domain**, type: `YOURDOMAIN.com` (or `www.YOURDOMAIN.com` if you prefer only www).
3. Click **Save**.
4. GitHub creates/updates a `CNAME` file in the repo (or you add it — see Part D).
5. Wait for DNS check (can take a few minutes to hours).
6. When the check is green, enable **Enforce HTTPS**.

### Prefer both apex + www

- In GitHub custom domain field, enter **apex** `YOURDOMAIN.com`.
- Keep both A records and www CNAME as above.
- GitHub will redirect between them once HTTPS is on.

---

## Part D — CNAME file in the repo (recommended)

In the **root** of `geo-land` (same folder as `index.html`), file named exactly `CNAME` (no extension), **one line only**:

```text
YOURDOMAIN.com
```

Example:

```text
geoland.kz
```

Then:

```bash
cd ~/Desktop/geo-land
# after you create CNAME with your real domain:
git add CNAME
git commit -m "Add custom domain for GitHub Pages"
git push
```

---

## Part E — Cloudflare Worker (AI grading on new domain)

The Worker only allows certain origins. After the domain works:

1. Cloudflare → **Workers & Pages** → **geo-land-gemini-grade**
2. **Settings** → **Variables and secrets**
3. Add or edit **Text** variable:

| Name | Value |
|------|--------|
| `ALLOWED_ORIGINS` | `https://YOURDOMAIN.com,https://www.YOURDOMAIN.com,https://yerkebulat.github.io,http://localhost:8080,http://127.0.0.1:8080` |

4. **Save** / Deploy if asked.

Without this, open-question AI may fail with CORS on the new domain (answers still save).

---

## Part F — Check everything

| Check | How |
|--------|-----|
| DNS | [https://dnschecker.org](https://dnschecker.org) → your domain → A / CNAME |
| Site | Open `https://YOURDOMAIN.com` — should show Geo-Land |
| HTTPS | Browser padlock; GitHub “Enforce HTTPS” on |
| Login | Test student login |
| AI | Open questions → submit — should still grade |

---

## Common problems

| Problem | Fix |
|---------|-----|
| Site not loading | Wait 15–60 min for DNS; confirm grey cloud (DNS only) |
| “Domain does not resolve” on GitHub | A records wrong; name must be `@` |
| HTTPS stuck | Wait up to 24h after DNS is correct; then Enforce HTTPS |
| Old `/geo-land/` links | Custom domain serves **root** (`/`), not `/geo-land/` — use the new URL |
| AI broken on new domain | Update `ALLOWED_ORIGINS` on Worker (Part E) |
| Orange cloud / 522 errors | Set records to **DNS only** (grey) |

---

## Order checklist

- [ ] Buy domain (Cloudflare)  
- [ ] DNS: 4× A for `@` → GitHub IPs, grey cloud  
- [ ] DNS: CNAME `www` → `yerkebulat.github.io`, grey cloud  
- [ ] GitHub Pages → Custom domain → Save  
- [ ] `CNAME` file in repo (optional but good)  
- [ ] Enforce HTTPS when ready  
- [ ] Worker `ALLOWED_ORIGINS` includes new domain  
- [ ] Test site + login + AI  

---

When you have the **exact domain name**, send it (e.g. `geoland.kz`) and we can fill the `CNAME` file and Worker origins for you in the repo.
