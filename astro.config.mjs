import { defineConfig } from 'astro/config';

// Replace with the real domain before deploying, or set SITE_URL at build time.
const site = process.env.SITE_URL ?? 'https://mednoukhal.com';

// The sitemap is src/pages/sitemap.xml.ts (served at /sitemap.xml, with hreflang, image and video entries).
// It lists only the public pages, so the dashboard never appears in it.
export default defineConfig({
  site,
  output: 'static',
  // npm run admin:local rebuilds into another folder (MN_OUT_DIR), then swaps it in, so the running site never goes blank.
  outDir: process.env.MN_OUT_DIR || './dist',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});
