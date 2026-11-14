// The dashboard app: sign-in, then one screen per kind of content (#films, #albums/…, #texts…).
// Edits stay in the browser until "Save", which stores them on the server. "Publish" then rebuilds the website with them.
import { call, upload } from './api';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Camera, ChevronDown, Clapperboard, Contact, Film, GalleryHorizontalEnd, Handshake, House, Images, KeyRound,
  Languages, MapPin, MessageSquareQuote, MonitorPlay, Phone, Settings, SquarePen, Star, Tags, Video, type IconNode,
} from 'lucide';
import { checkbox, emptyL, flag, h, icon, localized, media, onChange, put, select, slugify, text, textarea, toast, uid, type Img, type L, type Vid } from './ui';

type Cat = { id: string; slug: string; title: L };
type Film = { id: string; slug: string; title: L; description: L; categoryId: string; featured: boolean; onHome: boolean; date: string; video: Vid | null; poster: Img | null };
type Photo = Img & { id: string; alt: L };
type Album = { id: string; slug: string; title: L; categoryId: string; onHome: boolean; photos: Photo[] };
type Client = { id: string; name: string; tone: boolean; logo: Img | null };
type Review = { id: string; clientId: string; name: string; logo: Img | null; sector: L; quote: string; rating: number; placeholder: boolean };
type HeroFilm = { id: string; video: Vid | null; videoMobile: Vid | null };
type CurveCard = { id: string; kind: 'image' | 'video'; image: Img | null; video: Vid | null; href: string };
type Social = { id: string; label: string; handle: string; href: string; icon: string };
interface Content {
  revision: number;
  updatedAt?: string;
  updatedBy?: string;
  settings: { name: string; jobTitle: string; logoAlt: string; email: string; whatsapp: string; phone: string; socials: Social[]; logo: Img | null; logoMark: Img | null; logoWordmark: Img | null };
  home: { videos: HeroFilm[]; poster: Img | null; posterMobile: Img | null; aboutPhoto: Img | null; video?: Vid | null; videoMobile?: Vid | null };
  curve: { items: CurveCard[] };
  texts: Record<string, any>;
  filmCategories: Cat[];
  films: Film[];
  photoCategories: Cat[];
  albums: Album[];
  clients: Client[];
  reviews: Review[];
}

const app = document.getElementById('app')!;
const DEFAULTS = JSON.parse(document.getElementById('defaults')!.textContent!) as Record<'en' | 'fr' | 'ar', Record<string, any>>;

const state = {
  user: null as string | null,
  content: null as Content | null,
  dirty: false,
  saving: false,
  status: null as null | { revision: number; publishedRevision: number; publishedAt: string | null; canPublish: boolean; run: null | { status: string; conclusion: string | null; startedAt: string; url: string } },
  filmFilter: 'all',
  albumFilter: 'all',
};

// ---------------------------------------------------------------- shell
const markDirty = () => {
  state.dirty = true;
  drawBar();
};
onChange(markDirty);
window.addEventListener('beforeunload', (e) => {
  if (state.dirty) e.preventDefault();
});

// The menu follows the pages of the site, in plain words. `where` tells, on each screen, what on the site it changes;
// `link` opens that place on the site.
// An item with `group` starts a folding group of the menu; the items after it belong to it until the next group.
type NavItem = { group?: string; hash: string; label: string; title?: string; icon: IconNode; where: string; link?: string; count?: () => number };
const GROUP_ICONS: Record<string, IconNode> = { Home: House, Films: Film, Photography: Camera, Settings };
const NAV: NavItem[] = [
  { hash: 'live', label: 'Live editor', icon: SquarePen, where: 'Any page, in edit mode', link: '/?edit' },
  { group: 'Home', hash: 'home', label: 'Hero', icon: MonitorPlay, where: 'Home page, top', link: '/', count: () => state.content!.home.videos.length },
  { hash: 'carousel', label: 'Carousel', icon: GalleryHorizontalEnd, where: 'Home page, curved photo row', link: '/#curve-title', count: () => state.content!.curve.items.length || autoCurve().length },
  { hash: 'clients', label: 'Clients', icon: Handshake, where: 'Home page, logo band', link: '/#clients', count: () => state.content!.clients.length },
  { hash: 'reviews', label: 'Reviews', icon: MessageSquareQuote, where: 'Home page and Reviews page', link: '/reviews/', count: () => state.content!.reviews.length },
  { group: 'Films', hash: 'films', label: 'All films', icon: Clapperboard, where: 'Films page and home page', link: '/films/', count: () => state.content!.films.length },
  { hash: 'film-categories', label: 'Categories', title: 'Film categories', icon: Tags, where: 'Films page, filter tabs', link: '/films/', count: () => state.content!.filmCategories.length },
  { group: 'Photography', hash: 'albums', label: 'All albums', icon: Images, where: 'Photography page and home page', link: '/photography/', count: () => state.content!.albums.length },
  { hash: 'photo-categories', label: 'Categories', title: 'Photo categories', icon: Tags, where: 'Photography page, filter tabs', link: '/photography/', count: () => state.content!.photoCategories.length },
  { group: 'Settings', hash: 'texts', label: 'Site texts', icon: Languages, where: 'All pages, 3 languages', link: '/' },
  { hash: 'settings', label: 'Brand & contact', icon: Contact, where: 'Header, footer and Contact page', link: '/contact/' },
  { hash: 'account', label: 'Account', icon: KeyRound, where: 'Dashboard only' },
];

const route = () => {
  const [section, id] = location.hash.replace(/^#/, '').split('/');
  return { section: section || 'live', id };
};
const go = (hash: string) => {
  if (location.hash === `#${hash}`) render();
  else location.hash = hash;
};
window.addEventListener('hashchange', () => render());

// The logo mark of the site header: the one set in Brand & contact, else the built-in one (from the page).
const logoSrc = () => state.content?.settings.logoMark?.path || app.dataset.logo || '/favicon.png';

// The side menu. "Live editor" stays on top; each page of the site is a group that folds open and
// closed. The group of the screen on show is always open; the others stay as the user left them (kept per browser).
const OPEN_KEY = 'mn-admin-open-groups';
const openGroups = ((): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
})();
const keepOpenGroups = () => {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify([...openGroups]));
  } catch {
    // private window or blocked storage: the menu still works, it just forgets
  }
};
const navLink = (n: NavItem, section: string) =>
  h('a', { href: `#${n.hash}`, 'aria-current': section === n.hash ? 'page' : undefined }, h('span', { class: 'side__label' }, icon(n.icon), n.label), n.count && h('small', {}, n.count()));
function sideMenu(section: string) {
  const top: NavItem[] = [];
  const groups: { name: string; items: NavItem[] }[] = [];
  for (const n of NAV) {
    if (n.group) groups.push({ name: n.group, items: [] });
    (groups.at(-1)?.items ?? top).push(n);
  }
  return [
    top.map((n) => navLink(n, section)),
    groups.map(({ name, items }, i) => {
      if (items.some((n) => n.hash === section)) openGroups.add(name);
      const open = openGroups.has(name);
      const box = h('div', { class: `side__section${open ? ' is-open' : ''}` });
      const toggle: HTMLButtonElement = h('button', {
        class: 'side__group', type: 'button', 'aria-expanded': String(open), 'aria-controls': `side-group-${i}`,
        onClick: () => {
          const now = box.classList.toggle('is-open');
          toggle.setAttribute('aria-expanded', String(now));
          if (now) openGroups.add(name);
          else openGroups.delete(name);
          keepOpenGroups();
        },
      }, icon(GROUP_ICONS[name] ?? Settings), h('span', {}, name), icon(ChevronDown, 'side__chevron'));
      put(box, toggle, h('div', { class: 'side__items', id: `side-group-${i}` }, h('div', { class: 'side__inner' }, items.map((n) => navLink(n, section)))));
      return box;
    }),
  ];
}

let barEl: HTMLElement | null = null;
const drawBar = () => {
  if (!barEl || !state.content) return;
  const s = state.status;
  const unpublished = s ? s.revision !== s.publishedRevision : false;
  const run = s?.run;
  const building = run && run.status !== 'completed';
  const stateText = state.saving ? 'Saving…' : state.dirty ? 'Unsaved changes' : building ? 'Publishing…' : unpublished ? 'Saved, not published' : 'Published';
  const tone = state.saving || building ? 'busy' : state.dirty || unpublished ? 'dirty' : 'ok';
  const failed = run && run.status === 'completed' && run.conclusion && run.conclusion !== 'success';
  barEl.replaceChildren();
  put(barEl,
    h('h1', { class: 'bar__title' }, ((n) => [n && icon(n.icon), n?.title ?? n?.label ?? 'Dashboard'])(NAV.find((n) => n.hash === route().section))),
    h('span', { class: 'bar__state', 'data-tone': failed ? 'error' : tone }, failed ? 'Publish failed' : stateText),
    failed && h('a', { class: 'btn btn--sm btn--ghost', href: run!.url, target: '_blank', rel: 'noopener' }, 'Details'),
    h('button', { class: 'btn', type: 'button', disabled: !state.dirty || state.saving, onClick: save }, 'Save'),
    h('button', { class: 'btn btn--primary', type: 'button', disabled: state.dirty || state.saving || !!building || !s?.canPublish, title: s && !s.canPublish ? 'Publishing is not set up on the server yet (github_token in api/config.php).' : undefined, onClick: publish }, 'Publish'),
    h('a', { class: 'btn btn--ghost', href: '/', target: '_blank', rel: 'noopener' }, 'View site', icon(ArrowUpRight)),
  );
};

function render() {
  if (!state.user) return renderLogin();
  if (!state.content) return;
  const { section, id } = route();
  barEl = h('header', { class: 'bar' });
  const view = h('section', { class: 'view' });
  const side = h('nav', { class: 'side', 'aria-label': 'Dashboard' },
    h('a', { class: 'side__brand', href: '#live', title: 'Live editor' }, h('img', { src: logoSrc(), alt: 'MN Visual' })),
    sideMenu(section),
    h('p', { class: 'side__foot' }, 'Signed in as ', h('br'), state.user),
  );
  app.className = '';
  app.replaceChildren(h('div', { class: 'shell' }, side, h('main', { class: 'main' }, barEl, view)));
  drawBar();
  const screens: Record<string, (view: HTMLElement, id?: string) => void> = {
    films: filmsScreen,
    'film-categories': (v) => categoriesScreen(v, 'film'),
    albums: albumsScreen,
    'photo-categories': (v) => categoriesScreen(v, 'photo'),
    live: liveScreen,
    home: homeScreen,
    carousel: carouselScreen,
    texts: textsScreen,
    settings: settingsScreen,
    clients: clientsScreen,
    reviews: reviewsScreen,
    account: accountScreen,
  };
  const here = NAV.find((n) => n.hash === section) ?? NAV[0];
  put(view, h('div', { class: 'where' }, icon(MapPin, 'where__pin'), h('p', {}, h('strong', {}, 'Shown on: '), here.where), here.link && h('a', { class: 'btn btn--sm', href: here.link, target: '_blank', rel: 'noopener' }, 'View', icon(ArrowUpRight))));
  (screens[section] ?? liveScreen)(view, id);
  window.scrollTo({ top: 0 });
}

// ---------------------------------------------------------------- sign in
function renderLogin(message = '') {
  const form = { email: '', password: '' };
  const error = h('p', { class: 'notice notice--error', hidden: !message, role: 'alert' }, message);
  const button = h('button', { class: 'btn btn--primary', type: 'submit' }, 'Sign in');
  app.className = '';
  app.replaceChildren(
    h('main', { class: 'login' },
      h('div', { class: 'login__card' },
        h('p', { class: 'login__brand' }, h('img', { src: logoSrc(), alt: 'MN Visual' })),
        h('p', { class: 'login__sub' }, 'Sign in to the dashboard.'),
        h('form', {
          onSubmit: async (e: Event) => {
            e.preventDefault();
            button.disabled = true;
            const res = await call('login', form);
            button.disabled = false;
            if (res.ok) {
              state.user = res.user;
              await boot();
              return;
            }
            error.hidden = false;
            error.textContent =
              ({
                wrong_login: 'Wrong email or password.',
                rate_limited: `Too many attempts. Try again in ${Math.ceil((res.retryIn ?? 900) / 60)} minutes.`,
                not_configured: 'No login is set up on the server yet: fill in admin_email and admin_password_hash in api/config.php.',
                no_api: 'The dashboard API was not found. Open the dashboard on the server (or with npm run admin:local), not with the Astro dev server.',
                network: 'No connection to the server.',
              } as Record<string, string>)[res.code ?? ''] ?? 'Sign-in failed. Try again.';
          },
        },
          h('label', { class: 'field' }, h('span', {}, 'Email'), h('input', { type: 'email', autocomplete: 'username', required: true, autofocus: true, onInput: (e: Event) => (form.email = (e.target as HTMLInputElement).value) })),
          h('label', { class: 'field' }, h('span', {}, 'Password'), h('input', { type: 'password', autocomplete: 'current-password', required: true, onInput: (e: Event) => (form.password = (e.target as HTMLInputElement).value) })),
          error,
          button,
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------- save / publish
const errorsOf = (c: Content) => {
  const errors: { text: string; hash: string }[] = [];
  const need = (ok: unknown, text: string, hash: string) => !ok && errors.push({ text, hash });
  const filmCats = new Set(c.filmCategories.map((x) => x.id));
  const photoCats = new Set(c.photoCategories.map((x) => x.id));
  c.filmCategories.forEach((x, i) => need(x.title.en.trim(), `Film category ${i + 1} needs an English name.`, 'film-categories'));
  c.photoCategories.forEach((x, i) => need(x.title.en.trim(), `Photo category ${i + 1} needs an English name.`, 'photo-categories'));
  c.films.forEach((f) => {
    const at = `films/${f.id}`;
    const name = f.title.en || 'A film';
    need(f.title.en.trim(), 'A film has no English title.', at);
    need(filmCats.has(f.categoryId), `${name}: choose a category.`, at);
    need(f.video, `${name}: upload the video.`, at);
    need(f.poster, `${name}: upload a poster image.`, at);
  });
  c.albums.forEach((a) => {
    const at = `albums/${a.id}`;
    const name = a.title.en || 'An album';
    need(a.title.en.trim(), 'An album has no English title.', at);
    need(photoCats.has(a.categoryId), `${name}: choose a category.`, at);
    need(a.photos.length, `${name}: add at least one photo.`, at);
  });
  need(c.home.videos.length && c.home.poster, 'Homepage hero: add at least one film and the still image.', 'home');
  c.home.videos.forEach((v, i) => need(v.video, `Homepage hero: film ${i + 1} has no video yet (upload it or delete the row).`, 'home'));
  c.curve.items.forEach((item, i) => {
    need(item.kind === 'video' ? item.video : item.image, `Closing carousel: card ${i + 1} needs its ${item.kind === 'video' ? 'video' : 'photo'}.`, 'carousel');
    need(!item.href.trim() || /^(https?:\/\/|\/)/.test(item.href.trim()), `Closing carousel: the link of card ${i + 1} must start with https:// or /.`, 'carousel');
  });
  need(c.settings.name.trim() && c.settings.logo && c.settings.logoMark, 'Brand & contact: name, logo and mark are required.', 'settings');
  c.clients.forEach((x) => need(x.name.trim() && x.logo, `Client "${x.name || '?'}": name and logo are required.`, `clients/${x.id}`));
  const clientIds = new Set(c.clients.map((x) => x.id));
  c.reviews.forEach((r) => {
    need(r.quote.trim(), 'A review needs a quote.', `reviews/${r.id}`);
    need(clientIds.has(r.clientId) || (r.name.trim() && r.logo), `Review "${r.quote.slice(0, 30)}…": choose a client, or type a name and upload a logo.`, `reviews/${r.id}`);
  });
  return errors;
};

async function save() {
  const content = state.content!;
  fillSlugs(content.films, 'film');
  fillSlugs(content.albums, 'album');
  fillSlugs(content.filmCategories, 'category');
  fillSlugs(content.photoCategories, 'category');
  const errors = errorsOf(content);
  if (errors.length) {
    showErrors(errors);
    return;
  }
  state.saving = true;
  drawBar();
  const res = await call('save', { revision: content.revision, content });
  state.saving = false;
  if (res.ok) {
    content.revision = res.revision;
    content.updatedAt = res.updatedAt;
    state.dirty = false;
    drawBar();
    toast('Saved.');
    await refreshStatus();
    return;
  }
  drawBar();
  if (res.code === 'conflict') return conflict(res.content);
  if (res.status === 401) return renderLogin('You were signed out. Sign in again; your changes are kept, then press Save.');
  toast(`Could not save (${res.code ?? 'server error'}).`, 'error');
}

function showErrors(errors: { text: string; hash: string }[]) {
  const view = document.querySelector('.view')!;
  view.querySelector('.notice--error')?.remove();
  view.prepend(h('div', { class: 'notice notice--error', role: 'alert' }, 'Fix these before saving:', h('ul', {}, errors.slice(0, 12).map((e) => h('li', {}, h('a', { href: `#${e.hash}`, style: { color: 'inherit' } }, e.text))))));
  window.scrollTo({ top: 0 });
}

// Someone saved from another tab or device since this page loaded.
function conflict(theirs: Content) {
  const view = document.querySelector('.view')!;
  view.prepend(
    h('div', { class: 'notice notice--accent', role: 'alert' },
      h('p', { style: { margin: '0 0 10px' } }, `These changes were saved elsewhere meanwhile${theirs.updatedBy ? ` (by ${theirs.updatedBy})` : ''}. Keep which version?`),
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn btn--sm btn--primary', type: 'button', onClick: () => ((state.content!.revision = theirs.revision), save()) }, 'Keep mine (replace theirs)'),
        h('button', { class: 'btn btn--sm', type: 'button', onClick: () => ((state.content = theirs), (state.dirty = false), render()) }, 'Load theirs (drop mine)'),
      ),
    ),
  );
}

let statusTimer = 0;
async function refreshStatus() {
  const res = await call('status');
  if (res.ok) state.status = res as any;
  drawBar();
  clearTimeout(statusTimer);
  // While a build runs, check on it every 15 seconds.
  if (state.status?.run && state.status.run.status !== 'completed') statusTimer = window.setTimeout(refreshStatus, 15000);
}

async function publish() {
  if (!confirm('Publish your saved changes? The site updates in 3–5 minutes.')) return;
  const res = await call('publish', {});
  if (!res.ok) {
    toast(res.code === 'publish_not_configured' ? 'Publishing is not set up on the server yet (github_token in api/config.php).' : `Publishing failed (${res.code}${res.status ? ` ${res.status}` : ''}).`, 'error');
    return;
  }
  toast('Publishing. Live in 3–5 minutes.');
  if (state.status) state.status.run = { status: 'queued', conclusion: null, startedAt: new Date().toISOString(), url: '' };
  drawBar();
  setTimeout(refreshStatus, 6000);
}

// ---------------------------------------------------------------- list helpers
const move = <T>(list: T[], i: number, by: number) => {
  const j = i + by;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  markDirty();
  render();
};
const remove = <T>(list: T[], i: number, what: string) => {
  if (!confirm(`Delete ${what}?`)) return false;
  list.splice(i, 1);
  markDirty();
  return true;
};
// Takes the user to an item just added inside a list: scrolls to it, puts the cursor in its first field and outlines it
// for a moment. Runs on the next frame, after render() has drawn the screen (and scrolled it to the top).
const reveal = (find: () => Element | null | undefined) =>
  requestAnimationFrame(() => {
    const el = find();
    if (!(el instanceof HTMLElement)) return;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    el.querySelector<HTMLElement>('input:not([type=file]):not([type=hidden]), textarea, select')?.focus({ preventScroll: true });
    el.classList.remove('is-new');
    void el.offsetWidth; // restart the outline animation when the same box is revealed twice
    el.classList.add('is-new');
  });
const lastRow = () => document.querySelector('.view .rows > :last-child');
const newReview = () => {
  const c = state.content!;
  const x: Review = { id: uid('review'), clientId: c.clients[0]?.id ?? '', name: '', logo: null, sector: emptyL(), quote: '', rating: 5, placeholder: false };
  c.reviews.push(x);
  markDirty();
  go(`reviews/${x.id}`);
};
const rowActions = (list: unknown[], i: number, onEdit?: () => void, what = 'this item') =>
  h('div', { class: 'row__actions' },
    h('button', { class: 'btn btn--sm btn--icon', type: 'button', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onClick: () => move(list, i, -1) }, icon(ArrowUp)),
    h('button', { class: 'btn btn--sm btn--icon', type: 'button', title: 'Move down', 'aria-label': 'Move down', disabled: i === list.length - 1, onClick: () => move(list, i, 1) }, icon(ArrowDown)),
    onEdit && h('button', { class: 'btn btn--sm', type: 'button', onClick: onEdit }, 'Edit'),
    h('button', { class: 'btn btn--sm btn--danger', type: 'button', onClick: () => remove(list, i, what) && render() }, 'Delete'),
  );
const thumb = (img: Img | null | undefined) => h('div', { class: 'row__thumb' }, img?.path && h('img', { src: img.path, alt: '', loading: 'lazy', style: { objectPosition: img.focus ?? '50% 50%' } }));
const catName = (list: Cat[], id: string) => list.find((c) => c.id === id)?.title.en ?? 'No category';
const filterChips = (cats: Cat[], current: string, items: { categoryId: string }[], pick: (id: string) => void) =>
  h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by category' },
    [{ id: 'all', title: { en: 'All' } as L }, ...cats].map((c) =>
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(current === c.id), onClick: () => pick(c.id) }, c.title.en, ' ', h('span', {}, c.id === 'all' ? items.length : items.filter((x) => x.categoryId === c.id).length)),
    ),
  );
const back = (hash: string, label: string) => h('a', { class: 'btn btn--sm btn--ghost', href: `#${hash}` }, '← ', label);
// The URL name is never typed: it is made from the English title, with -2, -3… when two share the same title.
type Sluggable = { slug: string; title: L };
const syncSlug = (item: Sluggable, list: Sluggable[], fallback: string) => {
  const base = slugify(item.title.en) || fallback;
  const taken = new Set(list.filter((x) => x !== item).map((x) => x.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  item.slug = slug;
};
// Follows the title as it is typed (its first input is the English one); `after` shows the result.
const slugFollows = (titleField: HTMLElement, item: Sluggable, list: Sluggable[], fallback: string, after?: () => void) =>
  titleField.querySelector('input')!.addEventListener('input', () => (syncSlug(item, list, fallback), after?.()));
// Before saving, fills in any URL name that is missing, malformed or used twice.
const fillSlugs = (list: Sluggable[], fallback: string) => {
  const seen = new Set<string>();
  for (const item of list) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.slug) || seen.has(item.slug)) syncSlug(item, list, fallback);
    seen.add(item.slug);
  }
};

// ---------------------------------------------------------------- live editing on the pages
function liveScreen(view: HTMLElement) {
  const PAGES: [string, string][] = [['Home page', '/'], ['Films', '/films/'], ['Photography', '/photography/'], ['Reviews', '/reviews/'], ['Contact', '/contact/']];
  const LANGS: [string, string][] = [['English', ''], ['Français', '/fr'], ['العربية', '/ar']];
  put(view,
    h('div', { class: 'card' },
      h('p', { class: 'card__title' }, 'Edit texts in place'),
      h('ol', { class: 'steps steps--big' },
        h('li', {}, h('strong', {}, 'Open a page.'), ' Editable texts are outlined.'),
        h('li', {}, h('strong', {}, 'Click and type.'), ' Enter to confirm, Esc to cancel.'),
        h('li', {}, h('strong', {}, 'Save'), ' from the bottom bar.'),
        h('li', {}, h('strong', {}, 'Publish'), ' to update the live site.'),
      ),
      h('p', { class: 'hint' }, 'Ctrl/Cmd + click follows a link. Photos and videos are edited in the dashboard.'),
    ),
    LANGS.map(([name, prefix]) =>
      h('div', { class: 'card' },
        h('p', { class: 'card__title' }, name),
        h('div', { class: 'tiles' }, PAGES.map(([title, path]) => h('a', { class: 'tile', href: `${prefix}${path}?edit`, target: '_blank', rel: 'noopener' }, icon(SquarePen, 'tile__icon'), h('strong', {}, title), h('span', {}, `${prefix}${path}`)))),
      ),
    ),
  );
}

// ---------------------------------------------------------------- films
function filmsScreen(view: HTMLElement, id?: string) {
  const c = state.content!;
  if (id) return filmDetail(view, id);
  const list = c.films.filter((f) => state.filmFilter === 'all' || f.categoryId === state.filmFilter);
  put(view,
    h('div', { class: 'toolbar' },
      h('p', { class: 'hint grow' }, 'Same order as on the site.'),
      h('button', {
        class: 'btn btn--primary', type: 'button', disabled: !c.filmCategories.length,
        onClick: () => {
          const film: Film = { id: uid('film'), slug: '', title: emptyL(), description: emptyL(), categoryId: state.filmFilter !== 'all' ? state.filmFilter : c.filmCategories[0]?.id ?? '', featured: false, onHome: true, date: new Date().toISOString().slice(0, 10), video: null, poster: null };
          c.films.push(film);
          markDirty();
          go(`films/${film.id}`);
        },
      }, '+ New film'),
    ),
    !c.filmCategories.length && h('p', { class: 'notice' }, 'Create a film category first (Film categories).'),
    filterChips(c.filmCategories, state.filmFilter, c.films, (cid) => ((state.filmFilter = cid), render())),
    list.length
      ? h('div', { class: 'rows' },
          list.map((f) => {
            const i = c.films.indexOf(f);
            return h('div', { class: 'row' },
              thumb(f.poster),
              h('div', {}, h('p', { class: 'row__title' }, f.title.en || 'Untitled film', f.featured && h('span', { class: 'badge' }, 'Showreel'), !f.onHome && h('span', { class: 'badge' }, 'Not on homepage')), h('p', { class: 'row__meta' }, `${catName(c.filmCategories, f.categoryId)} · /films/${f.slug || '…'}/`)),
              rowActions(c.films, i, () => go(`films/${f.id}`), `the film "${f.title.en || 'Untitled'}"`),
            );
          }),
        )
      : h('p', { class: 'empty' }, 'No films in this category yet.'),
  );
}

function filmDetail(view: HTMLElement, id: string) {
  const c = state.content!;
  const film = c.films.find((f) => f.id === id);
  if (!film) return go('films');
  const link = h('code', {}, `/films/${film.slug || '…'}/`);
  const title = localized('Title', film, 'title', { required: true, help: 'Also sets the page URL.' });
  slugFollows(title, film, c.films, 'film', () => (link.textContent = `/films/${film.slug}/`));
  put(view,
    h('div', { class: 'detail-head' }, back('films', 'All films'), h('h2', {}, film.title.en || 'New film'),
      h('button', { class: 'btn btn--danger', type: 'button', onClick: () => remove(c.films, c.films.indexOf(film), `the film "${film.title.en || 'Untitled'}"`) && go('films') }, 'Delete film')),
    h('div', { class: 'card' },
      title,
      h('div', { class: 'grid2' },
        select('Category', film, 'categoryId', c.filmCategories.map((x) => ({ value: x.id, label: x.title.en })), { required: true }),
        h('div', { class: 'field' }, h('span', {}, 'Web address (automatic)'), link),
      ),
      localized('Description', film, 'description', { multiline: true, help: 'Describes the poster, for accessibility and SEO.' }),
    ),
    h('div', { class: 'card' },
      h('p', { class: 'card__title' }, 'Video & poster'),
      media('Video file (MP4)', film, 'video', 'video', { required: true, help: 'H.264 MP4, compressed.' }),
      media('Poster image', film, 'poster', 'image', { required: true, focus: true, help: 'A frame from the film.' }),
    ),
    h('div', { class: 'card' },
      checkbox('Showreel', film, 'featured', { help: 'Wide banner on the Films page. One film only.', onToggle: (on) => on && c.films.forEach((f) => f !== film && (f.featured = false)) }),
      checkbox('Show in the homepage carousel', film, 'onHome'),
      text('Date', film, 'date', { type: 'date' }),
    ),
  );
}

// ---------------------------------------------------------------- albums
function albumsScreen(view: HTMLElement, id?: string) {
  const c = state.content!;
  if (id) return albumDetail(view, id);
  const list = c.albums.filter((a) => state.albumFilter === 'all' || a.categoryId === state.albumFilter);
  put(view,
    h('div', { class: 'toolbar' },
      h('p', { class: 'hint grow' }, 'Same order as on the site.'),
      h('button', {
        class: 'btn btn--primary', type: 'button', disabled: !c.photoCategories.length,
        onClick: () => {
          const album: Album = { id: uid('album'), slug: '', title: emptyL(), categoryId: state.albumFilter !== 'all' ? state.albumFilter : c.photoCategories[0]?.id ?? '', onHome: true, photos: [] };
          c.albums.push(album);
          markDirty();
          go(`albums/${album.id}`);
        },
      }, '+ New album'),
    ),
    !c.photoCategories.length && h('p', { class: 'notice' }, 'Create a photo category first (Photo categories).'),
    filterChips(c.photoCategories, state.albumFilter, c.albums, (cid) => ((state.albumFilter = cid), render())),
    list.length
      ? h('div', { class: 'rows' },
          list.map((a) => {
            const i = c.albums.indexOf(a);
            return h('div', { class: 'row' },
              thumb(a.photos[0]),
              h('div', {}, h('p', { class: 'row__title' }, a.title.en || 'Untitled album', !a.onHome && h('span', { class: 'badge' }, 'Not on homepage')), h('p', { class: 'row__meta' }, `${catName(c.photoCategories, a.categoryId)} · ${a.photos.length} photos`)),
              rowActions(c.albums, i, () => go(`albums/${a.id}`), `the album "${a.title.en || 'Untitled'}" and its photos`),
            );
          }),
        )
      : h('p', { class: 'empty' }, 'No albums in this category yet.'),
  );
}

function albumDetail(view: HTMLElement, id: string) {
  const c = state.content!;
  const album = c.albums.find((a) => a.id === id);
  if (!album) return go('albums');
  const title = localized('Title', album, 'title', { required: true });
  slugFollows(title, album, c.albums, 'album');
  const grid = h('div', { class: 'photos' });
  const uploads = h('div', { class: 'uploads' });

  const drawPhotos = () => {
    grid.replaceChildren(
      ...album.photos.map((p, i) => {
        const img = h('img', { src: p.path, alt: '', loading: 'lazy', style: { objectPosition: p.focus ?? '50% 50%' } });
        const frame = h('div', { class: 'photo__img', title: 'Click to set the focus point' }, img, h('span', { class: 'photo__n' }, i === 0 ? 'Cover' : i + 1));
        const dot = h('span', { class: 'media__dot' });
        const place = () => {
          const [x, y] = (p.focus ?? '50% 50%').split(' ');
          dot.style.left = x;
          dot.style.top = y;
          img.style.objectPosition = p.focus ?? '50% 50%';
        };
        frame.append(dot);
        place();
        frame.addEventListener('click', (e) => {
          const r = frame.getBoundingClientRect();
          p.focus = `${Math.round(((e.clientX - r.left) / r.width) * 100)}% ${Math.round(((e.clientY - r.top) / r.height) * 100)}%`;
          place();
          markDirty();
        });
        return h('div', { class: 'photo' },
          frame,
          h('div', { class: 'photo__tools' },
            h('button', { class: 'btn btn--sm btn--icon', type: 'button', 'aria-label': 'Move earlier', disabled: i === 0, onClick: () => (album.photos.splice(i - 1, 0, ...album.photos.splice(i, 1)), markDirty(), drawPhotos()) }, icon(ArrowLeft)),
            h('button', { class: 'btn btn--sm btn--icon', type: 'button', 'aria-label': 'Move later', disabled: i === album.photos.length - 1, onClick: () => (album.photos.splice(i + 1, 0, ...album.photos.splice(i, 1)), markDirty(), drawPhotos()) }, icon(ArrowRight)),
            h('button', { class: 'btn btn--sm btn--danger', type: 'button', onClick: () => remove(album.photos, i, 'this photo') && drawPhotos() }, 'Delete'),
          ),
          h('label', { class: 'field' }, h('span', {}, 'Photo title'), h('input', { type: 'text', value: p.alt.en, placeholder: 'e.g. Golden caftan', onInput: (e: Event) => ((p.alt.en = (e.target as HTMLInputElement).value), markDirty()) })),
          h('details', {}, h('summary', {}, 'Title in French / Arabic'),
            h('div', { class: 'langs langs--stack' },
              (['fr', 'ar'] as const).map((lang) => h('label', { class: 'lang' }, h('input', { type: 'text', value: p.alt[lang] ?? '', lang, dir: lang === 'ar' ? 'rtl' : 'ltr', placeholder: 'Same as English if empty', onInput: (e: Event) => ((p.alt[lang] = (e.target as HTMLInputElement).value), markDirty()) }), flag(lang))),
            ),
          ),
        );
      }),
    );
  };

  const addFiles = async (files: File[]) => {
    const images = files.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (images.length < files.length) toast('Skipped: only JPG, PNG and WebP.', 'error');
    for (const file of images) {
      const bar = h('i');
      const line = h('p', {}, file.name, h('span', { class: 'progress' }, bar));
      uploads.append(line);
      try {
        const done = await upload(file, 'image', (share) => (bar.style.width = `${share * 100}%`));
        album.photos.push({ id: uid('ph'), path: done.path, width: done.width, height: done.height, focus: '50% 50%', alt: emptyL() });
        markDirty();
        drawPhotos();
        line.remove();
      } catch (err) {
        line.replaceChildren(`${file.name}: ${(err as Error).message}`);
      }
    }
  };
  const picker = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true, onChange: () => (addFiles([...(picker.files ?? [])]), (picker.value = '')) });
  const drop = h('div', { class: 'drop' },
    h('div', {}, h('p', { style: { margin: '0 0 10px' } }, 'Drag photos here, as many as you like, or'), h('button', { class: 'btn btn--primary', type: 'button', onClick: () => picker.click() }, 'Choose photos'), picker),
  );
  drop.addEventListener('dragover', (e) => (e.preventDefault(), drop.classList.add('is-over')));
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
    addFiles([...(e.dataTransfer?.files ?? [])]);
  });

  put(view,
    h('ol', { class: 'steps' }, h('li', {}, 'Title'), h('li', {}, 'Category'), h('li', {}, 'Photos'), h('li', {}, 'Save and publish')),
    h('div', { class: 'detail-head' }, back('albums', 'All albums'), h('h2', {}, album.title.en || 'New album'),
      h('button', { class: 'btn btn--danger', type: 'button', onClick: () => remove(c.albums, c.albums.indexOf(album), `the album "${album.title.en || 'Untitled'}" and its photos`) && go('albums') }, 'Delete album')),
    h('div', { class: 'card' },
      title,
      select('Category', album, 'categoryId', c.photoCategories.map((x) => ({ value: x.id, label: x.title.en })), { required: true, help: 'Filter tab on the Photography page.' }),
      checkbox('Show in the homepage photo carousels', album, 'onHome'),
    ),
    h('div', { class: 'card' },
      h('p', { class: 'card__title' }, 'Photos'),
      h('p', { class: 'hint' }, 'The first photo is the cover. Click a photo to set its focus point.'),
      drop,
      uploads,
      grid,
    ),
  );
  drawPhotos();
}

// ---------------------------------------------------------------- categories
function categoriesScreen(view: HTMLElement, kind: 'film' | 'photo') {
  const c = state.content!;
  const list = kind === 'film' ? c.filmCategories : c.photoCategories;
  const items: { categoryId: string }[] = kind === 'film' ? c.films : c.albums;
  const what = kind === 'film' ? 'films' : 'albums';
  put(view,
    h('div', { class: 'toolbar' },
      h('p', { class: 'hint grow' }, 'Shown as filter tabs. Empty categories are hidden.'),
      h('button', { class: 'btn btn--primary', type: 'button', onClick: () => (list.push({ id: uid(kind === 'film' ? 'fc' : 'pc'), slug: '', title: emptyL() }), markDirty(), render(), reveal(lastRow)) }, '+ New category'),
    ),
    list.length
      ? h('div', { class: 'rows' },
          list.map((cat, i) => {
            const used = items.filter((x) => x.categoryId === cat.id).length;
            const name = localized('Name', cat, 'title', { required: true });
            slugFollows(name, cat, list, 'category');
            return h('div', { class: 'row row--plain' },
              h('div', { class: 'card', style: { padding: '0', border: '0' } }, name, h('small', { class: 'help' }, `${used} ${what}`)),
              h('div', { class: 'row__actions' },
                h('button', { class: 'btn btn--sm btn--icon', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onClick: () => move(list, i, -1) }, icon(ArrowUp)),
                h('button', { class: 'btn btn--sm btn--icon', type: 'button', 'aria-label': 'Move down', disabled: i === list.length - 1, onClick: () => move(list, i, 1) }, icon(ArrowDown)),
                h('button', {
                  class: 'btn btn--sm btn--danger', type: 'button',
                  onClick: () => (used ? toast(`Move its ${used} ${what} first.`, 'error') : remove(list, i, `the category "${cat.title.en || 'Untitled'}"`) && render()),
                }, 'Delete'),
              ),
            );
          }),
        )
      : h('p', { class: 'empty' }, 'No categories yet.'),
  );
}

// ---------------------------------------------------------------- homepage, settings
function homeScreen(view: HTMLElement) {
  const home = state.content!.home;
  const films = h('div', { class: 'rows' });
  const drawFilms = () =>
    films.replaceChildren(
      ...home.videos.map((film, i) =>
        h('div', { class: 'row row--plain' },
          h('div', { class: 'card', style: { padding: '0', border: '0' } },
            h('p', { class: 'label' }, `Film ${i + 1}`, i === 0 && h('span', { class: 'badge' }, 'plays first')),
            media('Video (landscape)', film, 'video', 'video', { required: true, help: 'Muted. 10–30 s, under 15 MB.' }),
            media('Mobile version (optional)', film, 'videoMobile', 'video', { help: '9:16 portrait.' }),
          ),
          h('div', { class: 'row__actions' },
            h('button', { class: 'btn btn--sm btn--icon', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onClick: () => (home.videos.splice(i - 1, 0, ...home.videos.splice(i, 1)), markDirty(), drawFilms()) }, icon(ArrowUp)),
            h('button', { class: 'btn btn--sm btn--icon', type: 'button', 'aria-label': 'Move down', disabled: i === home.videos.length - 1, onClick: () => (home.videos.splice(i + 1, 0, ...home.videos.splice(i, 1)), markDirty(), drawFilms()) }, icon(ArrowDown)),
            h('button', { class: 'btn btn--sm btn--danger', type: 'button', disabled: home.videos.length < 2, title: home.videos.length < 2 ? 'The hero needs at least one film' : undefined, onClick: () => remove(home.videos, i, `film ${i + 1}`) && render() }, 'Delete'),
          ),
        ),
      ),
    );
  drawFilms();
  put(view,
    h('p', { class: 'hint' }, 'Headline and buttons: Site texts. Hero logo: Brand & contact.'),
    h('div', { class: 'card' },
      h('div', { class: 'toolbar' },
        h('p', { class: 'card__title grow' }, 'Background films'),
        h('button', { class: 'btn btn--sm btn--primary', type: 'button', onClick: () => (home.videos.push({ id: uid('hero'), video: null, videoMobile: null }), markDirty(), render(), reveal(lastRow)) }, '+ Add film'),
      ),
      h('p', { class: 'hint' }, 'Played in order, in a loop.'),
      films,
    ),
    h('div', { class: 'card' },
      h('p', { class: 'card__title' }, 'Poster'),
      media('Desktop', home, 'poster', 'image', { required: true, help: 'First frame of film 1.' }),
      media('Mobile', home, 'posterMobile', 'image', { help: 'First frame of the mobile film 1.' }),
    ),
    h('div', { class: 'card' }, h('p', { class: 'card__title' }, 'About section'), media('Photo', home, 'aboutPhoto', 'image', { focus: true, help: 'Portrait format.' })),
  );
}

// The curved row of cards near the bottom of the homepage ("Stories that keep moving").
// With no cards, the site's curved row shows the photos of the albums marked for the homepage, one from each album in
// turn (same rule as src/pages/[...locale]/index.astro).
const autoCurve = () => {
  const albums = state.content!.albums.filter((a) => a.onHome && a.photos.length);
  return Array.from({ length: Math.max(0, ...albums.map((a) => a.photos.length)) }).flatMap((_, i) => albums.flatMap((a) => (a.photos[i] ? [a.photos[i]] : [])));
};
function carouselScreen(view: HTMLElement) {
  const items = state.content!.curve.items;
  // "Customize" turns the automatic photos into cards that can then be edited, reordered or swapped for videos.
  const auto = autoCurve();
  const addBlank = () => (items.push({ id: uid('card'), kind: 'image', image: null, video: null, href: '' }), markDirty(), render(), reveal(lastRow));
  if (!items.length) {
    const customize = () => {
      items.push(...auto.map((p): CurveCard => ({ id: uid('card'), kind: 'image', image: { path: p.path, width: p.width, height: p.height, ...(p.focus ? { focus: p.focus } : {}) }, video: null, href: '' })));
      markDirty();
      render();
    };
    put(view,
      h('div', { class: 'toolbar' },
        h('p', { class: 'hint grow' }, auto.length ? `Auto: ${auto.length} photos from home page albums.` : 'No cards yet.'),
        auto.length ? h('button', { class: 'btn btn--primary', type: 'button', onClick: customize }, 'Customize') : h('button', { class: 'btn btn--primary', type: 'button', onClick: addBlank }, '+ Add card'),
      ),
      auto.length > 0 && h('div', { class: 'curve-preview' }, auto.map((p) => h('img', { src: p.path, alt: p.alt?.en ?? '', loading: 'lazy', style: { objectPosition: p.focus ?? '50% 50%' } }))),
    );
    return;
  }
  const resetToAuto = () => {
    if (!confirm(`Remove all ${items.length} cards and show the album photos again?`)) return;
    items.length = 0;
    markDirty();
    render();
  };
  put(view,
    h('div', { class: 'toolbar' },
      h('p', { class: 'hint grow' }, 'Same order as on the site.'),
      auto.length > 0 && h('button', { class: 'btn btn--ghost', type: 'button', onClick: resetToAuto }, 'Reset to auto'),
      h('button', { class: 'btn btn--primary', type: 'button', onClick: addBlank }, '+ Add card'),
    ),
    h('div', { class: 'rows' },
      items.map((item, i) =>
        h('div', { class: 'row row--plain' },
          h('div', { class: 'card', style: { padding: '0', border: '0' } },
            h('div', { class: 'toolbar' },
              h('p', { class: 'label grow' }, `Card ${i + 1}`),
              h('div', { class: 'chips', role: 'group', 'aria-label': 'Card type' },
                (['image', 'video'] as const).map((kind) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(item.kind === kind), onClick: () => ((item.kind = kind), markDirty(), render()) }, kind === 'image' ? 'Photo' : 'Video')),
              ),
            ),
            item.kind === 'video'
              ? media('Video (MP4)', item, 'video', 'video', { required: true, help: 'Muted loop. 5–15 s, a few MB.' })
              : media('Photo', item, 'image', 'image', { required: true, focus: true, help: 'Portrait format.' }),
            text('Link (optional)', item, 'href', { placeholder: 'https://… or /films/', help: 'A page (/films/) or a full URL.' }),
          ),
          rowActions(items, i, undefined, `card ${i + 1}`),
        ),
      ),
    ),
  );
}

function settingsScreen(view: HTMLElement) {
  const s = state.content!.settings;
  const socials = h('div', { class: 'rows' });
  const drawSocials = () =>
    socials.replaceChildren(
      ...s.socials.map((social, i) =>
        h('div', { class: 'row row--plain' },
          h('div', { class: 'grid2' },
            text('Name', social, 'label', { placeholder: 'Instagram' }),
            text('Handle', social, 'handle', { placeholder: '@med_noukhal' }),
            text('Link', social, 'href', { type: 'url', placeholder: 'https://' }),
            select('Icon', social, 'icon', ['instagram', 'youtube', 'threads'].map((v) => ({ value: v, label: v }))),
          ),
          h('div', { class: 'row__actions' },
            h('button', { class: 'btn btn--sm btn--icon', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onClick: () => (s.socials.splice(i - 1, 0, ...s.socials.splice(i, 1)), markDirty(), drawSocials()) }, icon(ArrowUp)),
            h('button', { class: 'btn btn--sm btn--danger', type: 'button', onClick: () => remove(s.socials, i, 'this link') && drawSocials() }, 'Delete'),
          ),
        ),
      ),
    );
  drawSocials();
  put(view,
    h('div', { class: 'card' },
      h('p', { class: 'card__title' }, 'Logo'),
      media('Full logo (footer)', s, 'logo', 'image', { required: true, accept: 'image/png,image/webp', help: 'White PNG, ~1000 px wide.' }),
      media('Logo mark (header, menu)', s, 'logoMark', 'image', { required: true, accept: 'image/png,image/webp', help: 'White PNG, ~300 px square.' }),
      media('Hero logo (home page)', s, 'logoWordmark', 'image', { accept: 'image/png,image/webp', help: 'White PNG, ~1500 px wide. Empty: built-in.' }),
      h('div', { class: 'grid2' }, text('Name', s, 'name', { required: true }), text('Logo text (read by screen readers)', s, 'logoAlt')),
      text('Job title (for Google)', s, 'jobTitle'),
    ),
    h('div', { class: 'card' },
      h('p', { class: 'card__title' }, 'Contact'),
      h('p', { class: 'hint' }, 'Empty fields are hidden.'),
      h('div', { class: 'grid2' },
        text('Email', s, 'email', { type: 'email' }),
        text('Phone (as shown)', s, 'phone', { placeholder: '+212 600 000 000' }),
        text('WhatsApp number', s, 'whatsapp', { help: 'Digits only, e.g. 212600000000', transform: (v) => v.replace(/\D/g, '') }),
      ),
    ),
    h('div', { class: 'card' },
      h('div', { class: 'toolbar' }, h('p', { class: 'card__title grow' }, 'Social links'), h('button', { class: 'btn btn--sm', type: 'button', onClick: () => (s.socials.push({ id: uid('social'), label: '', handle: '', href: '', icon: 'instagram' }), markDirty(), drawSocials(), reveal(() => socials.lastElementChild)) }, '+ Add link')),
      socials,
    ),
  );
}

// ---------------------------------------------------------------- texts
// Each group of words, named by the page and the place where it shows, in the order of the site.
const SECTIONS: Record<string, string> = {
  hero: 'Home page · Top: big title, line and the two buttons',
  about: 'Home page · About me',
  services: 'Home page · What I do (services)',
  showcase: 'Home page · Films & photos carousels (titles)',
  clients: 'Home page · Clients (title)',
  reviews: 'Home page & Reviews page · Reviews (titles)',
  curve: 'Home page · Carousel (title and button)',
  films: 'Films page · Title and intro',
  film: 'Films · Video player buttons',
  photo: 'Photography page · Title, intro and photo viewer',
  contact: 'Contact page · Title and intro',
  form: 'Contact page · The form',
  nav: 'Every page · Menu at the top',
  footer: 'Every page · Bottom of the page (footer)',
  notFound: '"Page not found" page',
  meta: 'Google · Page titles and descriptions in search results',
  skip: 'Accessibility · "Skip to content" link',
};
const ORDER = Object.keys(SECTIONS);
const HINTS: Record<string, string> = { 'hero.sr': 'The homepage heading (H1). Google reads it first.', 'films.count': 'Keep {n}: it becomes the number of films.', 'reviews.rating': 'Keep {n}: it becomes the star rating.' };
// Friendlier names for the fields whose code names say little.
const NAMES: Record<string, string> = { 'hero.sr': 'Heading (H1)', 'hero.role': 'Line under the heading', 'hero.project': 'Main button', 'hero.watch': 'Second button', 'hero.scroll': 'Scroll hint', 'about.p1': 'Paragraph' };
const label = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase());
const at = (obj: any, path: string[]) => path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
// Removes empty branches, so the saved texts hold only what differs from the built-in ones.
const prune = (obj: Record<string, any>) => {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      prune(v);
      if (!Object.keys(v).length) delete obj[k];
    }
  }
};

function textsScreen(view: HTMLElement) {
  const texts = state.content!.texts;
  const langs = ['en', 'fr', 'ar'] as const;
  const differs = (path: string[]) => at(texts, path) !== undefined;

  const leaf = (path: string[], long: boolean) => {
    const id = path.join('.');
    const defaults = { en: at(DEFAULTS.en, path), fr: at(DEFAULTS.fr, path), ar: at(DEFAULTS.ar, path) } as L;
    const wrap = h('div', { class: `field${differs(path) ? ' changed' : ''}` });
    const name = NAMES[id] ?? label(path.at(-1)!);
    const inputs = langs.map((lang) => {
      const current = at(texts, [...path, lang]) ?? defaults[lang] ?? '';
      const attrs = {
        value: current,
        dir: lang === 'ar' ? 'rtl' : 'ltr',
        lang,
        'aria-label': `${name} (${lang.toUpperCase()})`,
        onInput: (e: Event) => {
          const value = (e.target as HTMLInputElement).value;
          // Store only a change from the built-in text; going back to it removes the override.
          let node = texts;
          for (const k of path) node = node[k] ??= {};
          if (value === (defaults[lang] ?? '')) delete node[lang];
          else node[lang] = value;
          prune(texts);
          wrap.classList.toggle('changed', differs(path));
          markDirty();
        },
      };
      return h('label', { class: 'lang' }, long ? h('textarea', { ...attrs, rows: 3 }) : h('input', { ...attrs, type: 'text' }), flag(lang));
    });
    put(wrap, h('span', {}, name), h('div', { class: `langs${long ? ' langs--stack' : ''}` }, inputs), HINTS[id] && h('small', {}, HINTS[id]));
    return wrap;
  };

  // Lists (such as the services) are saved whole once edited: items can then be added, removed and reordered.
  const list = (path: string[]) => {
    const box = h('div', { class: 'sub' });
    const draw = () => {
      const custom = at(texts, path) as any[] | undefined;
      const shape = at(DEFAULTS.en, path)[0] as Record<string, string>;
      const items: any[] = custom ?? (at(DEFAULTS.en, path) as any[]).map((_, i) => Object.fromEntries(Object.keys(shape).map((k) => [k, Object.fromEntries(langs.map((l) => [l, at(DEFAULTS[l], [...path, String(i), k]) ?? '']))])));
      const own = () => {
        if (!custom) {
          let node = texts;
          for (const k of path.slice(0, -1)) node = node[k] ??= {};
          node[path.at(-1)!] = items;
        }
      };
      box.replaceChildren(
        h('div', { class: 'toolbar' },
          h('p', { class: 'label grow' }, label(path.at(-1)!), custom && h('span', { class: 'badge' }, 'changed')),
          custom && h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onClick: () => { const parent = at(texts, path.slice(0, -1)); delete parent[path.at(-1)!]; prune(texts); markDirty(); draw(); } }, 'Reset to built-in'),
          h('button', { class: 'btn btn--sm', type: 'button', onClick: () => (own(), items.push(Object.fromEntries(Object.keys(shape).map((k) => [k, emptyL()]))), markDirty(), draw(), reveal(() => box.lastElementChild)) }, '+ Add item'),
        ),
        ...items.map((item, i) =>
          h('div', { class: 'sub' },
            Object.keys(shape).map((k) => {
              const field = localized(label(k), item, k, { multiline: String(shape[k]).length > 90 });
              field.addEventListener('input', own, true);
              return field;
            }),
            h('div', { class: 'toolbar' },
              h('button', { class: 'btn btn--sm btn--icon', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onClick: () => (own(), items.splice(i - 1, 0, ...items.splice(i, 1)), markDirty(), draw()) }, icon(ArrowUp)),
              h('button', { class: 'btn btn--sm btn--danger', type: 'button', disabled: items.length < 2, onClick: () => (own(), items.splice(i, 1), markDirty(), draw()) }, 'Remove'),
            ),
          ),
        ),
      );
    };
    draw();
    return box;
  };

  const node = (path: string[], value: unknown): HTMLElement => {
    if (typeof value === 'string') return leaf(path, value.length > 90);
    if (Array.isArray(value)) return list(path);
    return h('div', { class: 'sub' }, h('p', { class: 'label' }, label(path.at(-1)!)), Object.entries(value as object).map(([k, v]) => node([...path, k], v)));
  };

  const groups: { section: HTMLDetailsElement; fill: () => void }[] = [];
  // Find a sentence anywhere: opens every group and keeps only the fields that contain the words typed.
  const search = h('input', {
    type: 'search',
    class: 'input',
    placeholder: 'Search texts…',
    'aria-label': 'Find a text',
    onInput: () => {
      const q = search.value.trim().toLowerCase();
      groups.forEach(({ section, fill }) => {
        if (q.length < 2) {
          section.hidden = false;
          section.querySelectorAll<HTMLElement>('.field, .sub').forEach((el) => (el.hidden = false));
          return;
        }
        fill();
        section.open = true;
        let hits = 0;
        section.querySelectorAll<HTMLElement>('.body .field').forEach((field) => {
          const text = [field.querySelector('span')?.textContent ?? '', ...[...field.querySelectorAll<HTMLInputElement>('input, textarea')].map((i) => i.value)].join(' ').toLowerCase();
          field.hidden = !text.includes(q);
          if (!field.hidden) hits++;
        });
        section.hidden = hits === 0 && !(section.querySelector('summary')?.textContent ?? '').toLowerCase().includes(q);
      });
    },
  });
  const entries = Object.entries(DEFAULTS.en).sort(([a], [b]) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  put(view,
    h('p', { class: 'hint' }, 'Grouped by page. Empty French or Arabic keeps the current translation.'),
    search,
    h('div', { class: 'texts' },
      entries.map(([key, value]) => {
        const body = h('div', { class: 'body' });
        const section = h('details', { open: key === 'hero' ? true : undefined }, h('summary', {}, SECTIONS[key] ?? label(key), texts[key] !== undefined && h('small', {}, 'changed')), body);
        // Fields are built when a section is first opened, so the page stays light.
        const fill = () => {
          if (body.childElementCount) return;
          if (typeof value === 'string') body.append(leaf([key], value.length > 90));
          else Object.entries(value).forEach(([k, v]) => body.append(node([key, k], v)));
        };
        section.addEventListener('toggle', fill);
        if (section.open) fill();
        groups.push({ section: section as HTMLDetailsElement, fill });
        return section;
      }),
    ),
  );
}

// ---------------------------------------------------------------- clients, reviews
function clientsScreen(view: HTMLElement, id?: string) {
  const c = state.content!;
  if (id) {
    const client = c.clients.find((x) => x.id === id);
    if (!client) return go('clients');
    put(view,
      h('div', { class: 'detail-head' }, back('clients', 'All clients'), h('h2', {}, client.name || 'New client')),
      h('div', { class: 'card' },
        text('Name', client, 'name', { required: true }),
        media('Logo', client, 'logo', 'image', { required: true, accept: 'image/png,image/webp,image/jpeg', help: 'PNG, ~400 px wide.' }),
        checkbox('Keep the logo colours (greyscale)', client, 'tone', { help: 'For multi-colour logos.' }),
      ),
    );
    return;
  }
  put(view,
    h('div', { class: 'toolbar' }, h('p', { class: 'hint grow' }, 'Same order as on the site.'),
      h('button', { class: 'btn btn--primary', type: 'button', onClick: () => { const x: Client = { id: uid('client'), name: '', tone: false, logo: null }; c.clients.push(x); markDirty(); go(`clients/${x.id}`); } }, '+ New client')),
    h('div', { class: 'rows' },
      c.clients.map((x, i) => h('div', { class: 'row' }, thumb(x.logo), h('div', {}, h('p', { class: 'row__title' }, x.name || 'Unnamed client'), h('p', { class: 'row__meta' }, `${c.reviews.filter((r) => r.clientId === x.id).length} reviews`)),
        rowActions(c.clients, i, () => go(`clients/${x.id}`), `the client "${x.name}" (its reviews are deleted too)`))),
    ),
  );
  // Reviews of a deleted client go with it.
  const ids = new Set(c.clients.map((x) => x.id));
  c.reviews = c.reviews.filter((r) => ids.has(r.clientId) || (r.name && r.logo) || !r.clientId);
}

function reviewsScreen(view: HTMLElement, id?: string) {
  const c = state.content!;
  if (id) {
    const review = c.reviews.find((x) => x.id === id);
    if (!review) return go('reviews');
    put(view,
      h('div', { class: 'detail-head' }, back('reviews', 'All reviews'), h('h2', {}, 'Review')),
      h('div', { class: 'card' },
        select('Client', review, 'clientId', [...c.clients.map((x) => ({ value: x.id, label: x.name })), { value: '', label: 'Other…' }], { help: 'Uses the client’s name and logo.', onPick: () => render() }),
        !c.clients.some((x) => x.id === review.clientId) && text('Name', review, 'name', { required: true, placeholder: 'Company or person' }),
        media(c.clients.some((x) => x.id === review.clientId) ? 'Logo (optional override)' : 'Logo', review, 'logo', 'image', { required: !c.clients.some((x) => x.id === review.clientId), accept: 'image/png,image/webp,image/jpeg', help: 'Square PNG.' }),
        localized('Sector', review, 'sector', { help: 'e.g. Hotel · Marrakech' }),
        textarea('Quote', review, 'quote', { required: true, help: 'The client’s own words.' }),
        select('Rating', review, 'rating', [5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} star${n > 1 ? 's' : ''}` }))),
        checkbox('Draft', review, 'placeholder', { help: 'Shown on the site. Replace before launch.' }),
      ),
    );
    return;
  }
  put(view,
    h('div', { class: 'toolbar' }, h('p', { class: 'hint grow' }, 'Same order as on the site.'),
      h('button', { class: 'btn btn--primary', type: 'button', onClick: newReview }, '+ New review')),
    h('div', { class: 'rows' },
      c.reviews.map((r, i) => h('div', { class: 'row' }, thumb(r.logo ?? c.clients.find((x) => x.id === r.clientId)?.logo),
        h('div', {}, h('p', { class: 'row__title' }, c.clients.find((x) => x.id === r.clientId)?.name ?? (r.name || 'No client'), r.placeholder && h('span', { class: 'badge' }, 'Draft'), h('span', { class: 'stars', title: `${r.rating} out of 5` }, Array.from({ length: r.rating }, () => icon(Star)))), h('p', { class: 'row__meta' }, r.quote.slice(0, 140) || '…')),
        rowActions(c.reviews, i, () => go(`reviews/${r.id}`), 'this review'))),
    ),
  );
}


// ---------------------------------------------------------------- account
function accountScreen(view: HTMLElement) {
  const form = { email: state.user ?? '', current: '', next: '', confirm: '' };
  const message = h('p', { class: 'notice', hidden: true, role: 'status' });
  put(view,
    h('form', {
      class: 'card',
      onSubmit: async (e: Event) => {
        e.preventDefault();
        message.hidden = false;
        message.className = 'notice notice--error';
        if (form.next.length < 8) return void (message.textContent = 'The new password needs at least 8 characters.');
        if (form.next !== form.confirm) return void (message.textContent = 'The two new passwords are different.');
        const res = await call('password', { email: form.email, current: form.current, next: form.next });
        if (!res.ok) return void (message.textContent = res.code === 'wrong_password' ? 'The current password is wrong.' : `Could not change it (${res.code}).`);
        state.user = res.user;
        message.className = 'notice';
        message.textContent = 'Saved. Use the new password next time you sign in.';
        (e.target as HTMLFormElement).reset();
      },
    },
      h('p', { class: 'card__title' }, 'Sign-in'),
      h('label', { class: 'field' }, h('span', {}, 'Email'), h('input', { type: 'email', value: form.email, autocomplete: 'username', required: true, onInput: (e: Event) => (form.email = (e.target as HTMLInputElement).value) })),
      h('label', { class: 'field' }, h('span', {}, 'Current password'), h('input', { type: 'password', autocomplete: 'current-password', required: true, onInput: (e: Event) => (form.current = (e.target as HTMLInputElement).value) })),
      h('div', { class: 'grid2' },
        h('label', { class: 'field' }, h('span', {}, 'New password'), h('input', { type: 'password', autocomplete: 'new-password', minlength: 8, required: true, onInput: (e: Event) => (form.next = (e.target as HTMLInputElement).value) }), h('small', {}, 'At least 8 characters; 12 or more is safer.')),
        h('label', { class: 'field' }, h('span', {}, 'New password again'), h('input', { type: 'password', autocomplete: 'new-password', required: true, onInput: (e: Event) => (form.confirm = (e.target as HTMLInputElement).value) })),
      ),
      message,
      h('button', { class: 'btn btn--primary', type: 'submit' }, 'Change password'),
    ),
    h('div', { class: 'card' },
      h('p', { class: 'card__title' }, 'Session'),
      h('p', { class: 'hint' }, 'Auto sign-out after 8 hours idle.'),
      h('button', {
        class: 'btn', type: 'button',
        onClick: async () => {
          if (state.dirty && !confirm('You have unsaved changes. Sign out anyway?')) return;
          await call('logout', {});
          state.user = null;
          state.content = null;
          state.dirty = false;
          renderLogin();
        },
      }, 'Sign out'),
    ),
  );
}

// ---------------------------------------------------------------- start
async function boot() {
  // After a sign-in in the middle of editing, the unsaved edits in this page are kept.
  if (!state.content) {
    const res = await call('content');
    if (!res.ok) return renderLogin(res.status === 401 ? '' : `Could not load the content (${res.code}).`);
    const content = res.content as Content;
    content.texts = content.texts && !Array.isArray(content.texts) ? content.texts : {};
    // Content saved before these features existed: one hero video becomes a list of one; reviews get name/logo.
    content.home.videos ??= content.home.video ? [{ id: uid('hero'), video: content.home.video, videoMobile: content.home.videoMobile ?? null }] : [];
    delete content.home.video;
    delete content.home.videoMobile;
    content.curve ??= { items: [] };
    content.settings.logoWordmark ??= null;
    content.reviews.forEach((r) => ((r.name ??= ''), (r.logo ??= null)));
    state.content = content;
  }
  render();
  refreshStatus();
}

(async () => {
  const res = await call('session');
  if (!res.ok) {
    renderLogin(res.code === 'no_api' ? 'The dashboard API was not found. Open the dashboard on the server (or with npm run admin:local), not with the Astro dev server.' : '');
    return;
  }
  state.user = res.user;
  if (state.user) await boot();
  else renderLogin(res.configured === false ? 'No login is set up on the server yet: fill in admin_email and admin_password_hash in api/config.php.' : '');
})();
