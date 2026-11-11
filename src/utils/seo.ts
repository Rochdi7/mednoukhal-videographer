import { SITE } from '../config/site';
import { localePath, type Locale } from '../i18n';

export const abs = (site: URL | undefined, path: string) => new URL(path, site).href;

export const creatorNode = { '@type': 'Person', name: SITE.name };

export const personNode = (site: URL | undefined, locale: Locale) => ({
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': abs(site, '/#person'),
  name: SITE.name,
  jobTitle: SITE.jobTitle,
  url: abs(site, localePath(locale)),
  ...(SITE.email ? { email: SITE.email } : {}),
  ...(SITE.phone ? { telephone: SITE.phone } : {}),
  ...(SITE.socials.length ? { sameAs: SITE.socials.map((s) => s.href) } : {}),
});

export const websiteNode = (site: URL | undefined, locale: Locale) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': abs(site, '/#website'),
  name: SITE.name,
  url: abs(site, localePath(locale)),
  inLanguage: locale,
  publisher: { '@id': abs(site, '/#person') },
});

export const breadcrumbNode = (site: URL | undefined, items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(site, it.path) })),
});
