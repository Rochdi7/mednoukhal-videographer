import type { APIRoute } from 'astro';

// The dashboard is not listed here on purpose: robots.txt is public, so naming it would point to it.
// It is kept out of search instead by a noindex meta tag on its page and an X-Robots-Tag header
// (public/mnvisual00.rec/.htaccess). A Disallow line would stop Google from seeing that noindex.
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${new URL('sitemap.xml', site).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
