import type { ImageMetadata } from 'astro';
import type { Localized } from '../i18n';
import { cms, cmsImage, cmsLocalized } from './cms';
// The albums written in the code: one folder of AVIF photos each (src/assets/photos/<album>/, made by `npm run media`),
// with the captions and the running order in albums.json. The first photo is the album cover.
import albumData from './albums.json';

const files = import.meta.glob<{ default: ImageMetadata }>('/src/assets/photos/*/*.avif', { eager: true });

export interface Photo {
  image: ImageMetadata;
  alt: Localized;
  focus?: string; // CSS object-position, from the focus point set in the dashboard
}

export interface Album {
  slug: string;
  title: Localized;
  photos: Photo[];
  category?: string; // slug of a PhotoCategory
  onHome?: boolean; // used in the homepage photo carousels
}

export interface PhotoCategory {
  slug: string;
  title: Localized;
}

const LOCAL_CATEGORIES: PhotoCategory[] = [
  { slug: 'wedding', title: { en: 'Shooting Wedding', fr: 'Shooting Mariage', ar: 'تصوير الأعراس' } },
  { slug: 'kaftan', title: { en: 'Shooting Kaftan', fr: 'Shooting Caftan', ar: 'تصوير القفطان' } },
  { slug: 'family', title: { en: 'Shooting Family & Lifestyle', fr: 'Shooting Famille & Lifestyle', ar: 'تصوير العائلة ونمط الحياة' } },
];

const LOCAL_ALBUMS: Album[] = albumData.map((a) => ({
  slug: a.slug,
  title: a.title,
  category: a.category,
  onHome: true,
  photos: a.photos.map((p) => {
    const image = files[`/src/assets/photos/${a.slug}/${p.file}`]?.default;
    if (!image) throw new Error(`photos: src/assets/photos/${a.slug}/${p.file} is missing. Run "npm run media".`);
    return { image, alt: p.alt };
  }),
}));

// Albums published in the dashboard replace the ones above as soon as there is at least one.
const CMS_ALBUMS: Album[] | null = cms?.albums.length
  ? cms.albums.map((a) => ({
      slug: a.slug,
      title: cmsLocalized(a.title),
      category: a.category,
      onHome: a.onHome !== false,
      photos: a.photos.map((p) => ({ image: cmsImage(p), alt: cmsLocalized(p.alt, { en: '', fr: '', ar: '' }), focus: p.focus })),
    }))
  : null;

export const ALBUMS: Album[] = CMS_ALBUMS ?? LOCAL_ALBUMS;

// Only categories that hold at least one album are listed on the site.
export const PHOTO_CATEGORIES: PhotoCategory[] = (CMS_ALBUMS ? (cms?.photoCategories ?? []).map((c) => ({ slug: c.slug, title: cmsLocalized(c.title) })) : LOCAL_CATEGORIES)
  .filter((c) => ALBUMS.some((a) => a.category === c.slug));
