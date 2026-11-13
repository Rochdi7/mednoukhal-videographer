import type { ImageMetadata } from 'astro';
import sharp from 'sharp';

// Blurred preview painted behind a photo while the real file downloads, so a frame is never an empty box.
// A 20px copy of the picture (about 300 bytes) is inlined as the element's background; an SVG blur smooths
// the enlargement so it reads as soft focus rather than blocks. Once the image arrives it covers the preview.
// Returns an inline style string; pass it as `style` on <Image>, <Picture> or a <video> with a poster.

const cache = new Map<string, Promise<string>>();

export function blur(image: ImageMetadata, position = '50% 50%'): Promise<string> {
  // Astro attaches the source path to imported images as a hidden property.
  const file = (image as ImageMetadata & { fsPath?: string }).fsPath;
  if (!file) return Promise.resolve('');
  const key = `${file}|${position}`;
  let style = cache.get(key);
  if (!style) {
    style = sharp(file)
      .rotate()
      .resize(20, 20, { fit: 'inside' })
      .webp({ quality: 45 })
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => {
        const svg =
          `<svg xmlns='http://www.w3.org/2000/svg' width='${info.width}' height='${info.height}' viewBox='0 0 ${info.width} ${info.height}'>` +
          `<filter id='b' color-interpolation-filters='sRGB'><feGaussianBlur stdDeviation='1.2'/>` +
          `<feComponentTransfer><feFuncA type='discrete' tableValues='1 1'/></feComponentTransfer></filter>` +
          `<image width='100%' height='100%' preserveAspectRatio='none' filter='url(%23b)' href='data:image/webp;base64,${data.toString('base64')}'/></svg>`;
        return `background:#151515 url("data:image/svg+xml;charset=utf-8,${svg.replace(/</g, '%3C').replace(/>/g, '%3E')}") ${position}/cover no-repeat`;
      })
      .catch(() => '');
    cache.set(key, style);
  }
  return style;
}
