// Where the dashboard lives. Deliberately not /admin or /login, which bots try first.
// To move it: change these two values, rename src/pages/mnvisual00.rec/ and public/api/mnvisual00/ to match,
// update DASHBOARD in astro.config.mjs and API in scripts/cms-sync.mjs, then delete the old folders on the server.
export const ADMIN_PATH = '/mnvisual00.rec/';
export const ADMIN_API = '/api/mnvisual00/api.php';
