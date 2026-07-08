# Strongman AI — Web (v1.1)

Static frontend for [Strongman AI](https://www.strongmanai.com). Hosted on **GitHub Pages** with custom domain.

API (separate repo): **https://strongmanai-api.onrender.com/api/v1**

## Repo layout

Push the **contents of this folder** as the repo root (not the parent `v1.1/` folder):

```
index.html
home.html
css/
js/
shared/
assets/
CNAME
404.html
...
```

## GitHub Pages setup

1. Create a new GitHub repo and push this directory.
2. **Settings → Pages → Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: `main` / **/ (root)**
3. **Custom domain:** `www.strongmanai.com` (see `CNAME`)
4. Enable **Enforce HTTPS**

DNS (at your registrar):

- `www` → CNAME → `<username>.github.io`
- Apex `strongmanai.com` → A records to GitHub Pages IPs (or redirect apex → www)

## API connection

Production builds call the Render API automatically (`shared/api.js`). Local dev uses `http://127.0.0.1:8080/api/v1` when opened from `localhost`.

Run the API locally:

```bash
# in the backend repo
npm run dev
```

Then open this site with Live Server or `npx serve` on port 5500.

## Clean URLs on GitHub Pages

In-app links use paths like `/home`, `/login` (no `.html`). GitHub Pages does not read `_redirects` (that file is for Netlify).

Routing is handled by:

- `404.html` + `shared/gh-pages-routes.js` — maps paths to the correct HTML file
- `version.html` / `survey.html` — restore wildcard paths (`/versions/v1.1`, `/survey/...`)

**Asset paths:** HTML uses root-relative URLs (`/css/...`, `/js/...`, `/assets/...`) so styles and scripts load on clean URLs like `/home`, not only `/`.

## Launch checklist

- [ ] Frontend repo pushed; Pages live on custom domain
- [ ] Backend on Render with env vars set
- [ ] Render `CORS_ORIGIN` includes `https://www.strongmanai.com` (default)
- [ ] Signup email flow tested (`RESEND_API_KEY` on Render)
- [ ] Logged-in flow tested (Render cold start / server-wake overlay)
