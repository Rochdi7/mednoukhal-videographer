// Runs the dashboard on this computer: builds the site from the local dashboard content (mn-data/content.json,
// created on first sign-in from the seed), then serves dist/ with PHP so the dashboard and its API work.
//   npm run admin:local   →   http://127.0.0.1:4322/mnvisual00.rec/
// Port 4322, so it never clashes with `astro dev` on 4321 (another one: set ADMIN_PORT).
// The login comes from mn-config.php (npm run admin:password -- --local).
//
// "Publish" in the dashboard works here too: the API leaves mn-data/publish-request.json, this script rebuilds the
// site into .local-build/ and copies it over dist/ (the site keeps running meanwhile), then writes mn-data/build.json,
// which the dashboard reads to show "Publishing…" and then "Published".
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, watchFile, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
if (!existsSync(join(root, 'mn-config.php'))) {
  console.log('No local login yet. Run first:  npm run admin:password -- --local');
  process.exit(1);
}
const port = process.env.ADMIN_PORT || '4322';
const DATA = join(root, 'mn-data');
const REQUEST = join(DATA, 'publish-request.json');
const STATUS = join(DATA, 'build.json');
const DIST = join(root, 'dist');
const NEXT = join(root, '.local-build');
const library = join(root, 'public/media/library');
mkdirSync(DATA, { recursive: true });

// CMS_FILE is set per build: mn-data/content.json only exists after the first sign-in.
const buildEnv = (extra = {}) => ({ ...process.env, MN_LIBRARY_DIR: library, ...(existsSync(join(DATA, 'content.json')) ? { CMS_FILE: 'mn-data/content.json' } : {}), ...extra });
const status = (s) => writeFileSync(STATUS, JSON.stringify(s));

const first = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', env: buildEnv(), shell: true, cwd: root });
if (first.status !== 0) process.exit(first.status ?? 1);
status({ status: 'completed', conclusion: 'success', startedAt: new Date().toISOString() });

console.log(`\nDashboard: http://127.0.0.1:${port}/mnvisual00.rec/   (site: http://127.0.0.1:${port}/)\n"Publish" in the dashboard rebuilds this local site.\n`);
spawn('php', ['-S', `127.0.0.1:${port}`, '-t', 'dist', 'scripts/admin-router.php'], { stdio: 'inherit', env: { ...process.env, MN_LIBRARY_DIR: library, MN_LOCAL_PUBLISH: '1' }, shell: true, cwd: root });

// Copies the new build over dist/, then removes what the new build no longer has. dist/ is never empty on the way.
const swap = () => {
  cpSync(NEXT, DIST, { recursive: true, force: true });
  const prune = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (!existsSync(join(NEXT, relative(DIST, path)))) rmSync(path, { recursive: true, force: true });
      else if (statSync(path).isDirectory()) prune(path);
    }
  };
  prune(DIST);
  rmSync(NEXT, { recursive: true, force: true });
};

let building = false;
let again = false;
const rebuild = () => {
  if (building) {
    again = true;
    return;
  }
  building = true;
  const startedAt = new Date().toISOString();
  status({ status: 'in_progress', conclusion: null, startedAt });
  console.log('\n[admin:local] Publish: rebuilding the site…');
  rmSync(NEXT, { recursive: true, force: true });
  const child = spawn('npm', ['run', 'build'], { stdio: 'inherit', env: buildEnv({ MN_OUT_DIR: './.local-build' }), shell: true, cwd: root });
  child.on('exit', (code) => {
    let ok = code === 0;
    if (ok) {
      try {
        swap();
      } catch (err) {
        ok = false;
        console.error('[admin:local] Could not copy the new build into dist/:', err);
      }
    }
    status({ status: 'completed', conclusion: ok ? 'success' : 'failure', startedAt });
    console.log(ok ? '[admin:local] Published: refresh the site.' : '[admin:local] The build failed (see above).');
    building = false;
    if (again) {
      again = false;
      rebuild();
    }
  });
};

// Polls the request file once a second (fs.watch is unreliable on Windows for files written by rename).
watchFile(REQUEST, { interval: 1000 }, (now, before) => {
  if (now.mtimeMs && now.mtimeMs !== before.mtimeMs) rebuild();
});
