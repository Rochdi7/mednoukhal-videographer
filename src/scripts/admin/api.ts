// Talks to /api/admin/api.php: JSON calls with the CSRF token, and uploads sent in 4 MB pieces
// (so a long film gets past the server's upload size limit, with a real progress bar).
const ENDPOINT = '/api/admin/api.php';
const CHUNK = 4 * 1024 * 1024;

let csrf = '';

export interface Reply {
  ok: boolean;
  status: number;
  code?: string;
  [key: string]: any;
}

export async function call(action: string, body?: unknown): Promise<Reply> {
  const post = body !== undefined;
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?action=${action}`, {
      method: post ? 'POST' : 'GET',
      credentials: 'same-origin',
      headers: post ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {},
      body: post ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, code: 'network' };
  }
  let data: Record<string, any> = {};
  try {
    data = await res.json();
  } catch {
    data = { ok: false, code: res.status === 404 ? 'no_api' : 'server' };
  }
  if (typeof data.csrf === 'string') csrf = data.csrf;
  return { ...data, ok: !!data.ok && res.ok, status: res.status };
}

const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 24);

export interface Uploaded {
  path: string;
  width: number;
  height: number;
}

export async function upload(file: File, kind: 'image' | 'video', onProgress: (share: number) => void): Promise<Uploaded> {
  const id = randomId();
  const total = Math.max(1, Math.ceil(file.size / CHUNK));
  for (let index = 0; index < total; index++) {
    const form = new FormData();
    form.append('id', id);
    form.append('index', String(index));
    form.append('total', String(total));
    form.append('kind', kind);
    form.append('chunk', file.slice(index * CHUNK, (index + 1) * CHUNK), file.name);
    let res: Response | null = null;
    // A dropped connection retries the same piece a few times before giving up.
    for (let attempt = 0; attempt < 3 && !res; attempt++) {
      try {
        res = await fetch(`${ENDPOINT}?action=upload`, { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf }, body: form });
      } catch {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    if (!res) throw new Error('The connection dropped during the upload.');
    const data = await res.json().catch(() => ({ ok: false, code: 'server' }));
    if (!res.ok || !data.ok) throw new Error(uploadError(data.code, data.type));
    onProgress((index + 1) / total);
    if (data.done) return { path: data.path, width: data.width, height: data.height };
  }
  throw new Error('The upload did not finish.');
}

const uploadError = (code: string, type?: string) =>
  ({
    bad_type: `This file type is not accepted${type ? ` (${type})` : ''}. Use JPG, PNG or WebP for photos, MP4 for videos.`,
    too_large: 'The file is too large (photos up to 40 MB, videos up to 2 GB).',
    signed_out: 'You were signed out. Sign in again and retry.',
    csrf: 'Your session changed. Reload the page and retry.',
  })[code] ?? `The upload failed (${code ?? 'server error'}).`;

// Width, height and running time of a video, read by the browser before it is uploaded.
export const videoInfo = (file: File) =>
  new Promise<{ width: number; height: number; duration: number }>((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (info: { width: number; height: number; duration: number }) => {
      URL.revokeObjectURL(url);
      resolve(info);
    };
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => done({ width: video.videoWidth, height: video.videoHeight, duration: Math.round(video.duration || 0) });
    video.onerror = () => done({ width: 0, height: 0, duration: 0 });
    video.src = url;
  });
