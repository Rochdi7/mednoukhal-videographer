import type { ImageMetadata } from 'astro';
import type { Localized } from '../i18n';
import manifest from './media-manifest.json';
import { cms, cmsImage, cmsLocalized } from './cms';

const posters = import.meta.glob<{ default: ImageMetadata }>('/src/assets/films/*.jpg', { eager: true });

export interface Film {
  slug: string;
  title: Localized;
  description: Localized;
  poster: ImageMetadata;
  src: string;
  width: number;
  height: number;
  duration: number;
  uploadDate: string;
  category?: string; // slug of a FilmCategory
  focus?: string; // CSS object-position for the poster, from the focus point set in the dashboard
  featured?: boolean; // the showreel: opens the films page as the wide banner
  onHome?: boolean; // shown in the homepage carousel
}

export interface FilmCategory {
  slug: string;
  title: Localized;
}

const { preview } = manifest;

// Placeholders: one clip fills every film slot until the real projects are added.
const DESCRIPTION: Localized = {
  en: 'A man in a patterned jacket stands on a rocky hilltop and looks out over the city.',
  fr: 'Un homme en veste à motifs, debout sur une colline rocheuse, contemple la ville.',
  ar: 'رجل بسترة منقوشة يقف على تلة صخرية ويتأمل المدينة.',
};
const VIDEO = { src: '/media/videos/preview.mp4', width: preview.width, height: preview.height };

const build = (slug: string, title: Localized): Film => ({
  slug,
  title,
  description: DESCRIPTION,
  poster: posters[`/src/assets/films/${slug}.jpg`].default,
  ...VIDEO,
  duration: preview.duration,
  uploadDate: preview.uploadDate,
});

const LOCAL_FILMS: Film[] = [
  { ...build('showreel', { en: 'Showreel', fr: 'Bande démo', ar: 'الشريط التعريفي' }), featured: true, onHome: false },
  ...Array.from({ length: 8 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return { ...build(`project-${n}`, { en: `Project ${n}`, fr: `Projet ${n}`, ar: `مشروع ${n}` }), onHome: true };
  }),
];

// Films published in the dashboard replace the ones above as soon as there is at least one.
const CMS_FILMS: Film[] | null = cms?.films.length
  ? cms.films.map((f) => ({
      slug: f.slug,
      title: cmsLocalized(f.title),
      description: cmsLocalized(f.description, { en: '', fr: '', ar: '' }),
      poster: cmsImage(f.poster),
      focus: f.poster.focus,
      src: f.video.src,
      width: f.video.width || 1920,
      height: f.video.height || 1080,
      duration: f.video.duration,
      uploadDate: f.date ?? cms!.syncedAt,
      category: f.category,
      featured: !!f.featured,
      onHome: f.onHome !== false,
    }))
  : null;

const source = CMS_FILMS ?? LOCAL_FILMS;

// Every film, the showreel (the first one marked as such) first.
const reel = source.findIndex((f) => f.featured);
export const ALL_FILMS: Film[] = reel < 0 ? source : [source[reel], ...source.filter((_, i) => i !== reel).map((f) => ({ ...f, featured: false }))];
export const SHOWREEL: Film = ALL_FILMS[0];
// The homepage carousel.
export const FILMS: Film[] = ALL_FILMS.filter((f) => f.onHome !== false && f !== SHOWREEL);

// Only categories that hold at least one film are listed on the site.
export const FILM_CATEGORIES: FilmCategory[] = (cms?.filmCategories ?? [])
  .map((c) => ({ slug: c.slug, title: cmsLocalized(c.title) }))
  .filter((c) => ALL_FILMS.some((f) => f.category === c.slug));

export const ADVICE_FILM = { ...VIDEO, poster: posters['/src/assets/films/about-portrait.jpg'].default };

export const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export const isoDuration = (s: number) => `PT${Math.floor(s / 60)}M${s % 60}S`;

// Named after the nearest standard ratio, so an encode that is a few pixels off (910×512) still reads "16:9", not "455:256".
const RATIOS: [string, number][] = [['2.39:1', 2.39], ['2:1', 2], ['16:9', 16 / 9], ['3:2', 1.5], ['4:3', 4 / 3], ['1:1', 1], ['4:5', 0.8], ['9:16', 9 / 16]];
export const aspectLabel = (w: number, h: number) => {
  const r = w / h;
  return RATIOS.reduce((best, cur) => (Math.abs(cur[1] - r) < Math.abs(best[1] - r) ? cur : best))[0];
};
