// Runs before every build: copies the dashboard's saved content into the project.
//   - content → src/data/cms.json   (read by src/data/*.ts, src/config/site.ts and t() in src/i18n)
//   - images  → src/assets/cms/     (so Astro still makes the AVIF/WebP sizes)
// Videos are not copied: they stay where the dashboard uploaded them on Hostinger and the pages point to them.
//
// Where the content comes from (.env, or GitHub secrets in the deploy):
//   CMS_URL + CMS_TOKEN   the live site, e.g. https://mednoukhal.com and the deploy_token from api/config.php
//   CMS_FILE              or a local content.json (for testing: mn-data/content.json from `npm run admin:local`)
// With neither set it does nothing, and the site builds from the content written in the code.
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { ROOT } from './cms-lib.mjs';

const root = fileURLToPath(ROOT);
const OUT_JSON = join(root, 'src/data/cms.json');
const IMG_DIR = join(root, 'src/assets/cms');
const url = (process.env.CMS_URL || '').replace(/\/+$/, '');
const token = process.env.CMS_TOKEN || '';
const file = process.env.CMS_FILE || '';

if (!(url && token) && !file) {
  rmSync(OUT_JSON, { force: true });
  console.log('[cms] No dashboard configured (CMS_URL + CMS_TOKEN, or CMS_FILE): building with the content in the code.');
  process.exit(0);
}

// ---------- read the saved content ----------
let content;
if (file) {
  content = JSON.parse(readFileSync(resolve(root, file), 'utf8'));
} else {
  const res = await fetch(`${url}/api/admin/api.php?action=export`, { headers: { 'X-Deploy-Token': token } });
  if (!res.ok) throw new Error(`[cms] ${url} refused the export (${res.status}). Check CMS_URL, and that CMS_TOKEN equals deploy_token in api/config.php.`);
  content = (await res.json()).content;
}
if (!content || typeof content !== 'object') throw new Error('[cms] The dashboard returned no content.');

// ---------- images ----------
mkdirSync(IMG_DIR, { recursive: true });
const keep = new Set();
const SAFE = /^\/media\/(library|seed|videos)\/[A-Za-z0-9/_.-]+$/;

// Images are taken from this project when they are in it (the seed, /media/seed/), otherwise downloaded from the site.
const img = async (value) => {
  if (!value?.path || !SAFE.test(value.path)) return null;
  const name = `${createHash('sha1').update(value.path).digest('hex').slice(0, 16)}${extname(value.path).toLowerCase()}`;
  const target = join(IMG_DIR, name);
  keep.add(name);
  if (!existsSync(target)) {
    const local = join(root, 'public', value.path);
    if (existsSync(local)) copyFileSync(local, target);
    else if (url) {
      const res = await fetch(`${url}${value.path}`);
      if (!res.ok) throw new Error(`[cms] could not download ${value.path} (${res.status})`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(`${target}.part`));
      renameSync(`${target}.part`, target);
    } else {
      console.warn(`[cms] skipped ${value.path}: not in the project, and no CMS_URL to download it from`);
      keep.delete(name);
      return null;
    }
  }
  return { file: name, width: value.width, height: value.height, ...(value.focus ? { focus: value.focus } : {}) };
};
const vid = (value) => (value?.path && SAFE.test(value.path) ? { src: value.path, width: value.width || 0, height: value.height || 0, duration: Math.round(value.duration || 0) } : null);
const all = (list, fn) => Promise.all((Array.isArray(list) ? list : []).map(fn));

// ---------- convert to the shape src/data/cms.ts reads ----------
const filmCat = new Map((content.filmCategories ?? []).map((c) => [c.id, c.slug]));
const photoCat = new Map((content.photoCategories ?? []).map((c) => [c.id, c.slug]));
const clientName = new Map((content.clients ?? []).map((c) => [c.id, c.name]));
const s = content.settings;
const h = content.home;

const out = {
  syncedAt: new Date().toISOString(),
  revision: content.revision ?? 0,
  settings: s ? { name: s.name, jobTitle: s.jobTitle, logoAlt: s.logoAlt, email: s.email, whatsapp: s.whatsapp, phone: s.phone, socials: (s.socials ?? []).filter((x) => x.label && x.href), logo: await img(s.logo), logoMark: await img(s.logoMark), logoWordmark: await img(s.logoWordmark) } : null,
  // Older content kept a single hero video in home.video.
  home: h ? { videos: (Array.isArray(h.videos) ? h.videos : h.video ? [{ video: h.video, videoMobile: h.videoMobile }] : []).map((v) => ({ video: vid(v.video), videoMobile: vid(v.videoMobile) })).filter((v) => v.video), poster: await img(h.poster), posterMobile: await img(h.posterMobile), aboutPhoto: await img(h.aboutPhoto) } : null,
  curve: (await all(content.curve?.items, async (c) => ({ kind: c.kind === 'video' ? 'video' : 'image', image: await img(c.image), video: vid(c.video), href: typeof c.href === 'string' && /^(https?:\/\/|\/)/.test(c.href.trim()) ? c.href.trim() : '' }))).filter((c) => (c.kind === 'video' ? c.video : c.image)),
  texts: content.texts && Object.keys(content.texts).length ? content.texts : null,
  filmCategories: (content.filmCategories ?? []).map((c) => ({ slug: c.slug, title: c.title })),
  films: (await all(content.films, async (f) => ({ slug: f.slug, title: f.title, description: f.description, featured: !!f.featured, onHome: f.onHome !== false, date: f.date, category: filmCat.get(f.categoryId), video: vid(f.video), poster: await img(f.poster) }))).filter((f) => f.slug && f.video && f.poster),
  photoCategories: (content.photoCategories ?? []).map((c) => ({ slug: c.slug, title: c.title })),
  albums: (await all(content.albums, async (a) => ({ slug: a.slug, title: a.title, onHome: a.onHome !== false, category: photoCat.get(a.categoryId), photos: (await all(a.photos, async (p) => ({ ...(await img(p)), alt: p.alt }))).filter((p) => p.file) }))).filter((a) => a.slug && a.photos.length),
  clients: (await all(content.clients, async (c) => ({ name: c.name, tone: !!c.tone, logo: await img(c.logo) }))).filter((c) => c.name && c.logo),
  reviews: (await all(content.reviews, async (r) => ({ client: clientName.get(r.clientId) ?? (r.name || '').trim(), sector: r.sector, quote: r.quote, rating: r.rating, placeholder: !!r.placeholder, logo: await img(r.logo) }))).filter((r) => r.client && r.quote),
  advice: (await all(content.advice, async (a) => ({ title: a.title, video: vid(a.video), poster: await img(a.poster) }))).filter((a) => a.title && a.video && a.poster),
};

// Images nothing points to any more (deleted in the dashboard).
for (const name of readdirSync(IMG_DIR)) if (!keep.has(name)) rmSync(join(IMG_DIR, name), { force: true });

writeFileSync(OUT_JSON, `${JSON.stringify(out, null, 2)}\n`);
console.log(`[cms] Revision ${out.revision}: ${out.films.length} films, ${out.albums.length} albums, ${out.clients.length} clients.`);
