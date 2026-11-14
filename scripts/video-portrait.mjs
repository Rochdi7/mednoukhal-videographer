// Makes the 9:16 phone cut of a landscape video: a centred crop, at most 576×1024, muted, H.264, starting
// to play before it has fully downloaded (faststart). Used by scripts/cms-sync.mjs for every homepage hero film,
// so the dashboard only ever asks for the landscape file. Needs ffmpeg on the PATH.
//
//   node scripts/video-portrait.mjs <input.mp4> [output.mp4]      one file by hand (default: <input>-portrait.mp4)
import { spawnSync } from 'node:child_process';
import { renameSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Bump when the crop or encode settings change, so cached cuts are made again.
export const PORTRAIT_VERSION = 1;

let ffmpegFound;
export const hasFfmpeg = () => (ffmpegFound ??= spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0);

/** Writes the portrait cut of `input` to `output`. Returns its { width, height }. */
export function portraitCut(input, output, { maxHeight = 1024 } = {}) {
  // Height follows the source (never enlarged), width is 9/16 of it; both even, as H.264 needs.
  const scale = `scale=-2:'min(${maxHeight},ih)':flags=lanczos`;
  const crop = "crop='trunc(ih*9/16/2)*2':ih";
  const part = `${output}.part.mp4`;
  const run = spawnSync('ffmpeg', [
    '-nostdin', '-v', 'error', '-y', '-i', input, '-an',
    '-vf', `${crop},${scale},setsar=1`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-maxrate', '2500k', '-bufsize', '5000k',
    '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', part,
  ], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (run.status !== 0) {
    rmSync(part, { force: true });
    throw new Error(`ffmpeg could not cut ${input}:\n${run.stderr}`);
  }
  renameSync(part, output);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', output], { encoding: 'utf8' });
  const [width, height] = (probe.stdout || '').trim().split('x').map(Number);
  return { width: width || 576, height: height || maxHeight };
}

// Command line use.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [input, output = input?.replace(/\.mp4$/i, '') + '-portrait.mp4'] = process.argv.slice(2);
  if (!input) {
    console.log('Usage: node scripts/video-portrait.mjs <input.mp4> [output.mp4]');
    process.exit(1);
  }
  if (!hasFfmpeg()) throw new Error('ffmpeg is not installed (check: ffmpeg -version).');
  const size = portraitCut(input, output);
  console.log(`${output}  ${size.width}×${size.height}`);
}
