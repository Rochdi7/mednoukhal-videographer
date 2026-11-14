// Turns the masters (wetransfer_* folders, gitignored) into the web deliverables:
//   photos  → src/assets/photos/<album>/<name>.avif   (3200px long edge, AVIF; Astro makes the smaller sizes)
//   posters → src/assets/films/<slug>.avif           (one still per film)
//   videos  → public/media/videos/                    (1080p films with sound, muted hero loops + portrait crops)
//   sizes   → src/data/media-manifest.json            (width, height, running time of each film)
// Idempotent: existing outputs are skipped. Pass --force to rebuild them, --images to skip the video encodes.
// The first hero loop (hero-1080/720/portrait.mp4) was cut from an older master and is kept as it is.
// Run with: npm run media
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const VIDEO_SRC = path.join(ROOT, 'wetransfer_med_2026-11-13_2004');
const VIDEO_OUT = path.join(ROOT, 'public/media/videos');
const ASSETS = path.join(ROOT, 'src/assets');
const force = process.argv.includes('--force');
const imagesOnly = process.argv.includes('--images');

// One folder per album, as delivered.
const ALBUMS = {
  wedding: 'wetransfer_mn_06327-jpg_2026-11-14_0040',
  kaftan: 'wetransfer_untitled-transfer_2026-11-14_0056',
  family: 'wetransfer_mn_00537-jpg_2026-11-14_0056',
};

// The films: master, poster frame (s), the hero file name, and the part used as the short preview
// (carousel and hover; start, length in s). The hero always plays the whole film, then the next one starts.
const FILMS = {
  'naoual-live-on-stage': { master: 'naoual .mp4', poster: 32.5, hero: 'hero-naoual', previewStart: 36, previewLen: 15 },
  'medina-stories': { master: 'reel pvr26.mp4', poster: 11.5, hero: 'hero-medina', previewStart: 0, previewLen: 15.4 },
  'essaouira-atlantic-soul': { master: 'Sequence 03_2.mp4', poster: 8.4, hero: 'hero-essaouira', previewStart: 0, previewLen: 10.9 },
};

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr}`);
  return r.stdout + r.stderr;
}
const fresh = (f) => !force && fs.existsSync(f) && fs.statSync(f).size > 0;
// AVIF at quality 64 / 4:4:4 is visually identical to the masters at a fraction of the weight.
const avif = (input, out, size) =>
  sharp(input).rotate().resize(size, size, { fit: 'inside', withoutEnlargement: true }).avif({ quality: 64, effort: 6, chromaSubsampling: '4:4:4' }).toFile(out);

for (const d of [VIDEO_OUT, path.join(ASSETS, 'films'), ...Object.keys(ALBUMS).map((a) => path.join(ASSETS, 'photos', a))]) fs.mkdirSync(d, { recursive: true });

// --- Photos ---
await Promise.all(
  Object.entries(ALBUMS).flatMap(([album, dir]) =>
    fs.readdirSync(path.join(ROOT, dir)).filter((f) => /\.jpe?g$/i.test(f)).map(async (file) => {
      const out = path.join(ASSETS, 'photos', album, `${path.parse(file).name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.avif`);
      if (fresh(out)) return;
      await avif(path.join(ROOT, dir, file), out, 3200);
      console.log('photo', album, path.basename(out), `${(fs.statSync(path.join(ROOT, dir, file)).size / 1e6).toFixed(1)} MB → ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
    }),
  ),
);

// --- Posters ---
for (const [slug, f] of Object.entries(FILMS)) {
  const out = path.join(ASSETS, 'films', `${slug}.avif`);
  if (fresh(out)) continue;
  const tmp = path.join(os.tmpdir(), `mn-poster-${slug}.png`);
  run('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-ss', String(f.poster), '-i', path.join(VIDEO_SRC, f.master), '-frames:v', '1', '-update', '1', tmp]);
  await avif(tmp, out, 1920);
  fs.rmSync(tmp, { force: true });
  console.log('poster', slug);
}
// showreel.avif (a still of the first hero loop) is kept as it is.
console.log('images done');
if (imagesOnly) process.exit(0);

// --- Videos ---
// Films: 1080p H.264 with sound (the 4K masters are 20–30 Mbps; CRF 22 capped at 6 Mbps looks the same on the web
// and keeps every file under GitHub's 50 MB warning). Previews: a short cut (previewStart/previewLen) at 720p with sound, for the muted carousel
// and hover previews (the carousel has a sound button).
// Hero loops: muted, 25 fps (the hero timecode counts 25 fps), plus a 9:16 centre crop for phones held upright.
const x264 = (crf, max) => ['-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-maxrate', max, '-bufsize', `${parseInt(max) * 2}${max.replace(/\d+/, '')}`, '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
for (const [slug, f] of Object.entries(FILMS)) {
  const master = path.join(VIDEO_SRC, f.master);
  const film = path.join(VIDEO_OUT, `${slug}.mp4`);
  if (!fresh(film)) run('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', master, '-vf', 'scale=1920:1080:flags=lanczos', ...x264('22', '6M'), '-c:a', 'aac', '-b:a', '160k', film]);
  const cut = ['-i', master, '-an'];
  const preview = path.join(VIDEO_OUT, `${slug}-preview.mp4`);
  if (!fresh(preview)) run('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-ss', String(f.previewStart), '-t', String(f.previewLen), '-i', master,'-vf', 'scale=1280:720:flags=lanczos', ...x264('23', '2500k'), '-c:a', 'aac', '-b:a', '128k', '-af', 'afade=t=in:d=0.3', preview]);
  const wide = path.join(VIDEO_OUT, `${f.hero}-1080.mp4`);
  if (!fresh(wide)) run('ffmpeg', ['-nostdin', '-v', 'error', '-y', ...cut, '-vf', 'fps=25,scale=1920:1080:flags=lanczos', ...x264('24', '3500k'), wide]);
  const tall = path.join(VIDEO_OUT, `${f.hero}-portrait.mp4`);
  if (!fresh(tall)) run('ffmpeg', ['-nostdin', '-v', 'error', '-y', ...cut, '-vf', 'fps=25,crop=ih*9/16:ih,scale=576:1024:flags=lanczos', ...x264('26', '1500k'), tall]);
  console.log('video', slug);
}

// --- Manifest: what the film pages and the VideoObject data need ---
const probe = (file) => {
  const info = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file]));
  return { width: info.streams[0].width, height: info.streams[0].height, duration: Math.round(Number(info.format.duration)) };
};
const manifest = {};
for (const [slug, f] of Object.entries(FILMS)) {
  manifest[slug] = { src: `/media/videos/${slug}.mp4`, preview: `/media/videos/${slug}-preview.mp4`, ...probe(path.join(VIDEO_OUT, `${slug}.mp4`)), uploadDate: fs.statSync(path.join(VIDEO_SRC, f.master)).mtime.toISOString() };
}
manifest.showreel = { src: '/media/videos/hero-1080.mp4', ...probe(path.join(VIDEO_OUT, 'hero-1080.mp4')), uploadDate: '2026-11-09T01:01:27.073Z' };
fs.writeFileSync(path.join(ROOT, 'src/data/media-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log('ALL DONE');
