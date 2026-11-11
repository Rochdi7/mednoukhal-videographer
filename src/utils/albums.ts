import { getImage } from 'astro:assets';
import { ALBUMS } from '../data/photos';

// Adds the full-size image and the small square preview used by the album viewer.
export const resolveAlbums = () =>
  Promise.all(
    ALBUMS.map(async (album) => ({
      ...album,
      photos: await Promise.all(
        album.photos.map(async (photo) => ({
          ...photo,
          full: await getImage({ src: photo.image, width: Math.min(2000, photo.image.width), format: 'webp', quality: 86 }),
          thumb: await getImage({ src: photo.image, width: 160, height: 160, fit: 'cover', format: 'webp', quality: 60 }),
        })),
      ),
    })),
  );
