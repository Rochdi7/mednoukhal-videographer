// Small DOM helpers and form fields for the dashboard. Fields write straight into the content object they are
// given and call `changed()`, so typing never re-renders the page.
import { createElement, type IconNode } from 'lucide';
import { upload, videoInfo } from './api';

// A Lucide line icon (the same set the site uses), sized by CSS through the `icon` class.
export const icon = (node: IconNode, cls = '') =>
  createElement(node, { class: `icon${cls ? ` ${cls}` : ''}`, 'aria-hidden': 'true', 'stroke-width': 1.75 });

type Child = Node | string | number | false | null | undefined | Child[];
type Attrs = Record<string, any>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') el.className = value;
    else if (key === 'value') (el as any).value = value; // a textarea only takes its text as a property
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key in el && typeof value !== 'string') (el as any)[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}
// Appends children, skipping false/null/undefined (so `cond && h(…)` can be used anywhere).
export const put = (el: Node, ...children: Child[]) => append(el, children);
const append = (el: Node, children: Child[]) => {
  for (const child of children.flat(Infinity as 1) as Child[]) {
    if (child === null || child === undefined || child === false) continue;
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
};

export type L = { en: string; fr: string; ar: string };
export const emptyL = (): L => ({ en: '', fr: '', ar: '' });
export interface Img { path: string; width: number; height: number; focus?: string }
export interface Vid { path: string; width: number; height: number; duration: number }

export let changed: () => void = () => {};
export const onChange = (fn: () => void) => (changed = fn);

const LANGS: [keyof L, string][] = [['en', 'EN'], ['fr', 'FR'], ['ar', 'AR']];

// The language of a field, shown with the same flag as the language switch in the site header.
const FLAGS: Record<keyof L, [src: string, name: string]> = { en: ['/flags/gb.svg', 'English'], fr: ['/flags/fr.svg', 'French'], ar: ['/flags/ma.svg', 'Arabic'] };
export const flag = (lang: keyof L) => h('b', { class: 'lang__flag' }, h('img', { src: FLAGS[lang][0], alt: FLAGS[lang][1], width: 20, height: 15 }));

// Text in three languages. `multiline` stacks them as paragraphs.
export function localized(label: string, obj: Record<string, any>, key: string, opts: { multiline?: boolean; help?: string; required?: boolean; placeholder?: L } = {}) {
  if (!obj[key] || typeof obj[key] !== 'object') obj[key] = emptyL();
  const value = obj[key] as L;
  return h('div', { class: 'field' },
    h('span', {}, label, opts.required ? ' *' : ''),
    h('div', { class: `langs${opts.multiline ? ' langs--stack' : ''}` },
      LANGS.map(([lang, tag]) => {
        const attrs = {
          value: value[lang] ?? '',
          dir: lang === 'ar' ? 'rtl' : 'ltr',
          lang,
          placeholder: opts.placeholder?.[lang] ?? (lang === 'en' ? '' : 'Same as English if empty'),
          'aria-label': `${label} (${tag})`,
          onInput: (e: Event) => {
            value[lang] = (e.target as HTMLInputElement).value;
            changed();
          },
        };
        return h('label', { class: 'lang' }, opts.multiline ? h('textarea', { ...attrs, rows: 3 }) : h('input', { ...attrs, type: 'text' }), flag(lang));
      }),
    ),
    opts.help && h('small', {}, opts.help),
  );
}

export function text(label: string, obj: Record<string, any>, key: string, opts: { help?: string; type?: string; required?: boolean; placeholder?: string; transform?: (v: string) => string; onInput?: () => void } = {}) {
  return h('label', { class: 'field' },
    h('span', {}, label, opts.required ? ' *' : ''),
    h('input', {
      type: opts.type ?? 'text',
      value: obj[key] ?? '',
      placeholder: opts.placeholder,
      onInput: (e: Event) => {
        const input = e.target as HTMLInputElement;
        obj[key] = opts.transform ? opts.transform(input.value) : input.value;
        opts.onInput?.();
        changed();
      },
      onChange: (e: Event) => {
        if (opts.transform) (e.target as HTMLInputElement).value = obj[key];
      },
    }),
    opts.help && h('small', {}, opts.help),
  );
}

export function textarea(label: string, obj: Record<string, any>, key: string, opts: { help?: string; required?: boolean } = {}) {
  return h('label', { class: 'field' },
    h('span', {}, label, opts.required ? ' *' : ''),
    h('textarea', { value: obj[key] ?? '', rows: 4, dir: 'auto', onInput: (e: Event) => ((obj[key] = (e.target as HTMLTextAreaElement).value), changed()) }),
    opts.help && h('small', {}, opts.help),
  );
}

export function checkbox(label: string, obj: Record<string, any>, key: string, opts: { help?: string; onToggle?: (on: boolean) => void } = {}) {
  return h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: !!obj[key], onChange: (e: Event) => ((obj[key] = (e.target as HTMLInputElement).checked), opts.onToggle?.(obj[key]), changed()) }),
    h('span', {}, label, opts.help && h('small', { class: 'help' }, opts.help)),
  );
}

export function select(label: string, obj: Record<string, any>, key: string, options: { value: string | number; label: string }[], opts: { help?: string; required?: boolean; onPick?: () => void } = {}) {
  return h('label', { class: 'field' },
    h('span', {}, label, opts.required ? ' *' : ''),
    h('select', { onChange: (e: Event) => ((obj[key] = coerce((e.target as HTMLSelectElement).value, options)), opts.onPick?.(), changed()) },
      !options.some((o) => o.value === obj[key]) && h('option', { value: '', selected: true }, 'Choose…'),
      options.map((o) => h('option', { value: String(o.value), selected: o.value === obj[key] }, o.label)),
    ),
    opts.help && h('small', {}, opts.help),
  );
}
const coerce = (raw: string, options: { value: string | number }[]) => options.find((o) => String(o.value) === raw)?.value ?? raw;

export const toast = (message: string, tone: 'ok' | 'error' = 'ok') => {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: `toast${tone === 'error' ? ' toast--error' : ''}`, role: tone === 'error' ? 'alert' : 'status' }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), tone === 'error' ? 8000 : 3500);
};

export const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
export const fmtBytes = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${Math.max(1, Math.round(n / 1e6))} MB`);

// Click on the photo to set the point that must stay in frame when layouts crop it.
const focusable = (frame: HTMLElement, img: HTMLImageElement, value: Img) => {
  const dot = h('span', { class: 'media__dot' });
  const place = () => {
    const [x, y] = (value.focus ?? '50% 50%').split(' ');
    dot.style.left = x;
    dot.style.top = y;
    img.style.objectPosition = value.focus ?? '50% 50%';
  };
  frame.append(dot);
  frame.addEventListener('click', (e) => {
    const r = frame.getBoundingClientRect();
    // The preview may itself be cropped: map the click back onto the whole picture.
    const scale = Math.max(r.width / value.width, r.height / value.height);
    const shownW = value.width * scale;
    const shownH = value.height * scale;
    const [ox, oy] = (img.style.objectPosition || '50% 50%').split(' ').map((v) => parseFloat(v) / 100);
    const left = (r.width - shownW) * ox;
    const top = (r.height - shownH) * oy;
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left - left) / shownW) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top - top) / shownH) * 100));
    value.focus = `${Math.round(x)}% ${Math.round(y)}%`;
    place();
    changed();
  });
  place();
};

// One photo or one video: preview, upload/replace with progress, remove, and the focus point for photos.
export function media(label: string, obj: Record<string, any>, key: string, kind: 'image' | 'video', opts: { help?: string; required?: boolean; focus?: boolean; accept?: string } = {}) {
  const wrap = h('div', { class: 'field' });
  const draw = () => {
    const value = obj[key] as (Img & Vid) | null;
    const bar = h('i');
    const progress = h('div', { class: 'progress', hidden: true }, bar);
    const input = h('input', {
      type: 'file',
      hidden: true,
      accept: opts.accept ?? (kind === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4'),
      onChange: async () => {
        const file = input.files?.[0];
        if (!file) return;
        progress.hidden = false;
        buttons.querySelectorAll('button').forEach((b) => (b.disabled = true));
        try {
          const info = kind === 'video' ? await videoInfo(file) : null;
          const done = await upload(file, kind, (share) => (bar.style.width = `${share * 100}%`));
          obj[key] = kind === 'video' ? { path: done.path, ...info } : { path: done.path, width: done.width, height: done.height, focus: '50% 50%' };
          changed();
          toast(`${file.name} uploaded.`);
        } catch (err) {
          toast((err as Error).message, 'error');
        }
        draw();
      },
    });
    const frame = h('div', { class: `media__preview${value && kind === 'image' && opts.focus ? ' media__preview--focus' : ''}` });
    if (value?.path && kind === 'image') {
      const img = h('img', { src: value.path, alt: '' });
      frame.append(img);
      if (opts.focus) focusable(frame, img, value);
    } else if (value?.path) frame.append(h('video', { src: value.path, muted: true, controls: true, preload: 'metadata', playsInline: true }));
    else frame.append(kind === 'image' ? 'No photo yet' : 'No video yet');
    const buttons = h('div', { class: 'toolbar' },
      h('button', { type: 'button', class: 'btn btn--sm', onClick: () => input.click() }, value ? 'Replace' : 'Upload'),
      value && !opts.required && h('button', { type: 'button', class: 'btn btn--sm btn--ghost', onClick: () => ((obj[key] = null), changed(), draw()) }, 'Remove'),
    );
    const details = value
      ? kind === 'video'
        ? `${value.width}×${value.height} · ${fmtDuration(value.duration)}`
        : `${value.width}×${value.height}${opts.focus ? ' · click the photo to set the focus point' : ''}`
      : '';
    wrap.replaceChildren(
      h('span', {}, label, opts.required ? ' *' : ''),
      h('div', { class: 'media' }, frame, h('div', { class: 'media__info' }, buttons, progress, details && h('small', {}, details), opts.help && h('small', {}, opts.help), input)),
    );
  };
  draw();
  return wrap;
}

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
