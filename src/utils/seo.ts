import { SITE } from '../config/site';
import { localePath, type Locale } from '../i18n';

export const abs = (site: URL | undefined, path: string) => new URL(path, site).href;

export const creatorNode = { '@type': 'Person', name: SITE.name };

// Where Med Noukhal works from, for search engines (local results: "videographer Marrakech", "photographe Maroc").
// No street address: only the city and country, which is what a freelance service needs.
const ADDRESS = { '@type': 'PostalAddress', addressLocality: 'Marrakech', addressRegion: 'Marrakech-Safi', addressCountry: 'MA' };
const AREA = [
  { '@type': 'City', name: 'Marrakech' },
  { '@type': 'Country', name: 'Morocco' },
];
const KNOWS = ['Videography', 'Photography', 'Commercials', 'Brand films', 'Music videos', 'Documentaries', 'Hotel films', 'Event videography', 'Luxury photography', 'Video editing', 'Colour grading'];

/** `image`: an absolute URL to a photo of Med Noukhal or the work (optional). */
export const personNode = (site: URL | undefined, locale: Locale, image?: string) => ({
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': abs(site, '/#person'),
  name: SITE.name,
  jobTitle: SITE.jobTitle,
  url: abs(site, localePath(locale)),
  ...(image ? { image } : {}),
  address: ADDRESS,
  knowsAbout: KNOWS,
  knowsLanguage: ['ar', 'fr', 'en'],
  ...(SITE.email ? { email: SITE.email } : {}),
  ...(SITE.phone ? { telephone: SITE.phone } : {}),
  ...(SITE.socials.length ? { sameAs: SITE.socials.map((s) => s.href) } : {}),
});

/** The business side: a video and photo production service in Marrakech, run by Med Noukhal. */
export const businessNode = (site: URL | undefined, locale: Locale, opts: { image: string; logo: string; description: string }) => ({
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  '@id': abs(site, '/#business'),
  name: SITE.name,
  alternateName: SITE.logoAlt,
  description: opts.description,
  url: abs(site, localePath(locale)),
  image: opts.image,
  logo: opts.logo,
  address: ADDRESS,
  areaServed: AREA,
  founder: { '@id': abs(site, '/#person') },
  knowsAbout: KNOWS,
  ...(SITE.email ? { email: SITE.email } : {}),
  ...(SITE.phone ? { telephone: SITE.phone } : {}),
  ...(SITE.socials.length ? { sameAs: SITE.socials.map((s) => s.href) } : {}),
});

export const websiteNode = (site: URL | undefined, locale: Locale) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': abs(site, '/#website'),
  name: SITE.name,
  alternateName: SITE.logoAlt,
  url: abs(site, localePath(locale)),
  inLanguage: locale,
  publisher: { '@id': abs(site, '/#person') },
});

export const breadcrumbNode = (site: URL | undefined, items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(site, it.path) })),
});

/** A page that lists other pages (the films grid): name, url and the pages in order. */
export const collectionNode = (site: URL | undefined, locale: Locale, opts: { name: string; description: string; path: string; items: { name: string; path: string }[] }) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: opts.name,
  description: opts.description,
  url: abs(site, localePath(locale, opts.path)),
  inLanguage: locale,
  author: { '@id': abs(site, '/#person') },
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: opts.items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: abs(site, localePath(locale, it.path)) })),
  },
});
