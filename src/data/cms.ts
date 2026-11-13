import type { ImageMetadata } from 'astro';

// Content saved in the dashboard (/admin), copied in by scripts/cms-sync.mjs before each build.
// When the site is built without the dashboard (no src/data/cms.json), `cms` is null and every data module
// falls back to the content written in the code, so the site always builds.

type Lang = 'en' | 'fr' | 'ar';
export type CmsText = Partial<Record<Lang, string>>;
export interface CmsImage { file: string; width: number; height: number; focus?: string }
export interface CmsVideo { src: string; width: number; height: number; duration: number }

export interface CmsData {
  syncedAt: string;
  settings: { name?: string; jobTitle?: string; logoAlt?: string; email?: string; whatsapp?: string; phone?: string; socials?: { label: string; handle?: string; href: string; icon?: string }[]; logo: CmsImage | null; logoMark: CmsImage | null; logoWordmark?: CmsImage | null } | null;
  // videos: the hero films, played one after another (a single one loops).
  home: { videos: { video: CmsVideo; videoMobile: CmsVideo | null }[]; poster: CmsImage | null; posterMobile: CmsImage | null; aboutPhoto: CmsImage | null } | null;
  // The closing carousel's cards; empty = the album photos.
  curve: { kind: 'image' | 'video'; image: CmsImage | null; video: CmsVideo | null; href?: string }[];
  texts: Record<string, unknown> | null;
  filmCategories: { slug: string; title: CmsText }[];
  films: { slug: string; title: CmsText; description?: CmsText; featured?: boolean; onHome?: boolean; date?: string; category?: string; video: CmsVideo; poster: CmsImage }[];
  photoCategories: { slug: string; title: CmsText }[];
  albums: { slug: string; title: CmsText; onHome?: boolean; category?: string; photos: (CmsImage & { alt?: CmsText })[] }[];
  clients: { name: string; tone?: boolean; logo: CmsImage | null }[];
  // logo: the review's own logo (replaces the client's); a review may name a client outside the client list.
  reviews: { client: string; sector?: CmsText; quote: string; rating: number; placeholder?: boolean; logo?: CmsImage | null; tone?: boolean }[];
  advice: { title: string; video: CmsVideo | null; poster: CmsImage | null }[];
}

const json = import.meta.glob<{ default: CmsData }>('/src/data/cms.json', { eager: true });
export const cms: CmsData | null = json['/src/data/cms.json']?.default ?? null;

const images = import.meta.glob<{ default: ImageMetadata }>('/src/assets/cms/*.{jpg,jpeg,png,webp,avif,gif,tif,tiff}', { eager: true });

export const cmsImage = (ref: CmsImage): ImageMetadata => {
  const image = images[`/src/assets/cms/${ref.file}`]?.default;
  if (!image) throw new Error(`cms: image ${ref.file} is missing. Run "npm run cms:sync".`);
  return image;
};

// A text from the dashboard in all three languages. French and Arabic fall back to English, then to the built-in text.
export const cmsLocalized = (value: CmsText | undefined, fallback?: Record<Lang, string>): Record<Lang, string> => {
  const en = value?.en?.trim() || fallback?.en || '';
  return { en, fr: value?.fr?.trim() || fallback?.fr || en, ar: value?.ar?.trim() || fallback?.ar || en };
};
