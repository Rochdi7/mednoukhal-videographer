// Turns preview.mp4 and the photo masters into the web deliverables.
// Idempotent: existing outputs are skipped. Pass --force to rebuild them.
// Run with: npm run media
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const PREVIEW = path.join(ROOT, 'preview.mp4');
const PHOTO_SRC = path.join(ROOT, 'wetransfer__mn_0497-copy-jpg_2026-11-09_0033');
const VIDEO_OUT = path.join(ROOT, 'public/media/videos');
const ASSETS = path.join(ROOT, 'src/assets');
const force = process.argv.includes('--force');

// The one clip stands in for every film until the real projects are added.
// Each slot gets its own frame so the carousels can be judged with some variety.
const POSTERS = {
  'project-01': 0.5,
  'project-02': 4.5,
  'project-03': 5.6,
  'project-04': 8.4,
  'project-05': 9.5,
  'project-06': 12.5,
  'project-07': 14.2,
  'project-08': 16.5,
  showreel: 15.5,
  'coaching-film': 7,
};
const ADVICE_FRAMES = { 'preview-01': 6.5, 'preview-02': 8.2, 'preview-03': 11, 'preview-04': 15 };

// The burned-in "Directed + edited" title ends before 4s; it would clash with the hero logo.
const HERO_START = 4;
const HERO_LEN = 13.7;
const HERO_STILL = 6;
const PORTRAIT_CROP = 'crop=ih*9/16:ih:iw*0.55-ow/2:0'; // the subject stands slightly right of centre

// Albums group the photographs by what they actually show.
const PHOTOS = {
  portraits: ['MN_00851.jpg', 'MN_09118.jpg', 'MN_09093.jpg', 'MN_00537.jpg'],
  caftan: ['MN_09426.jpg', 'MN_09906.jpg', 'MN_09014.jpg'],
  table: ['DSC00445-Enhanced-NR copy.jpg', 'DSC00609-Enhanced-NR copy.jpg', '_MN_2730.jpg'],
  interiors: ['_MN_0500 copy.jpg', '_MN_0497 copy.jpg', 'MN_09002.jpg', 'DSC02040-Enhanced-NR copy.jpg'],
  craft: ['DSC00303 copy.jpg', 'MN_03356.jpg'],
};

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr}`);
  return r.stdout + r.stderr;
}

const fresh = (f) => !force && fs.existsSync(f) && fs.statSync(f).size > 0;
const still = (at, vf, out) => {
  if (!fresh(out)) run('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-ss', String(at), '-i', PREVIEW, '-frames:v', '1', '-vf', vf, '-q:v', '2', '-update', '1', out]);
};

for (const d of [VIDEO_OUT, ...['films', 'hero', 'photos', 'advice'].map((s) => path.join(ASSETS, s))]) {
  fs.mkdirSync(d, { recursive: true });
}

// --- Stills ---
for (const [name, at] of Object.entries(POSTERS)) still(at, 'scale=iw:-2', path.join(ASSETS, 'films', `${name}.jpg`));
for (const [name, at] of Object.entries(ADVICE_FRAMES)) still(at, 'scale=1280:-2:flags=lanczos', path.join(ASSETS, 'advice', `${name}.jpg`));
still(HERO_STILL, 'scale=iw:-2', path.join(ASSETS, 'hero/hero.jpg'));
still(HERO_STILL, PORTRAIT_CROP, path.join(ASSETS, 'hero/hero-portrait.jpg'));

// The masters reach 41 MB each; 2400px on the long edge covers the album viewer.
for (const [album, files] of Object.entries(PHOTOS)) {
  for (const [i, file] of files.entries()) {
    const out = path.join(ASSETS, 'photos', `${album}-${String(i + 1).padStart(2, '0')}.jpg`);
    if (fresh(out)) continue;
    await sharp(path.join(PHOTO_SRC, file)).rotate().resize(2400, 2400, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90, chromaSubsampling: '4:4:4', mozjpeg: true }).toFile(out);
    console.log('photo', path.basename(out));
  }
}
console.log('stills done');

// --- Video deliverables ---
// The hero loop sits under a dark gradient and film grain, so it tolerates a higher CRF with no visible loss.
// Three sizes: phones get the portrait crop, laptops 720p, large screens the full frame (see the <source> media queries).
for (const [name, vfStart, crf] of [
  ['hero-1080.mp4', null, '28'],
  ['hero-720.mp4', 'scale=1280:-2:flags=lanczos', '27'],
  ['hero-portrait.mp4', PORTRAIT_CROP, '29'],
]) {
  const out = path.join(VIDEO_OUT, name);
  if (fresh(out)) continue;
  const fades = `fade=t=in:st=0:d=0.6,fade=t=out:st=${HERO_LEN - 0.6}:d=0.6`;
  const vf = [vfStart, 'fps=25', fades].filter(Boolean).join(',');
  run('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-ss', String(HERO_START), '-t', String(HERO_LEN), '-i', PREVIEW, '-an', '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  console.log('video', name);
}

const preview = path.join(VIDEO_OUT, 'preview.mp4');
// Re-encoded rather than copied: the camera export is Baseline at 6 Mbps; High profile at CRF 23 looks the same at ~65% of the size.
if (!fresh(preview)) run('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', PREVIEW, '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', preview]);

const info = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', preview]));
fs.writeFileSync(
  path.join(ROOT, 'src/data/media-manifest.json'),
  JSON.stringify(
    {
      preview: {
        width: info.streams[0].width,
        height: info.streams[0].height,
        duration: Math.round(Number(info.format.duration)),
        uploadDate: fs.statSync(PREVIEW).mtime.toISOString(),
      },
    },
    null,
    2,
  ),
);
console.log('ALL DONE');
