import type { ImageMetadata } from 'astro';
import type { Localized } from '../i18n';
import manifest from './media-manifest.json';
import { cms, cmsImage, cmsLocalized } from './cms';
import { versioned } from './media-version';

const posters = import.meta.glob<{ default: ImageMetadata }>('/src/assets/films/*.avif', { eager: true });

export interface Film {
  slug: string;
  title: Localized;
  description: Localized;
  // What Google shows for the film's page (set in the dashboard, Google (SEO)); empty = title and description.
  seoTitle?: Partial<Localized>;
  seoDescription?: Partial<Localized>;
  poster: ImageMetadata;
  src: string;
  preview?: string; // a short 720p cut for the muted previews (homepage carousel, films page hover); the full film otherwise
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

// The films written in the code. Videos, posters and sizes come from `npm run media` (scripts/process-media.mjs).
const LOCAL_CATEGORIES: FilmCategory[] = [
  { slug: 'music-videos', title: { en: 'Music videos', fr: 'Clips musicaux', ar: 'كليبات موسيقية' } },
  { slug: 'fashion-lifestyle', title: { en: 'Fashion & Lifestyle', fr: 'Mode & Lifestyle', ar: 'الموضة ونمط الحياة' } },
  { slug: 'travel', title: { en: 'Travel', fr: 'Voyage', ar: 'سفر' } },
];

const build = (slug: keyof typeof manifest, category: string, title: Localized, description: Localized, extra: Partial<Film> = {}): Film => {
  const media: { src: string; preview?: string; width: number; height: number; duration: number; uploadDate: string } = manifest[slug];
  return {
    slug,
    title,
    description,
    poster: posters[`/src/assets/films/${slug}.avif`].default,
    ...media,
    src: versioned(media.src),
    ...(media.preview ? { preview: versioned(media.preview) } : {}),
    category,
    onHome: true,
    ...extra,
  };
};

const LOCAL_FILMS: Film[] = [
  // The first hero loop doubles as the showreel: it opens the films page as the wide banner.
  build('showreel', 'fashion-lifestyle', { en: 'Showreel', fr: 'Bande démo', ar: 'الشريط التعريفي' }, {
    en: 'A man in a patterned jacket stands on a rocky hilltop and looks out over the city.',
    fr: 'Un homme en veste à motifs, debout sur une colline rocheuse, contemple la ville.',
    ar: 'رجل بسترة منقوشة يقف على تلة صخرية ويتأمل المدينة.',
  }, { featured: true }),
  build('naoual-live-on-stage', 'music-videos', { en: 'Naoual — Live on Stage', fr: 'Naoual — Sur scène', ar: 'نوال — على المسرح' }, {
    en: 'A singer in a Morocco jersey and red fez performs with a troupe of dancers under deep red stage light.',
    fr: 'Une chanteuse en maillot du Maroc et fez rouge se produit avec une troupe de danseurs sous une lumière rouge profonde.',
    ar: 'مغنية بقميص المنتخب المغربي وطربوش أحمر تؤدي مع فرقة من الراقصين تحت إضاءة مسرحية حمراء.',
  }),
  build('medina-stories', 'fashion-lifestyle', { en: 'Medina Stories', fr: 'Histoires de médina', ar: 'حكايات المدينة العتيقة' }, {
    en: 'Street food, busy souks and bold patterned looks moving through the ochre alleys of the medina.',
    fr: 'Cuisine de rue, souks animés et looks aux motifs audacieux dans les ruelles ocre de la médina.',
    ar: 'أكلات الشارع والأسواق المزدحمة وإطلالات بنقوش جريئة في أزقة المدينة العتيقة.',
  }),
  build('essaouira-atlantic-soul', 'travel', { en: 'Essaouira — Atlantic Soul', fr: "Essaouira — L'âme de l'Atlantique", ar: 'الصويرة — روح الأطلسي' }, {
    en: 'Seagulls over the ramparts, blue doors and a musician in white facing the Atlantic in Essaouira.',
    fr: "Des mouettes au-dessus des remparts, des portes bleues et un musicien en blanc face à l'Atlantique à Essaouira.",
    ar: 'نوارس فوق الأسوار وأبواب زرقاء وموسيقي بالأبيض يتأمل المحيط الأطلسي في الصويرة.',
  }),
];

// Films published in the dashboard replace the ones above as soon as there is at least one.
const CMS_FILMS: Film[] | null = cms?.films.length
  ? cms.films.map((f) => ({
      slug: f.slug,
      title: cmsLocalized(f.title),
      description: cmsLocalized(f.description, { en: '', fr: '', ar: '' }),
      seoTitle: f.seoTitle,
      seoDescription: f.seoDescription,
      poster: cmsImage(f.poster),
      focus: f.poster.focus,
      src: versioned(f.video.src),
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
// The homepage carousel: every film ticked for it, the showreel included.
export const FILMS: Film[] = ALL_FILMS.filter((f) => f.onHome !== false);

// Only categories that hold at least one film are listed on the site.
// (The showreel opens the films page as a banner outside the filter, so it does not count.)
export const FILM_CATEGORIES: FilmCategory[] = (CMS_FILMS ? (cms?.filmCategories ?? []).map((c) => ({ slug: c.slug, title: cmsLocalized(c.title) })) : LOCAL_CATEGORIES)
  .filter((c) => ALL_FILMS.some((f) => f.category === c.slug && !(f === SHOWREEL && f.featured)));


export const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export const isoDuration = (s: number) => `PT${Math.floor(s / 60)}M${s % 60}S`;

// Named after the nearest standard ratio, so an encode that is a few pixels off (910×512) still reads "16:9", not "455:256".
const RATIOS: [string, number][] = [['2.39:1', 2.39], ['2:1', 2], ['16:9', 16 / 9], ['3:2', 1.5], ['4:3', 4 / 3], ['1:1', 1], ['4:5', 0.8], ['9:16', 9 / 16]];
export const aspectLabel = (w: number, h: number) => {
  const r = w / h;
  return RATIOS.reduce((best, cur) => (Math.abs(cur[1] - r) < Math.abs(best[1] - r) ? cur : best))[0];
};
