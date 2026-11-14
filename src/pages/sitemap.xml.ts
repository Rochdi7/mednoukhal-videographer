// The sitemap, served at /sitemap.xml (the address submitted to Google Search Console and listed in robots.txt).
// Every public page in the three languages, each with its hreflang alternates, plus:
//   - image entries (the photographs on the photography pages, the poster on each film page) for Google Images
//   - video entries on each film page for Google Video
// The dashboard and the 404 page are never listed.
import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import { ALL_FILMS } from '../data/films';
import { LOCALES, localePath, type Locale } from '../i18n';
import { resolveAlbums } from '../utils/albums';
import { abs } from '../utils/seo';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

interface Entry {
  path: string; // without the locale prefix
  priority: string;
  changefreq: 'weekly' | 'monthly';
  images?: (locale: Locale) => { loc: string; title?: string }[];
  video?: (locale: Locale) => string;
}

export const GET: APIRoute = async ({ site }) => {
  const today = new Date().toISOString().slice(0, 10);
  const albums = await resolveAlbums();

  const filmEntries: Entry[] = await Promise.all(
    ALL_FILMS.map(async (film) => {
      const thumb = await getImage({ src: film.poster, width: 1200, format: 'jpg', quality: 80 });
      return {
        path: `/films/${film.slug}/`,
        priority: '0.7',
        changefreq: 'monthly' as const,
        images: () => [{ loc: abs(site, thumb.src) }],
        video: (locale: Locale) =>
          `<video:video><video:thumbnail_loc>${esc(abs(site, thumb.src))}</video:thumbnail_loc>` +
          `<video:title>${esc(film.title[locale])}</video:title>` +
          `<video:description>${esc(film.description[locale])}</video:description>` +
          `<video:content_loc>${esc(abs(site, film.src))}</video:content_loc>` +
          `<video:duration>${Math.max(1, Math.round(film.duration))}</video:duration>` +
          `<video:publication_date>${esc(film.uploadDate)}</video:publication_date>` +
          `<video:family_friendly>yes</video:family_friendly></video:video>`,
      };
    }),
  );

  const entries: Entry[] = [
    { path: '/', priority: '1.0', changefreq: 'weekly' },
    { path: '/films/', priority: '0.9', changefreq: 'weekly' },
    {
      path: '/photography/',
      priority: '0.9',
      changefreq: 'weekly',
      images: (locale) => albums.flatMap((album) => album.photos.map((photo) => ({ loc: abs(site, photo.full.src), title: photo.alt[locale] }))),
    },
    ...filmEntries,
    { path: '/reviews/', priority: '0.6', changefreq: 'monthly' },
    { path: '/contact/', priority: '0.8', changefreq: 'monthly' },
  ];

  const urls = entries.flatMap((entry) => {
    const alternates =
      LOCALES.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${esc(abs(site, localePath(l, entry.path)))}"/>`).join('') +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(abs(site, entry.path))}"/>`;
    return LOCALES.map((locale) => {
      const images = (entry.images?.(locale) ?? [])
        .map((img) => `<image:image><image:loc>${esc(img.loc)}</image:loc>${img.title ? `<image:title>${esc(img.title)}</image:title>` : ''}</image:image>`)
        .join('');
      return (
        `<url><loc>${esc(abs(site, localePath(locale, entry.path)))}</loc><lastmod>${today}</lastmod>` +
        `<changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority>` +
        alternates + images + (entry.video?.(locale) ?? '') + `</url>`
      );
    });
  });

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" ` +
    `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n` +
    urls.join('\n') +
    `\n</urlset>\n`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
