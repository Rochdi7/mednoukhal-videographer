import { statSync } from 'node:fs';
import { join } from 'node:path';

// Videos are cached for 30 days (public/.htaccess), so a file re-cut under the same name would keep playing
// the old copy. Each local video URL gets "?v=" + its size: a new cut gets a new URL and is fetched again.
// The size (not the date) so a fresh git checkout in CI gives the same URL. Files not in public/ are left as they are.
export const versioned = (src: string): string => {
  if (!src.startsWith('/') || src.includes('?')) return src;
  try {
    return `${src}?v=${statSync(join(process.cwd(), 'public', src)).size.toString(36)}`;
  } catch {
    return src;
  }
};
