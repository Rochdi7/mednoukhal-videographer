import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Replace with the real domain before deploying, or set SITE_URL at build time.
const site = process.env.SITE_URL ?? 'https://mednoukhal.com';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
      i18n: { defaultLocale: 'en', locales: { en: 'en', fr: 'fr', ar: 'ar' } },
    }),
  ],
});
