import type { APIRoute } from 'astro';

// The dashboard is not listed here on purpose: robots.txt is public, so naming it would point to it.
// Its page carries noindex instead.
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${new URL('sitemap-index.xml', site).href}\n`, {
    headers: { 'Content-Type': 'text/plain' },
  });
