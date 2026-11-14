// The site's built-in texts (EN/FR/AR), for the live editor on the pages (src/scripts/live-edit.ts).
import { strings } from '../../i18n/strings';

export const GET = () => new Response(JSON.stringify(strings), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
