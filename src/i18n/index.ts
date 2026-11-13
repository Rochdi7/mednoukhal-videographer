import { strings, type Strings } from './strings';
import { cms } from '../data/cms';

export const LOCALES = ['en', 'fr', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', fr: 'Français', ar: 'العربية' };
export const LOCALE_FLAGS: Record<Locale, string> = { en: '/flags/gb.svg', fr: '/flags/fr.svg', ar: '/flags/ma.svg' };

// Texts edited in the dashboard (Texts) are laid over the built-in ones, field by field. An empty field keeps the
// built-in text, so a half-translated dashboard never leaves a blank on the page.
const overlay = (base: unknown, over: unknown, locale: Locale): unknown => {
  if (typeof base === 'string') {
    const value = (over as Partial<Record<Locale, string>> | undefined)?.[locale];
    return typeof value === 'string' && value.trim() ? value : base;
  }
  if (Array.isArray(base)) {
    if (!Array.isArray(over) || !over.length) return base;
    // Lists (such as the services) follow the dashboard: items can be added, removed and reordered there.
    const blank = (shape: unknown): unknown => (typeof shape === 'string' ? '' : Object.fromEntries(Object.entries(shape as object).map(([k, v]) => [k, blank(v)])));
    return over.map((item, i) => overlay(base[i] ?? blank(base[0]), item, locale));
  }
  if (base && typeof base === 'object') {
    const o = (over ?? {}) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, overlay(v, o[k], locale)]));
  }
  return base;
};

const merged = new Map<Locale, Strings>();
export const t = (locale: Locale): Strings => {
  if (!cms?.texts) return strings[locale];
  if (!merged.has(locale)) merged.set(locale, overlay(strings[locale], cms.texts, locale) as Strings);
  return merged.get(locale)!;
};
export const dir = (locale: Locale) => (locale === 'ar' ? 'rtl' : 'ltr');
export const localePath = (locale: Locale, path = '/') => (locale === DEFAULT_LOCALE ? path : `/${locale}${path}`);

// Param for the [...locale] rest route: undefined produces the unprefixed English (default) pages.
export const localeParam = (locale: Locale) => (locale === DEFAULT_LOCALE ? undefined : locale);
export const localeStaticPaths = () => LOCALES.map((locale) => ({ params: { locale: localeParam(locale) }, props: { locale } }));

export type Localized = Record<Locale, string>;
