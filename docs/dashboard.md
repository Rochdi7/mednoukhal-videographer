# Dashboard (/admin)

The site has its own dashboard at **`https://yourdomain.com/admin/`**, with an email and password login. It is free and runs on the existing Hostinger hosting: no outside service or account is involved.

```
/admin (browser) ── saves ──▶ api/admin/api.php on Hostinger ── content.json + uploads
        │
        └── "Publish" ──▶ GitHub Actions: read content → build site → upload by FTP ──▶ live in ~3–5 min
```

- **What can be edited:** films and film categories, albums (many photos each) and photo categories, the homepage hero video and stills, the About photo, every text on the site in EN/FR/AR (H1, paragraphs, buttons, menu, form, Google titles), the logo and mark, contact details, socials, clients, reviews and advice videos.
- **Save vs Publish:** *Save* stores the changes on the server (a backup of the previous version is kept, 40 in all). *Publish* rebuilds the website with them, so nothing half-finished goes live by accident.
- **First sign-in:** the dashboard opens with everything the site shows today (from `api/admin/seed.json`).
- **Where files go:** uploads are stored on Hostinger in `public_html/media/library/` and served from there. Photos still get AVIF/WebP versions in every size at build time. Uploads nothing uses any more are deleted after 7 days.

## One-time setup

### 1. The login
On your computer, run `npm run admin:password`. It asks for the email (for example `mednoukhal00@gmail.com`) and a password of at least 8 characters, then prints two lines. In hPanel → **File Manager** → `public_html/api/config.php`, replace the empty `admin_email` and `admin_password_hash` lines with them.

The password itself is never stored, only its hash. It can be changed later from the dashboard (**Account**).

### 2. The link between the dashboard and the build
1. Run `npm run admin:token` and copy the result. In `api/config.php`, set `'deploy_token' => '<that value>'`.
2. On GitHub, create a **fine-grained personal access token** limited to this repository, with **Contents: Read and write** and **Actions: Read**. In `api/config.php`, set `'github_token' => '<token>'`.
3. In the GitHub repository → **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
|---|---|---|
| Secret | `FTP_SERVER` | hPanel → Files → FTP Accounts (for example `ftp.yourdomain.com`) |
| Secret | `FTP_USERNAME` | the FTP user |
| Secret | `FTP_PASSWORD` | the FTP password |
| Secret | `CMS_TOKEN` | the same value as `deploy_token` |
| Variable | `CMS_URL` | `https://yourdomain.com` |
| Variable | `SITE_URL` | `https://yourdomain.com` |
| Variable | `FTP_SERVER_DIR` | optional; defaults to `./public_html/`. Use `./` if the FTP account opens inside public_html |

The workflow is `.github/workflows/deploy.yml`. It runs when Publish is pressed, on every push to `main`, and from **Actions → Build and deploy → Run workflow**. It never overwrites `api/config.php` or the uploads.

### 3. First deploy
Merge to `main` (or run the workflow by hand). The first run uploads the whole site; later runs upload only what changed. Then open `https://yourdomain.com/admin/` and sign in.

## Everyday use

- **Add a film:** Films → **+ New film**. Fill in the title, category, MP4 and poster (click the poster to set its focus point), then **Save**, then **Publish**. Tick *Showreel* for the film that opens the films page as the wide banner.
- **Add an album:** Albums → **+ New album**. Choose a category, then drag in as many photos as you like. The first is the cover; use ← → to reorder.
- **Categories:** Film categories and Photo categories. A category with nothing in it is hidden on the site, and one still in use cannot be deleted.
- **Texts:** each field shows the current text. Change it to replace it, or set it back to return to the built-in text.
- **Videos:** export H.264 MP4 and compress long films first. Visitors stream that exact file, so a 160 MB film costs 160 MB per full view. Uploads go in 4 MB pieces, so large files get past the server's upload limit.
- **Two people editing:** if someone saved in between, the dashboard asks which version to keep instead of overwriting.

## Security
- Passwords are stored as bcrypt hashes. A wrong login is refused, and there are at most 5 attempts per 15 minutes per address.
- The session cookie is HttpOnly, Secure and SameSite=Strict, and expires after 8 hours idle. Every change needs a CSRF token from the same site.
- Uploads are checked by their real file type (JPG, PNG, WebP, MP4), given random names, and stored in a folder where PHP cannot run.
- Content and backups live in `mn-data/`, next to `public_html` and outside the website. `config.php` is blocked from the web.
- `/admin` is hidden from Google (noindex, and listed in robots.txt).

## On your computer
- `npm run admin:password -- --local` once (writes `mn-config.php`), then `npm run admin:local`. This opens http://127.0.0.1:4322/admin/ with PHP; content goes in `mn-data/` and uploads in `public/media/library/` (all gitignored). Run it again after saving to see the changes on the local site.
- `npm run build` alone builds from the content in the code. With `CMS_URL` + `CMS_TOKEN` in `.env`, it builds from the live dashboard instead.
- After changing the content in the code (`src/data/*.ts`), run `npm run cms:seed` so a fresh dashboard starts from it. The live dashboard keeps its own saved content.

| File | Role |
|---|---|
| `src/pages/admin/index.astro`, `src/scripts/admin/` | The dashboard screens |
| `public/api/admin/api.php` | Login, save, upload, publish, export |
| `scripts/cms-sync.mjs` | Before each build: content → `src/data/cms.json`, photos → `src/assets/cms/` |
| `scripts/cms-seed.mjs` | Writes `api/admin/seed.json` and `public/media/seed/` from the code's content |
| `src/data/cms.ts` | Lays the dashboard content over the built-in content |
