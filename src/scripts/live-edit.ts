// Live editing on the page itself (like WordPress): signed in to the dashboard, open any page with ?edit.
// Every text that comes from the dashboard content gets a dashed outline: click it, type, press Save.
// Texts are found by matching what the page shows against the site's words (Site texts) and the names of the
// films, albums and categories, so no page template needs markers. A text used in several places changes everywhere.
// Saved texts show at once on refresh in edit mode; visitors see them after "Publish" (the site is rebuilt).
import { createElement, SquarePen } from 'lucide';

type Lang = 'en' | 'fr' | 'ar';
type L = Record<Lang, string>;
type ListName = 'films' | 'albums' | 'filmCategories' | 'photoCategories' | 'reviews' | 'clients' | 'advice';
// 'text': a sentence of Site texts. 'field': a field of a dashboard item (a category name, a film title, a photo
// title inside an album, a review quote…); `localized` fields keep one value per language and only this page's changes.
type Target = { kind: 'text'; path: (string | number)[] } | { kind: 'field'; list: ListName; id: string; photo?: string; field: string; localized: boolean };

const API = '/api/admin/api.php';
const lang = ((document.documentElement.lang || 'en').slice(0, 2) as Lang) ?? 'en';
const LANG_NAME: Record<Lang, string> = { en: 'English', fr: 'French', ar: 'Arabic' };
const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const at = (obj: any, path: (string | number)[]) => path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
let csrf = '';

const api = async (action: string, body?: unknown) => {
  const res = await fetch(`${API}?action=${action}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ ok: false, code: 'server' }));
  if (data.csrf) csrf = data.csrf;
  return { ...data, ok: res.ok && data.ok, status: res.status };
};

const style = document.createElement('style');
style.textContent = `
.mn-editable { outline: 1px dashed rgba(255, 122, 77, 0.55) !important; outline-offset: 3px; cursor: text !important; }
.mn-editable:hover { outline: 2px solid #ff7a4d !important; background-color: rgba(228, 78, 29, 0.12); }
.mn-editable[contenteditable] { outline: 2px solid #ff7a4d !important; background-color: rgba(0, 0, 0, 0.55); color: #fff; }
.mn-editable.mn-changed { outline-color: #4ade80 !important; outline-style: solid !important; }
/* In edit mode the moving rows stand still (reviews wall, logo strips, text tickers), so their texts can be clicked and typed into */
.reviews__track, .ticker__track, .strip__track, .giant__row { animation-play-state: paused !important; }
.mn-live { position: fixed; z-index: 2147483000; left: 50%; bottom: 16px; transform: translateX(-50%); display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 12px; width: max-content; max-width: calc(100vw - 24px); padding: 10px 14px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 14px; background: rgba(12, 12, 12, 0.96); box-shadow: 0 18px 50px rgba(0, 0, 0, 0.6); color: #f4f4f4; font: 500 13px/1.4 Inter, system-ui, sans-serif; letter-spacing: 0; text-transform: none; direction: ltr; }
.mn-live b { color: #ff7a4d; }
.mn-live__icon { width: 15px; height: 15px; margin-inline-end: 6px; vertical-align: -3px; }
.mn-live small { color: #a3a3a3; font-size: 12px; }
.mn-live button, .mn-live a { all: unset; cursor: pointer; padding: 7px 14px; border: 1px solid rgba(255, 255, 255, 0.28); border-radius: 8px; font: inherit; color: inherit; }
.mn-live button:hover, .mn-live a:hover { border-color: #fff; }
.mn-live .mn-primary { background: #e44e1d; border-color: #e44e1d; color: #000; }
.mn-live button:disabled { opacity: 0.4; cursor: not-allowed; }
.mn-live__msg { flex-basis: 100%; text-align: center; color: #a3a3a3; font-size: 12px; }
.mn-live__msg.is-error { color: #ff9b9b; }
.mn-live__msg.is-ok { color: #86efac; }`;

const bar = document.createElement('div');
bar.className = 'mn-live';
bar.setAttribute('role', 'region');
bar.setAttribute('aria-label', 'Live editing');

const exit = () => {
  try {
    sessionStorage.removeItem('mn-edit');
  } catch {}
  const url = new URL(location.href);
  url.searchParams.delete('edit');
  location.href = url.toString();
};

(async () => {
  try {
    sessionStorage.setItem('mn-edit', '1');
  } catch {}
  document.head.append(style);
  document.body.append(bar);
  bar.innerHTML = '<span>Loading…</span>';

  const session = await api('session');
  if (!session.user) {
    bar.innerHTML = `<span><b>Live editor</b> · sign in first.</span><a href="/admin/">Sign in</a><button type="button" data-exit>Exit</button>`;
    bar.querySelector('[data-exit]')!.addEventListener('click', exit);
    return;
  }
  const [contentRes, defaults] = await Promise.all([api('content'), fetch('/admin/strings.json').then((r) => r.json() as Promise<Record<Lang, any>>)]);
  if (!contentRes.ok) {
    bar.innerHTML = `<span>Could not load the content (${contentRes.code}).</span><button type="button" data-exit>Exit</button>`;
    bar.querySelector('[data-exit]')!.addEventListener('click', exit);
    return;
  }
  let content = contentRes.content;
  content.texts = content.texts && !Array.isArray(content.texts) ? content.texts : {};

  // ---------- what each visible text is ----------
  const index = new Map<string, Target[]>();
  const add = (text: string, target: Target) => {
    const key = norm(text);
    // Very short texts (a dot, a number) are too ambiguous to edit by matching.
    if (key.length < 2 || /^[\d\s.,:·/+-]+$/.test(key)) return;
    const list = index.get(key) ?? [];
    if (!list.some((t) => JSON.stringify(t) === JSON.stringify(target))) list.push(target);
    index.set(key, list);
  };
  // The value shown now (saved in the dashboard, else built in), for one target.
  const itemOf = (t: Extract<Target, { kind: 'field' }>) => {
    const item = (content[t.list] ?? []).find((x: any) => x.id === t.id);
    return t.photo ? item?.photos?.find((p: any) => p.id === t.photo) : item;
  };
  const current = (t: Target): string => {
    if (t.kind === 'field') {
      const v = itemOf(t)?.[t.field];
      return t.localized ? v?.[lang] || v?.en || '' : (v ?? '');
    }
    const saved = at(content.texts, [...t.path, lang]);
    return typeof saved === 'string' && saved.trim() ? saved : (at(defaults[lang], t.path) ?? '');
  };
  const walk = (node: any, path: (string | number)[]) => {
    if (typeof node === 'string') {
      const target: Target = { kind: 'text', path };
      add(node, target);
      add(current(target), target);
    } else if (Array.isArray(node)) {
      // A list changed in the dashboard (e.g. the services) replaces the built-in one.
      const saved = at(content.texts, path);
      const items = Array.isArray(saved) ? saved : node;
      items.forEach((item: any, i: number) => walk(Array.isArray(saved) ? Object.fromEntries(Object.keys(node[0] ?? item).map((k) => [k, item?.[k]?.[lang] || item?.[k]?.en || ''])) : item, [...path, i]));
    } else if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => walk(v, [...path, k]));
  };
  walk(defaults[lang], []);
  // Dashboard items shown on the pages.
  const addField = (list: ListName, item: any, field: string, localized: boolean, photo?: any) => {
    const target: Target = { kind: 'field', list, id: item.id, field, localized, ...(photo ? { photo: photo.id } : {}) };
    const v = (photo ?? item)[field];
    if (localized) {
      add(v?.[lang] || v?.en || '', target);
      add(v?.en || '', target);
    } else add(v ?? '', target);
  };
  for (const list of ['films', 'albums', 'filmCategories', 'photoCategories'] as const) for (const item of content[list] ?? []) addField(list, item, 'title', true);
  for (const album of content.albums ?? []) for (const photo of album.photos ?? []) if (photo.id) addField('albums', album, 'alt', true, photo);
  for (const review of content.reviews ?? []) {
    addField('reviews', review, 'quote', false);
    addField('reviews', review, 'sector', true);
    if (!review.clientId) addField('reviews', review, 'name', false);
  }
  for (const client of content.clients ?? []) addField('clients', client, 'name', false);
  for (const advice of content.advice ?? []) addField('advice', advice, 'title', false);
  // When a text is both a dashboard item and a sentence of the site (a category named like a menu word), the item wins:
  // editing a category tab renames the category itself.
  for (const [key, list] of index) if (list.some((t) => t.kind === 'field')) index.set(key, list.filter((t) => t.kind === 'field'));

  // ---------- mark the elements ----------
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'svg', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'VIDEO', 'IMG', 'DIALOG']);
  const targetsOf = new WeakMap<HTMLElement, Target[]>();
  const marked: HTMLElement[] = [];
  const mark = (el: HTMLElement, targets: Target[]) => {
    targetsOf.set(el, targets);
    el.classList.add('mn-editable');
    el.title = 'Click to edit';
    if (!marked.includes(el)) marked.push(el);
  };
  for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
    if (SKIP.has(el.tagName) || el.closest('.mn-live, .sr-only, dialog, svg, [data-preloader], .preloader')) continue;
    const text = norm(el.textContent);
    const targets = text && index.get(text);
    if (!targets) continue;
    // The innermost element holding the text (a heading, not the section around it).
    if ([...el.children].some((child) => norm(child.textContent) === text)) continue;
    mark(el, targets);
  }
  // Text sitting next to other elements (a film name after its category label): wrapped so it can be edited alone.
  for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
    if (SKIP.has(el.tagName) || !el.children.length || el.classList.contains('mn-editable') || el.closest('.mn-live, .sr-only, dialog, svg, .preloader')) continue;
    for (const node of [...el.childNodes]) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const text = norm(node.textContent);
      const targets = text && index.get(text);
      if (!targets) continue;
      const span = document.createElement('span');
      span.textContent = node.textContent;
      node.replaceWith(span);
      mark(span, targets);
    }
  }
  const sameTargets = (a: Target[], b: Target[]) => a.some((x) => b.some((y) => JSON.stringify(x) === JSON.stringify(y)));
  const show = (el: HTMLElement, value: string) => {
    if (norm(el.textContent) !== norm(value)) el.textContent = value;
  };
  // Saved but not yet put online: show it here already, so a refresh shows the latest words.
  for (const el of marked) show(el, current(targetsOf.get(el)![0]));

  // Texts written when something opens (the photo viewer's caption and album name, the film player's title):
  // made editable each time they change.
  const watched = document.querySelectorAll<HTMLElement>('[data-lightbox-cap], [data-lightbox-album], [data-theater-title]');
  const watch = new MutationObserver((records) => {
    for (const r of records) {
      const el = (r.target.nodeType === Node.ELEMENT_NODE ? r.target : r.target.parentElement) as HTMLElement | null;
      const box = el?.closest<HTMLElement>('[data-lightbox-cap], [data-lightbox-album], [data-theater-title]');
      if (!box || box === editing) continue;
      const targets = index.get(norm(box.textContent));
      if (targets) {
        mark(box, targets);
        watch.disconnect();
        show(box, current(targets[0]));
        watched.forEach((w) => watch.observe(w, { childList: true, characterData: true, subtree: true }));
      } else {
        box.classList.remove('mn-editable');
        targetsOf.delete(box);
      }
    }
  });
  watched.forEach((w) => watch.observe(w, { childList: true, characterData: true, subtree: true }));

  // ---------- edit ----------
  const pending = new Map<string, { targets: Target[]; value: string }>();
  let editing: HTMLElement | null = null;

  const finish = () => {
    const el = editing;
    if (!el) return;
    editing = null;
    el.removeAttribute('contenteditable');
    const targets = targetsOf.get(el)!;
    // textContent, not innerText: innerText would return the text as styled (e.g. in capitals).
    const value = norm(el.textContent);
    if (!value) {
      show(el, current(targets[0]));
      return;
    }
    if (value === norm(current(targets[0])) && !pending.has(JSON.stringify(targets))) return;
    pending.set(JSON.stringify(targets), { targets, value });
    // The same text elsewhere on the page follows.
    for (const other of marked) {
      const theirs = targetsOf.get(other);
      if (theirs && sameTargets(theirs, targets)) {
        show(other, value);
        other.classList.add('mn-changed');
      }
    }
    draw();
  };

  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.mn-editable');
      if (!el || (e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey) return; // Ctrl/Cmd+click still follows a link
      e.preventDefault();
      e.stopPropagation();
      if (editing === el) return;
      finish();
      editing = el;
      el.textContent = norm(el.textContent); // drop decorative inner spans while typing
      try {
        el.contentEditable = 'plaintext-only';
      } catch {
        el.contentEditable = 'true';
      }
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    },
    true,
  );
  document.addEventListener('keydown', (e) => {
    if (!editing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      editing.blur();
    }
    if (e.key === 'Escape') {
      const el = editing;
      editing = null;
      el.removeAttribute('contenteditable');
      show(el, current(targetsOf.get(el)![0]));
    }
  });
  document.addEventListener('focusout', (e) => {
    if (editing && e.target === editing) finish();
  });

  // ---------- save into the content ----------
  const apply = (target: Target, value: string) => {
    if (target.kind === 'field') {
      const item = itemOf(target);
      if (!item) return;
      // Only the language of this page changes; the others keep their own words.
      item[target.field] = target.localized ? { en: '', fr: '', ar: '', ...item[target.field], [lang]: value } : value;
      return;
    }
    // Walk down the saved texts, creating what is missing; a list is copied whole from the built-in one first.
    let node: any = content.texts;
    for (let i = 0; i < target.path.length; i++) {
      const key = target.path[i];
      const def = at(defaults.en, target.path.slice(0, i + 1));
      if (Array.isArray(def) && !Array.isArray(node[key])) {
        node[key] = def.map((_: unknown, n: number) => Object.fromEntries(Object.keys(def[0]).map((k) => [k, { en: at(defaults.en, [...target.path.slice(0, i + 1), n, k]) ?? '', fr: at(defaults.fr, [...target.path.slice(0, i + 1), n, k]) ?? '', ar: at(defaults.ar, [...target.path.slice(0, i + 1), n, k]) ?? '' }])));
      }
      node = node[key] ??= {};
    }
    node[lang] = value;
  };

  const save = async () => {
    finish();
    if (!pending.size) return;
    setMsg('Saving…');
    for (const { targets, value } of pending.values()) targets.forEach((t) => apply(t, value));
    const res = await api('save', { revision: content.revision, content });
    if (res.ok) {
      content.revision = res.revision;
      pending.clear();
      marked.forEach((el) => el.classList.remove('mn-changed'));
      draw();
      setMsg('Saved. Publish to update the live site.', 'ok');
      return;
    }
    if (res.code === 'conflict') {
      // Someone saved meanwhile: take their version and put these edits on top of it.
      content = res.content;
      content.texts = content.texts && !Array.isArray(content.texts) ? content.texts : {};
      setMsg('Changed elsewhere. Press Save again to merge.', 'error');
      return;
    }
    setMsg(res.status === 401 ? 'Signed out. Sign in again, then Save.' : `Could not save (${res.code}).`, 'error');
  };

  const publish = async () => {
    if (pending.size) return setMsg('Save your changes first.', 'error');
    if (!confirm('Publish your saved changes? The site updates in 3–5 minutes.')) return;
    const res = await api('publish', {});
    setMsg(res.ok ? 'Publishing. Live in 3–5 minutes.' : res.code === 'publish_not_configured' ? 'Publishing is not set up on the server yet.' : `Publish failed (${res.code}).`, res.ok ? 'ok' : 'error');
  };

  // ---------- the bar ----------
  let message = '';
  let tone = '';
  const setMsg = (text: string, kind = '') => {
    message = text;
    tone = kind;
    draw();
  };
  const draw = () => {
    bar.innerHTML = '';
    const info = document.createElement('span');
    info.innerHTML = `<b>Live editor</b> · ${LANG_NAME[lang]} · ${marked.length} texts`;
    info.querySelector('b')!.prepend(createElement(SquarePen, { class: 'mn-live__icon', 'aria-hidden': 'true', 'stroke-width': 1.75 }));
    const saveBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'mn-primary', textContent: pending.size ? `Save ${pending.size} change${pending.size > 1 ? 's' : ''}` : 'Saved', disabled: !pending.size });
    saveBtn.addEventListener('click', save);
    const pubBtn = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Publish' });
    pubBtn.addEventListener('click', publish);
    const dash = Object.assign(document.createElement('a'), { href: '/admin/', textContent: 'Dashboard' });
    const out = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Exit' });
    out.addEventListener('click', () => (!pending.size || confirm('Leave without saving your changes?')) && exit());
    bar.append(info, saveBtn, pubBtn, dash, out);
    if (message) bar.append(Object.assign(document.createElement('span'), { className: `mn-live__msg${tone ? ` is-${tone}` : ''}`, textContent: message }));
  };
  window.addEventListener('beforeunload', (e) => {
    if (pending.size) e.preventDefault();
  });
  draw();
})();
