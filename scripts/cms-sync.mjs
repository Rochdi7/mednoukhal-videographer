// Runs before every build: copies the dashboard's saved content into the project.
//   - content → src/data/cms.json   (read by src/data/*.ts, src/config/site.ts and t() in src/i18n)
//   - images  → src/assets/cms/     (so Astro still makes the AVIF/WebP sizes)
// Videos are not copied: they stay where the dashboard uploaded them on Hostinger and the pages point to them.
// The one exception: the 9:16 phone cut of each hero film, made here (public/media/auto/) and shipped with the site.
//
// Where the content comes from (.env, or GitHub secrets in the deploy):
//   CMS_URL + CMS_TOKEN   the live site, e.g. https://mednoukhal.com and the deploy_token from api/config.php
//   CMS_FILE              or a local content.json (for testing: mn-data/content.json from `npm run admin:local`)
// With neither set it does nothing, and the site builds from the content written in the code.
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, extname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { ROOT } from './cms-lib.mjs';
import { PORTRAIT_VERSION, hasFfmpeg, portraitCut } from './video-portrait.mjs';

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
  // The dashboard API (ADMIN_API in src/config/admin.ts).
  const res = await fetch(`${url}/api/mnvisual00/api.php?action=export`, { headers: { 'X-Deploy-Token': token } });
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
  // Keep a readable file name (it ends up in the built image URLs), plus a hash of the path so names never clash.
  const ext = extname(value.path).toLowerCase();
  const stem = basename(value.path, extname(value.path)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const hash = createHash('sha1').update(value.path).digest('hex').slice(0, 8);
  const name = `${stem && !/^[0-9a-f]{16,}$/.test(stem) ? `${stem}-` : ''}${hash}${ext}`;
  const target = join(IMG_DIR, name);
  keep.add(name);
  const local = join(root, 'public', value.path);
  // A file of the project (the seed) can be replaced at the same address (a new logo): copy it again when it differs.
  // Dashboard uploads get a new random name each time, so a downloaded copy never goes stale.
  if (existsSync(local)) {
    if (!existsSync(target) || !readFileSync(local).equals(readFileSync(target))) copyFileSync(local, target);
  } else if (!existsSync(target)) {
    if (url) {
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

// ---------- phone cuts of the hero films ----------
// Each landscape hero film without its own mobile version gets a 9:16 centred cut (scripts/video-portrait.mjs),
// written to public/media/auto/ so it ships with the site. Cuts are kept between builds and remade only for new films.
const AUTO_DIR = join(root, 'public/media/auto');
const SOURCE_CACHE = join(root, 'node_modules/.cache/mn-videos');
mkdirSync(AUTO_DIR, { recursive: true });
const keepCuts = new Set();
const portraitOf = async (value) => {
  const source = vid(value);
  if (!source || !(source.width > source.height)) return null;
  const stem = basename(value.path, '.mp4').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const hash = createHash('sha1').update(`${value.path}#${PORTRAIT_VERSION}`).digest('hex').slice(0, 8);
  const name = `${/^[0-9a-f]{16,}$/.test(stem) ? 'hero' : stem}-${hash}-portrait.mp4`;
  const target = join(AUTO_DIR, name);
  const meta = `${target}.json`;
  if (!existsSync(target) || !existsSync(meta)) {
    if (!hasFfmpeg()) {
      console.warn(`[cms] no ffmpeg: ${value.path} has no phone cut, phones crop the landscape film instead`);
      return null;
    }
    let input = join(root, 'public', value.path);
    if (!existsSync(input)) {
      if (!url) return null;
      mkdirSync(SOURCE_CACHE, { recursive: true });
      input = join(SOURCE_CACHE, basename(value.path));
      if (!existsSync(input)) {
        const res = await fetch(`${url}${value.path}`);
        if (!res.ok) throw new Error(`[cms] could not download ${value.path} (${res.status})`);
        await pipeline(Readable.fromWeb(res.body), createWriteStream(`${input}.part`));
        renameSync(`${input}.part`, input);
      }
    }
    console.log(`[cms] Phone cut of ${value.path}…`);
    writeFileSync(meta, JSON.stringify(portraitCut(input, target)));
  }
  keepCuts.add(name).add(`${name}.json`);
  const size = JSON.parse(readFileSync(meta, 'utf8'));
  return { src: `/media/auto/${name}`, width: size.width, height: size.height, duration: source.duration };
};
// Hero films: their own mobile version if the content still has one, else the automatic cut.
const heroFilms = async (list) => {
  const out = [];
  for (const v of list) {
    const video = vid(v.video);
    if (video) out.push({ video, videoMobile: vid(v.videoMobile) ?? (await portraitOf(v.video)) });
  }
  return out;
};

// Photos for the homepage carousel: those ticked in the dashboard; in an album where none was ever ticked
// (content saved before the option existed), its first two.
const homeFlags = (photos) => {
  const list = Array.isArray(photos) ? photos : [];
  const set = list.some((p) => typeof p?.home === 'boolean');
  return list.map((p, i) => (set ? p.home === true : i < 2));
};

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
  home: h ? { videos: await heroFilms(Array.isArray(h.videos) ? h.videos : h.video ? [{ video: h.video, videoMobile: h.videoMobile }] : []), poster: await img(h.poster), posterMobile: await img(h.posterMobile), aboutPhoto: await img(h.aboutPhoto) } : null,
  curve: (await all(content.curve?.items, async (c) => ({ kind: c.kind === 'video' ? 'video' : 'image', image: await img(c.image), video: vid(c.video), href: typeof c.href === 'string' && /^(https?:\/\/|\/)/.test(c.href.trim()) ? c.href.trim() : '' }))).filter((c) => (c.kind === 'video' ? c.video : c.image)),
  texts: content.texts && Object.keys(content.texts).length ? content.texts : null,
  filmCategories: (content.filmCategories ?? []).map((c) => ({ slug: c.slug, title: c.title })),
  films: (await all(content.films, async (f) => ({ slug: f.slug, title: f.title, description: f.description, featured: !!f.featured, onHome: f.onHome !== false, date: f.date, category: filmCat.get(f.categoryId), video: vid(f.video), poster: await img(f.poster) }))).filter((f) => f.slug && f.video && f.poster),
  photoCategories: (content.photoCategories ?? []).map((c) => ({ slug: c.slug, title: c.title })),
  albums: (await all(content.albums, async (a) => ({ slug: a.slug, title: a.title, onHome: a.onHome !== false, category: photoCat.get(a.categoryId), photos: await (async () => { const home = homeFlags(a.photos); return (await all(a.photos, async (p, i) => ({ ...(await img(p)), alt: p.alt, home: home[i] }))).filter((p) => p.file); })() }))).filter((a) => a.slug && a.photos.length),
  clients: (await all(content.clients, async (c) => ({ name: c.name, tone: !!c.tone, logo: await img(c.logo) }))).filter((c) => c.name && c.logo),
  reviews: (await all(content.reviews, async (r) => ({ client: clientName.get(r.clientId) ?? (r.name || '').trim(), sector: r.sector, quote: r.quote, rating: r.rating, placeholder: !!r.placeholder, logo: await img(r.logo) }))).filter((r) => r.client && r.quote),
};

// Images nothing points to any more (deleted in the dashboard).
for (const name of readdirSync(IMG_DIR)) if (!keep.has(name)) rmSync(join(IMG_DIR, name), { force: true });
// Phone cuts of hero films that were replaced or removed.
for (const name of readdirSync(AUTO_DIR)) if (!keepCuts.has(name)) rmSync(join(AUTO_DIR, name), { force: true });

writeFileSync(OUT_JSON, `${JSON.stringify(out, null, 2)}\n`);
console.log(`[cms] Revision ${out.revision}: ${out.films.length} films, ${out.albums.length} albums, ${out.clients.length} clients.`);
