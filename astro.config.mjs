import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Replace with the real domain before deploying, or set SITE_URL at build time.
const site = process.env.SITE_URL ?? 'https://mednoukhal.com';
// The dashboard's address (same as ADMIN_PATH in src/config/admin.ts), kept out of the sitemap.
const DASHBOARD = '/mnvisual00.rec';

export default defineConfig({
  site,
  output: 'static',
  // npm run admin:local rebuilds into another folder (MN_OUT_DIR), then swaps it in, so the running site never goes blank.
  outDir: process.env.MN_OUT_DIR || './dist',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404') && !page.includes(DASHBOARD),
      i18n: { defaultLocale: 'en', locales: { en: 'en', fr: 'fr', ar: 'ar' } },
    }),
  ],
});
