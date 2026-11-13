import type { ImageMetadata } from 'astro';
import { cms, cmsImage } from './cms';
import { ADVICE_FILM } from './films';
import local from './advice.json';

// Advice videos: from the dashboard (Advice videos) once there is at least one, otherwise the list in advice.json,
// whose placeholders all play the same clip.
export interface AdviceVideo {
  title: string;
  src: string;
  poster: ImageMetadata;
  focus?: string;
}

const thumbs = import.meta.glob<{ default: ImageMetadata }>('/src/assets/advice/*.jpg', { eager: true });

export const ADVICE: AdviceVideo[] = cms?.advice.some((a) => a.video && a.poster)
  ? cms.advice.filter((a) => a.video && a.poster).map((a) => ({ title: a.title, src: a.video!.src, poster: cmsImage(a.poster!), focus: a.poster!.focus }))
  : local.map((a) => ({ title: a.title, src: ADVICE_FILM.src, poster: thumbs[`/src/assets/advice/${a.id}.jpg`].default }));
