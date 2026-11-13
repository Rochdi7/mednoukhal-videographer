// Runs the dashboard on this computer: builds the site from the local dashboard content (mn-data/content.json,
// created on first sign-in from the seed), then serves dist/ with PHP so /admin and its API work.
//   npm run admin:local   →   http://127.0.0.1:4322/admin/
// Port 4322, so it never clashes with `astro dev` on 4321 (another one: set ADMIN_PORT).
// The login comes from mn-config.php (npm run admin:password -- --local).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

if (!existsSync(new URL('../mn-config.php', import.meta.url))) {
  console.log('No local login yet. Run first:  npm run admin:password -- --local');
  process.exit(1);
}
const port = process.env.ADMIN_PORT || '4322';
const library = fileURLToPath(new URL('../public/media/library', import.meta.url));
const env = { ...process.env, MN_LIBRARY_DIR: library, ...(existsSync(new URL('../mn-data/content.json', import.meta.url)) ? { CMS_FILE: 'mn-data/content.json' } : {}) };
const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', env, shell: true });
if (build.status !== 0) process.exit(build.status ?? 1);
console.log(`\nDashboard: http://127.0.0.1:${port}/admin/   (site: http://127.0.0.1:${port}/)\nAfter saving, run this again to see the changes on the local site.\n`);
spawn('php', ['-S', `127.0.0.1:${port}`, '-t', 'dist', 'scripts/admin-router.php'], { stdio: 'inherit', env, shell: true });
