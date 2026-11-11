import type { ImageMetadata } from 'astro';
import type { Localized } from '../i18n';
import manifest from './media-manifest.json';

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

export const FILMS: Film[] = Array.from({ length: 8 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return build(`project-${n}`, { en: `Project ${n}`, fr: `Projet ${n}`, ar: `مشروع ${n}` });
});

export const SHOWREEL: Film = build('showreel', { en: 'Showreel', fr: 'Bande démo', ar: 'الشريط التعريفي' });

export const COACHING_FILM = { ...VIDEO, poster: posters['/src/assets/films/coaching-film.jpg'].default };

export const ALL_FILMS: Film[] = [SHOWREEL, ...FILMS];

export const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export const isoDuration = (s: number) => `PT${Math.floor(s / 60)}M${s % 60}S`;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export const aspectLabel = (w: number, h: number) => {
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
};
