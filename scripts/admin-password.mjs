// Makes the dashboard login.
//   npm run admin:password                     asks, then prints the two lines for api/config.php on the server
//   npm run admin:password -- --local          asks, then writes them to mn-config.php for `npm run admin:local`
//   npm run admin:password -- --email you@x.com --password '…' [--local]   without questions
// The hash is made by PHP's password_hash, the same function the server uses to check it.
// The password can be changed afterwards from the dashboard (Account).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const MIN = 8;
const DEFAULT_EMAIL = 'mednoukhal00@gmail.com';
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const local = args.includes('--local');
const validEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

let email = arg('email')?.trim().toLowerCase();
let password = arg('password');

if (!email || !password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // Asks again on a wrong answer instead of stopping.
  while (!email || !validEmail(email)) {
    const answer = (await rl.question(`Sign-in email [${DEFAULT_EMAIL}]: `)).trim().toLowerCase();
    email = answer || DEFAULT_EMAIL;
    if (!validEmail(email)) console.log('  That is not an email address, try again.');
  }
  while (!password || password.length < MIN) {
    password = await rl.question(`Password (at least ${MIN} characters): `);
    if (password.length < MIN) console.log(`  At least ${MIN} characters, try again.`);
  }
  rl.close();
}
if (!validEmail(email)) throw new Error('That is not an email address.');
if (password.length < MIN) throw new Error(`The password needs at least ${MIN} characters.`);
if (password.length < 12) console.log(`\n  Note: a short password is fine for now; change it to a longer one in the dashboard (Account) before going live.`);

const php = spawnSync('php', ['-r', 'echo password_hash(stream_get_contents(STDIN), PASSWORD_DEFAULT);'], { input: password, encoding: 'utf8' });
if (php.status !== 0 || !php.stdout.startsWith('$')) throw new Error(`PHP is needed to make the hash (check: php -v). ${php.stderr ?? ''}`);
const hash = php.stdout.trim();

const lines = `    'admin_email' => '${email}',\n    'admin_password_hash' => '${hash}',`;
if (local) {
  const file = new URL('../mn-config.php', import.meta.url);
  const keep = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter((l) => /^\s*'(?!admin_email|admin_password_hash)/.test(l)).join('\n') : '';
  writeFileSync(file, `<?php\n// Local dashboard settings (never deployed, never committed). Overrides public/api/config.php.\nreturn [\n${lines}\n${keep ? `${keep}\n` : ''}];\n`);
  // A password changed in the local dashboard is kept in mn-data/auth.json and would win over this one.
  const saved = new URL('../mn-data/auth.json', import.meta.url);
  if (existsSync(saved)) writeFileSync(saved, JSON.stringify({ email, hash }));
  console.log(`\nLocal login set for ${email}. Dashboard: npm run admin:local → http://127.0.0.1:4322/admin/`);
} else {
  console.log('\nPaste these two lines into public_html/api/config.php on the server (replacing the empty ones):\n');
  console.log(lines);
}
