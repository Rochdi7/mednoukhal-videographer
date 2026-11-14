// Writes the dashboard's starting content from what the site shows today:
//   public/api/admin/seed.json   films, albums, both category lists, hero, logo, settings, clients, reviews
//   public/media/seed/…          the images they use, at stable addresses (videos keep their /media/videos/ paths)
// The dashboard loads seed.json the first time it opens on the server (when it has no content yet), so it starts
// with every current film and album. Run again after changing the content in the code:  npm run cms:seed
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import sharp from 'sharp';
import { probe } from './cms-lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const SEED_DIR = join(root, 'public/media/seed');

// With a synced cms.json present the data modules would return the dashboard's content, not the code's.
if (existsSync(join(root, 'src/data/cms.json'))) {
  console.error('src/data/cms.json exists: delete it first, so the seed is made from the content in the code.');
  process.exit(1);
}

// Load the site's data modules through Vite, so `import x from './a.jpg'` and import.meta.glob resolve to file paths.
const vite = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
const load = (path) => vite.ssrLoadModule(path);
const [{ SITE }, { ALL_FILMS }, { ALBUMS }, { CLIENTS }, reviewsModule] = await Promise.all([
  load('/src/config/site.ts'),
  load('/src/data/films.ts'),
  load('/src/data/photos.ts'),
  load('/src/data/clients.ts'),
  load('/src/data/reviews.ts'),
]);
await vite.close();

rmSync(SEED_DIR, { recursive: true, force: true });

const sourceOf = (ref) => {
  const path = String(ref?.src ?? ref).split('?')[0];
  const file = [join(root, path), join(root, 'public', path)].find((p) => existsSync(p));
  if (!file) throw new Error(`File not found: ${path}`);
  return file;
};

// Copies an image to /media/seed/<group>/<name> and records its size.
const image = async (ref, group, name, extra = {}) => {
  const from = sourceOf(ref);
  const target = join(SEED_DIR, group, `${name}${extname(from).toLowerCase()}`);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(from, target);
  const { width, height } = await sharp(from).metadata();
  return { path: `/media/seed/${group}/${name}${extname(from).toLowerCase()}`, width, height, ...extra };
};
// Videos already sit in public/media/videos/, so they are referenced where they are.
const video = (src) => {
  const path = String(src);
  if (!path.startsWith('/media/videos/')) throw new Error(`Unexpected video path: ${path}`);
  return { path, ...probe(join(root, 'public', path)) };
};

let n = 0;
const id = (prefix) => `${prefix}-${(n++).toString(36).padStart(3, '0')}`;

// The current films and albums are placeholders: they are spread over categories so each category has something to show.
const filmCategories = [
  { slug: 'commercials', title: { en: 'Commercials', fr: 'Publicités', ar: 'إعلانات' } },
  { slug: 'brand-films', title: { en: 'Brand films', fr: 'Films de marque', ar: 'أفلام العلامات التجارية' } },
  { slug: 'music-videos', title: { en: 'Music videos', fr: 'Clips musicaux', ar: 'كليبات موسيقية' } },
  { slug: 'documentaries', title: { en: 'Documentaries', fr: 'Documentaires', ar: 'أفلام وثائقية' } },
].map((c) => ({ id: id('fc'), ...c }));

const photoCategories = [
  { slug: 'portraits-fashion', title: { en: 'Portraits & Fashion', fr: 'Portraits & Mode', ar: 'بورتريه وأزياء' }, albums: ['portraits', 'caftan'] },
  { slug: 'hospitality', title: { en: 'Hospitality & Food', fr: 'Hôtellerie & Gastronomie', ar: 'الضيافة وفن الطهي' }, albums: ['table', 'interiors'] },
  { slug: 'craft-performance', title: { en: 'Craft & Performance', fr: 'Artisanat & Spectacle', ar: 'الحرف والعروض' }, albums: ['craft'] },
].map((c) => ({ id: id('pc'), ...c }));

const films = [];
for (const [i, f] of ALL_FILMS.entries()) {
  films.push({
    id: id('film'),
    slug: f.slug,
    title: f.title,
    description: f.description,
    categoryId: filmCategories[f.featured ? 0 : (i - 1 + filmCategories.length) % filmCategories.length].id,
    featured: !!f.featured,
    onHome: f.onHome !== false,
    date: String(f.uploadDate).slice(0, 10),
    video: video(f.src),
    poster: await image(f.poster, 'films', f.slug),
  });
}

const albums = [];
for (const a of ALBUMS) {
  const photos = [];
  for (const [i, p] of a.photos.entries()) photos.push({ id: id('ph'), ...(await image(p.image, `albums/${a.slug}`, String(i + 1).padStart(2, '0')) ), alt: p.alt });
  const category = photoCategories.find((c) => c.albums.includes(a.slug)) ?? photoCategories[0];
  albums.push({ id: id('album'), slug: a.slug, title: a.title, categoryId: category.id, onHome: true, photos });
}

const clients = [];
for (const c of CLIENTS) clients.push({ id: id('client'), name: c.name, tone: !!c.tone, logo: await image(c.logo, 'clients', c.name.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')) });
const clientId = new Map(clients.map((c) => [c.name, c.id]));
const reviews = (reviewsModule.reviews ?? []).map((r) => ({ id: id('review'), clientId: clientId.get(r.client), name: '', logo: null, sector: r.sector, quote: r.quote, rating: r.rating, placeholder: !!r.placeholder }));

const seed = {
  settings: {
    name: SITE.name,
    jobTitle: SITE.jobTitle,
    logoAlt: SITE.logoAlt,
    email: SITE.email ?? '',
    whatsapp: SITE.whatsapp ?? '',
    phone: SITE.phone ?? '',
    socials: SITE.socials.map((s) => ({ id: id('social'), label: s.label, handle: s.handle ?? '', href: s.href, icon: s.icon })),
    logo: await image('/src/assets/branding/mn-visual-lockup.png', 'branding', 'logo'),
    logoMark: await image('/src/assets/branding/mn-visual-mark.png', 'branding', 'mark'),
    logoWordmark: await image('/src/assets/branding/mednoukhal-wordmark.png', 'branding', 'wordmark'),
  },
  home: {
    // The hero films, played in order (one loops).
    videos: [{ id: id('hero'), video: video('/media/videos/hero-1080.mp4'), videoMobile: video('/media/videos/hero-portrait.mp4') }],
    poster: await image('/src/assets/hero/hero.jpg', 'hero', 'poster'),
    posterMobile: await image('/src/assets/hero/hero-portrait.jpg', 'hero', 'poster-portrait'),
    aboutPhoto: await image('/src/assets/films/about-portrait.jpg', 'hero', 'about', { focus: '50% 40%' }),
  },
  // Empty: the dashboard shows the built-in texts and stores only what is changed.
  texts: {},
  // Empty: the closing carousel shows the album photos until cards are added in the dashboard.
  curve: { items: [] },
  filmCategories: filmCategories.map(({ id: cid, slug, title }) => ({ id: cid, slug, title })),
  films,
  photoCategories: photoCategories.map(({ id: cid, slug, title }) => ({ id: cid, slug, title })),
  albums,
  clients,
  reviews,
};

writeFileSync(join(root, 'public/api/admin/seed.json'), `${JSON.stringify(seed, null, 2)}\n`);
console.log(`Seed written: ${films.length} films, ${albums.length} albums, ${clients.length} clients, ${reviews.length} reviews.`);
