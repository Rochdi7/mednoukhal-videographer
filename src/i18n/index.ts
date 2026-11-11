import { strings, type Strings } from './strings';

export const LOCALES = ['en', 'fr', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', fr: 'Français', ar: 'العربية' };
export const LOCALE_FLAGS: Record<Locale, string> = { en: '/flags/gb.svg', fr: '/flags/fr.svg', ar: '/flags/ma.svg' };

export const t = (locale: Locale): Strings => strings[locale];
export const dir = (locale: Locale) => (locale === 'ar' ? 'rtl' : 'ltr');
export const localePath = (locale: Locale, path = '/') => (locale === 'en' ? path : `/${locale}${path}`);

// Param for the [...locale] rest route: undefined produces the unprefixed English pages.
export const localeParam = (locale: Locale) => (locale === 'en' ? undefined : locale);
export const localeStaticPaths = () => LOCALES.map((locale) => ({ params: { locale: localeParam(locale) }, props: { locale } }));

export type Localized = Record<Locale, string>;
