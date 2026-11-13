import type { ImageMetadata } from 'astro';
import { cms, cmsImage } from './cms';
import heroImage from '../assets/hero/hero.jpg';
import heroPortrait from '../assets/hero/hero-portrait.jpg';
// About photo: a film still until a portrait is set in the dashboard (Homepage hero → About section photo).
import aboutImage from '../assets/films/about-portrait.jpg';

// The homepage background films and their stills, from the dashboard (Homepage hero) or the files in the project.
// `sources` (the first film) go into <video> in order; the browser plays the first whose `media` query matches.
// `playlist` holds every film: one loops; several play one after another (src/scripts/home.ts).
export interface HeroMedia {
  poster: ImageMetadata;
  posterMobile: ImageMetadata;
  sources: { src: string; media?: string }[];
  playlist: { src: string; srcMobile?: string }[];
}

const PORTRAIT = '(max-width: 700px) and (orientation: portrait)';
const home = cms?.home;

export const HERO: HeroMedia = home?.videos?.length && home.poster
  ? {
      poster: cmsImage(home.poster),
      posterMobile: home.posterMobile ? cmsImage(home.posterMobile) : cmsImage(home.poster),
      sources: [...(home.videos[0].videoMobile ? [{ src: home.videos[0].videoMobile.src, media: PORTRAIT }] : []), { src: home.videos[0].video.src }],
      playlist: home.videos.map((v) => ({ src: v.video.src, ...(v.videoMobile ? { srcMobile: v.videoMobile.src } : {}) })),
    }
  : {
      poster: heroImage,
      posterMobile: heroPortrait,
      sources: [
        { src: '/media/videos/hero-portrait.mp4', media: PORTRAIT },
        { src: '/media/videos/hero-720.mp4', media: '(max-width: 1600px)' },
        { src: '/media/videos/hero-1080.mp4' },
      ],
      playlist: [{ src: '/media/videos/hero-1080.mp4', srcMobile: '/media/videos/hero-portrait.mp4' }],
    };

// The closing carousel's cards from the dashboard: photos or videos, each with an optional link.
// null = not set there, so the page keeps its row of album photos.
export interface CurveItem {
  image?: ImageMetadata;
  focus?: string;
  video?: string;
  href?: string;
}
export const CURVE_ITEMS: CurveItem[] | null = cms?.curve?.length
  ? cms.curve.map((c) => ({
      ...(c.image ? { image: cmsImage(c.image), focus: c.image.focus } : {}),
      ...(c.kind === 'video' && c.video ? { video: c.video.src } : {}),
      ...(c.href ? { href: c.href } : {}),
    }))
  : null;

export const ABOUT_PHOTO: { image: ImageMetadata; focus: string } = home?.aboutPhoto
  ? { image: cmsImage(home.aboutPhoto), focus: home.aboutPhoto.focus ?? '50% 40%' }
  : { image: aboutImage, focus: '50% 40%' };
