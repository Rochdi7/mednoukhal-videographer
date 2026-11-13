import { getImage } from 'astro:assets';
import { ALBUMS } from '../data/photos';
import { blur } from './placeholder';

// Adds the full-size image, the small square preview used by the album viewer, and the blurred stand-in shown while a photo loads.
// `home: true` keeps only the albums marked "Show on the homepage" in the dashboard.
export const resolveAlbums = ({ home = false }: { home?: boolean } = {}) =>
  Promise.all(
    ALBUMS.filter((album) => !home || album.onHome !== false).map(async (album) => ({
      ...album,
      photos: await Promise.all(
        album.photos.map(async (photo) => ({
          ...photo,
          full: await getImage({ src: photo.image, width: Math.min(2000, photo.image.width), format: 'webp', quality: 82 }),
          thumb: await getImage({ src: photo.image, width: 160, height: 160, fit: 'cover', format: 'webp', quality: 60 }),
          ph: `${await blur(photo.image, photo.focus)}${photo.focus ? `;object-position:${photo.focus}` : ''}`,
        })),
      ),
    })),
  );
