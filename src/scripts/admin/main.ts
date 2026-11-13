// The dashboard app: sign-in, then one screen per kind of content (#films, #albums/…, #texts…).
// Edits stay in the browser until "Save", which stores them on the server. "Publish" then rebuilds the website with them.
import { call, upload } from './api';
import { checkbox, emptyL, h, localized, media, onChange, put, select, slugify, text, textarea, toast, uid, type Img, type L, type Vid } from './ui';

type Cat = { id: string; slug: string; title: L };
type Film = { id: string; slug: string; title: L; description: L; categoryId: string; featured: boolean; onHome: boolean; date: string; video: Vid | null; poster: Img | null };
type Photo = Img & { id: string; alt: L };
type Album = { id: string; slug: string; title: L; categoryId: string; onHome: boolean; photos: Photo[] };
type Client = { id: string; name: string; tone: boolean; logo: Img | null };
type Review = { id: string; clientId: string; name: string; logo: Img | null; sector: L; quote: string; rating: number; placeholder: boolean };
type HeroFilm = { id: string; video: Vid | null; videoMobile: Vid | null };
type CurveCard = { id: string; kind: 'image' | 'video'; image: Img | null; video: Vid | null; href: string };
type Advice = { id: string; title: string; video: Vid | null; poster: Img | null };
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
  advice: Advice[];
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
type NavItem = { group?: string; hash: string; label: string; where: string; link?: string; count?: () => number };
const NAV: NavItem[] = [
  { hash: 'start', label: 'Start here', where: 'Shortcuts to the changes you make most often.' },
  { group: 'Home page', hash: 'home', label: 'Top video & big name', where: 'Home page, at the very top: the film playing behind the big name, and the photo of the About section.', link: '/', count: () => state.content!.home.videos.length },
  { hash: 'carousel', label: 'Moving photo row', where: 'Home page, near the bottom: the curved row of photos that moves on its own ("Stories that keep moving").', link: '/#curve-title', count: () => state.content!.curve.items.length },
  { hash: 'clients', label: 'Client logos', where: 'Home page: the band of client logos ("They trusted me"). Reviews use these logos too.', link: '/#clients', count: () => state.content!.clients.length },
  { hash: 'reviews', label: 'Client reviews', where: 'Home page and the Reviews page: the cards with the stars and what clients said.', link: '/reviews/', count: () => state.content!.reviews.length },
  { group: 'Films page', hash: 'films', label: 'My films', where: 'The Films page, and the films carousel on the home page.', link: '/films/', count: () => state.content!.films.length },
  { hash: 'film-categories', label: 'Film categories', where: 'The Films page: the tabs above the films (Commercials, Music videos…).', link: '/films/', count: () => state.content!.filmCategories.length },
  { group: 'Photos page', hash: 'albums', label: 'My photo albums', where: 'The Photography page (Albums), and the photo carousel on the home page.', link: '/photography/', count: () => state.content!.albums.length },
  { hash: 'photo-categories', label: 'Photo categories', where: 'The Photography page: the tabs above the albums (Portraits, Food…).', link: '/photography/', count: () => state.content!.photoCategories.length },
  { group: 'Other', hash: 'advice', label: 'Advice videos', where: 'The Advice page.', link: '/advice/', count: () => state.content!.advice.length },
  { hash: 'texts', label: 'Words on the site', where: 'Every sentence, title and button of every page, in English, French and Arabic.', link: '/' },
  { hash: 'settings', label: 'Logo, phone & social', where: 'The logo at the top and bottom of every page, and your email, phone, WhatsApp and social links (footer and Contact page).', link: '/contact/' },
  { hash: 'account', label: 'My password', where: 'The email and password you use to sign in here. Not shown on the site.' },
];

const route = () => {
  const [section, id] = location.hash.replace(/^#/, '').split('/');
  return { section: section || 'start', id };
};
const go = (hash: string) => {
  if (location.hash === `#${hash}`) render();
  else location.hash = hash;
};
window.addEventListener('hashchange', () => render());

let barEl: HTMLElement | null = null;
const drawBar = () => {
  if (!barEl || !state.content) return;
  const s = state.status;
  const unpublished = s ? s.revision !== s.publishedRevision : false;
  const run = s?.run;
  const building = run && run.status !== 'completed';
  const stateText = state.saving ? 'Saving…' : state.dirty ? 'Not saved yet: press Save changes' : building ? 'Going online… the site updates in a few minutes' : unpublished ? 'Saved. Press Put online to show it on the site' : 'Everything is online';
  const tone = state.saving || building ? 'busy' : state.dirty || unpublished ? 'dirty' : 'ok';
  const failed = run && run.status === 'completed' && run.conclusion && run.conclusion !== 'success';
  barEl.replaceChildren();
  put(barEl,
    h('h1', { class: 'bar__title' }, NAV.find((n) => n.hash === route().section)?.label ?? 'Dashboard'),
    h('span', { class: 'bar__state', 'data-tone': failed ? 'error' : tone }, failed ? 'The last update of the site failed' : stateText),
    failed && h('a', { class: 'btn btn--sm btn--ghost', href: run!.url, target: '_blank', rel: 'noopener' }, 'Details'),
    h('button', { class: 'btn', type: 'button', disabled: !state.dirty || state.saving, onClick: save }, 'Save changes'),
    h('button', { class: 'btn btn--primary', type: 'button', disabled: state.dirty || state.saving || !!building || !s?.canPublish, title: s && !s.canPublish ? 'Publishing is not set up on the server yet (github_token in api/config.php).' : undefined, onClick: publish }, 'Put online'),
    h('a', { class: 'btn btn--ghost', href: '/', target: '_blank', rel: 'noopener' }, 'Open my site ↗'),
  );
};

function render() {
  if (!state.user) return renderLogin();
  if (!state.content) return;
  const { section, id } = route();
  barEl = h('header', { class: 'bar' });
  const view = h('section', { class: 'view' });
  const side = h('nav', { class: 'side', 'aria-label': 'Dashboard' },
    h('p', { class: 'side__brand' }, 'MN ', h('span', {}, 'Visual')),
    NAV.map((n) => [n.group && h('p', { class: 'side__group' }, n.group), h('a', { href: `#${n.hash}`, 'aria-current': section === n.hash ? 'page' : undefined }, n.label, n.count && h('small', {}, n.count()))]),
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
    start: startScreen,
    home: homeScreen,
    carousel: carouselScreen,
    texts: textsScreen,
    settings: settingsScreen,
    clients: clientsScreen,
    reviews: reviewsScreen,
    advice: adviceScreen,
    account: accountScreen,
  };
  const here = NAV.find((n) => n.hash === section) ?? NAV[0];
  if (section !== 'start')
    put(view, h('div', { class: 'where' }, h('span', { class: 'where__pin', 'aria-hidden': 'true' }, '📍'), h('p', {}, h('strong', {}, 'Where this shows: '), here.where), here.link && h('a', { class: 'btn btn--sm', href: here.link, target: '_blank', rel: 'noopener' }, 'See it on the site ↗')));
  (screens[section] ?? startScreen)(view, id);
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
        h('p', { class: 'login__brand' }, 'MN ', h('span', {}, 'Visual')),
        h('p', { class: 'login__sub' }, 'Dashboard. Sign in to manage the site.'),
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
  const slugs = (list: { slug: string }[], what: string, hash: (i: number) => string) => {
    const seen = new Set<string>();
    list.forEach((item, i) => {
      need(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.slug), `${what} ${i + 1}: the URL name may only use a–z, 0–9 and dashes.`, hash(i));
      need(!seen.has(item.slug), `${what} "${item.slug}": another one already uses this URL name.`, hash(i));
      seen.add(item.slug);
    });
  };
  const filmCats = new Set(c.filmCategories.map((x) => x.id));
  const photoCats = new Set(c.photoCategories.map((x) => x.id));
  c.filmCategories.forEach((x, i) => need(x.title.en.trim(), `Film category ${i + 1} needs an English name.`, 'film-categories'));
  c.photoCategories.forEach((x, i) => need(x.title.en.trim(), `Photo category ${i + 1} needs an English name.`, 'photo-categories'));
  slugs(c.filmCategories, 'Film category', () => 'film-categories');
  slugs(c.photoCategories, 'Photo category', () => 'photo-categories');
  c.films.forEach((f) => {
    const at = `films/${f.id}`;
    const name = f.title.en || 'A film';
    need(f.title.en.trim(), 'A film has no English title.', at);
    need(filmCats.has(f.categoryId), `${name}: choose a category.`, at);
    need(f.video, `${name}: upload the video.`, at);
    need(f.poster, `${name}: upload a poster image.`, at);
  });
  slugs(c.films, 'Film', (i) => `films/${c.films[i].id}`);
  c.albums.forEach((a) => {
    const at = `albums/${a.id}`;
    const name = a.title.en || 'An album';
    need(a.title.en.trim(), 'An album has no English title.', at);
    need(photoCats.has(a.categoryId), `${name}: choose a category.`, at);
    need(a.photos.length, `${name}: add at least one photo.`, at);
  });
  slugs(c.albums, 'Album', (i) => `albums/${c.albums[i].id}`);
  need(c.home.videos.length && c.home.poster, 'Homepage hero: add at least one film and the still image.', 'home');
  c.home.videos.forEach((v, i) => need(v.video, `Homepage hero: film ${i + 1} has no video yet (upload it or delete the row).`, 'home'));
  c.curve.items.forEach((item, i) => {
    need(item.kind === 'video' ? item.video : item.image, `Closing carousel: card ${i + 1} needs its ${item.kind === 'video' ? 'video' : 'photo'}.`, 'carousel');
    need(!item.href.trim() || /^(https?:\/\/|\/)/.test(item.href.trim()), `Closing carousel: the link of card ${i + 1} must start with https:// or /.`, 'carousel');
  });
  need(c.settings.name.trim() && c.settings.logo && c.settings.logoMark, 'Logo & contact: the name, logo and mark are required.', 'settings');
  c.clients.forEach((x) => need(x.name.trim() && x.logo, `Client "${x.name || '?'}": name and logo are required.`, `clients/${x.id}`));
  const clientIds = new Set(c.clients.map((x) => x.id));
  c.reviews.forEach((r) => {
    need(r.quote.trim(), 'A review needs a quote.', `reviews/${r.id}`);
    need(clientIds.has(r.clientId) || (r.name.trim() && r.logo), `Review "${r.quote.slice(0, 30)}…": choose a client, or type a name and upload a logo.`, `reviews/${r.id}`);
  });
  c.advice.forEach((a) => need(a.title.trim() && a.video && a.poster, `Advice video "${a.title || '?'}": title, video and thumbnail are required.`, `advice/${a.id}`));
  return errors;
};

async function save() {
  const content = state.content!;
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
    toast('Saved. When you are ready, press Put online.');
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
  if (!confirm('Put your saved changes on the website? They show in about 3–5 minutes.')) return;
  const res = await call('publish', {});
  if (!res.ok) {
    toast(res.code === 'publish_not_configured' ? 'Publishing is not set up on the server yet (github_token in api/config.php).' : `Publishing failed (${res.code}${res.status ? ` ${res.status}` : ''}).`, 'error');
    return;
  }
  toast('Done. The website updates in about 3–5 minutes.');
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
  if (!confirm(`Delete ${what}? This takes effect when you press Save.`)) return false;
  list.splice(i, 1);
  markDirty();
  return true;
};
const rowActions = (list: unknown[], i: number, onEdit?: () => void, what = 'this item') =>
  h('div', { class: 'row__actions' },
    h('button', { class: 'btn btn--sm icon', type: 'button', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onClick: () => move(list, i, -1) }, '↑'),
    h('button', { class: 'btn btn--sm icon', type: 'button', title: 'Move down', 'aria-label': 'Move down', disabled: i === list.length - 1, onClick: () => move(list, i, 1) }, '↓'),
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
// The URL name follows the English title until it is edited by hand (kept outside the content, so it is never saved).
const autoSlugs = new WeakMap<object, string>();
const autoSlug = (item: { slug: string; title: L }, input: () => HTMLInputElement | null) => () => {
  if (!item.slug || item.slug === autoSlugs.get(item)) {
    item.slug = slugify(item.title.en);
    autoSlugs.set(item, item.slug);
    const el = input();
    if (el) el.value = item.slug;
  }
};

// ---------------------------------------------------------------- start
// Big shortcuts for the usual jobs, and the three steps to put a change online.
function startScreen(view: HTMLElement) {
  const c = state.content!;
  const newFilm = () => {
    const film: Film = { id: uid('film'), slug: '', title: emptyL(), description: emptyL(), categoryId: c.filmCategories[0]?.id ?? '', featured: false, onHome: true, date: new Date().toISOString().slice(0, 10), video: null, poster: null };
    c.films.push(film);
    markDirty();
    go(`films/${film.id}`);
  };
  const newAlbum = () => {
    const album: Album = { id: uid('album'), slug: '', title: emptyL(), categoryId: c.photoCategories[0]?.id ?? '', onHome: true, photos: [] };
    c.albums.push(album);
    markDirty();
    go(`albums/${album.id}`);
  };
  const tile = (icon: string, title: string, text: string, onClick: () => void) =>
    h('button', { class: 'tile', type: 'button', onClick }, h('span', { class: 'tile__icon', 'aria-hidden': 'true' }, icon), h('strong', {}, title), h('span', {}, text));
  put(view,
    h('div', { class: 'card' },
      h('p', { class: 'card__title' }, 'Hello! What do you want to change?'),
      h('p', { class: 'hint' }, 'Choose below, or use the menu on the left: it follows the pages of your site.'),
    ),
    h('div', { class: 'tiles' },
      tile('🎬', 'Add a new film', 'A video with its title and poster, on the Films page.', newFilm),
      tile('🖼️', 'Add a new photo album', 'A title and many photos, inside one category.', newAlbum),
      tile('🎥', 'Change the top video', 'The film playing at the top of the home page.', () => go('home')),
      tile('✏️', 'Change a sentence or a title', 'Any words on any page, in the 3 languages.', () => go('texts')),
      tile('⭐', 'Add a client review', 'Stars, the client’s words and their logo.', () => go('reviews')),
      tile('📞', 'Change phone, email or social links', 'Contact details and the logo.', () => go('settings')),
    ),
    h('div', { class: 'card' },
      h('p', { class: 'card__title' }, 'How to put a change on the site'),
      h('ol', { class: 'steps steps--big' },
        h('li', {}, h('strong', {}, 'Make your change'), ' in any screen.'),
        h('li', {}, h('strong', {}, 'Press “Save changes”'), ' (top right). Nothing is lost if you close the page after that.'),
        h('li', {}, h('strong', {}, 'Press “Put online”'), ' when you are ready. The website updates in about 3–5 minutes.'),
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
      h('p', { class: 'hint grow' }, 'The order here is the order on the site. The film marked Showreel opens the films page as the wide banner.'),
      h('button', {
        class: 'btn btn--primary', type: 'button', disabled: !c.filmCategories.length,
        onClick: () => {
          const film: Film = { id: uid('film'), slug: '', title: emptyL(), description: emptyL(), categoryId: state.filmFilter !== 'all' ? state.filmFilter : c.filmCategories[0]?.id ?? '', featured: false, onHome: true, date: new Date().toISOString().slice(0, 10), video: null, poster: null };
          c.films.push(film);
          markDirty();
          go(`films/${film.id}`);
        },
      }, '+ Add a new film'),
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
  let slugInput: HTMLInputElement | null = null;
  const slugField = text('URL name', film, 'slug', { required: true, help: 'The address: /films/<url-name>/. Lowercase letters, numbers and dashes.', transform: slugify });
  slugInput = slugField.querySelector('input');
  const title = localized('Title', film, 'title', { required: true });
  title.querySelector('input')!.addEventListener('input', autoSlug(film, () => slugInput));
  put(view,
    h('div', { class: 'detail-head' }, back('films', 'All films'), h('h2', {}, film.title.en || 'New film'),
      h('button', { class: 'btn btn--danger', type: 'button', onClick: () => remove(c.films, c.films.indexOf(film), `the film "${film.title.en || 'Untitled'}"`) && go('films') }, 'Delete film')),
    h('div', { class: 'card' },
      title,
      h('div', { class: 'grid2' },
        select('Category', film, 'categoryId', c.filmCategories.map((x) => ({ value: x.id, label: x.title.en })), { required: true }),
        slugField,
      ),
      localized('Description', film, 'description', { multiline: true, help: 'What the poster shows. Read by screen readers and Google.' }),
    ),
    h('div', { class: 'card' },
      h('p', { class: 'card__title' }, 'Video & poster'),
      media('Video file (MP4)', film, 'video', 'video', { required: true, help: 'H.264 MP4. Compress long films first: visitors stream this exact file.' }),
      media('Poster image', film, 'poster', 'image', { required: true, focus: true, help: 'Shown before the film plays: use a frame from the film.' }),
    ),
    h('div', { class: 'card' },
      checkbox('Showreel', film, 'featured', { help: 'Opens the films page as the wide cinemascope banner. Only one film can be the showreel.', onToggle: (on) => on && c.films.forEach((f) => f !== film && (f.featured = false)) }),
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
      h('p', { class: 'hint grow' }, 'One album = a title + as many photos as you like, inside one category. The order here is the order on the page.'),
      h('button', {
        class: 'btn btn--primary', type: 'button', disabled: !c.photoCategories.length,
        onClick: () => {
          const album: Album = { id: uid('album'), slug: '', title: emptyL(), categoryId: state.albumFilter !== 'all' ? state.albumFilter : c.photoCategories[0]?.id ?? '', onHome: true, photos: [] };
          c.albums.push(album);
          markDirty();
          go(`albums/${album.id}`);
        },
      }, '+ Add a new album'),
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
  const slugField = text('URL name', album, 'slug', { required: true, help: 'Used to link to this album. Lowercase letters, numbers and dashes.', transform: slugify });
  const title = localized('Title', album, 'title', { required: true });
  title.querySelector('input')!.addEventListener('input', autoSlug(album, () => slugField.querySelector('input')));
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
            h('button', { class: 'btn btn--sm icon', type: 'button', 'aria-label': 'Move earlier', disabled: i === 0, onClick: () => (album.photos.splice(i - 1, 0, ...album.photos.splice(i, 1)), markDirty(), drawPhotos()) }, '←'),
            h('button', { class: 'btn btn--sm icon', type: 'button', 'aria-label': 'Move later', disabled: i === album.photos.length - 1, onClick: () => (album.photos.splice(i + 1, 0, ...album.photos.splice(i, 1)), markDirty(), drawPhotos()) }, '→'),
            h('button', { class: 'btn btn--sm btn--danger', type: 'button', onClick: () => remove(album.photos, i, 'this photo') && drawPhotos() }, 'Delete'),
          ),
          h('label', { class: 'field' }, h('span', {}, 'Photo title'), h('input', { type: 'text', value: p.alt.en, placeholder: 'e.g. Bride in a golden caftan', onInput: (e: Event) => ((p.alt.en = (e.target as HTMLInputElement).value), markDirty()) })),
          h('details', {}, h('summary', {}, 'Title in French / Arabic'),
            h('div', { class: 'langs langs--stack' },
              (['fr', 'ar'] as const).map((lang) => h('label', { class: 'lang' }, h('input', { type: 'text', value: p.alt[lang] ?? '', lang, dir: lang === 'ar' ? 'rtl' : 'ltr', placeholder: 'Same as English if empty', onInput: (e: Event) => ((p.alt[lang] = (e.target as HTMLInputElement).value), markDirty()) }), h('b', {}, lang.toUpperCase()))),
            ),
          ),
        );
      }),
    );
  };

  const addFiles = async (files: File[]) => {
    const images = files.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (images.length < files.length) toast('Some files were skipped: only JPG, PNG and WebP photos can be added.', 'error');
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
    h('ol', { class: 'steps' }, h('li', {}, 'Give the album a title'), h('li', {}, 'Choose its category'), h('li', {}, 'Add the photos and give each one a title'), h('li', {}, 'Press Save changes, then Put online')),
    h('div', { class: 'detail-head' }, back('albums', 'All albums'), h('h2', {}, album.title.en || 'New album'),
      h('button', { class: 'btn btn--danger', type: 'button', onClick: () => remove(c.albums, c.albums.indexOf(album), `the album "${album.title.en || 'Untitled'}" and its photos`) && go('albums') }, 'Delete album')),
    h('div', { class: 'card' },
      title,
      h('div', { class: 'grid2' }, select('Category', album, 'categoryId', c.photoCategories.map((x) => ({ value: x.id, label: x.title.en })), { required: true, help: 'The tab it appears under on the Photography page.' }), slugField),
      checkbox('Show in the homepage photo carousels', album, 'onHome'),
    ),
    h('div', { class: 'card' },
      h('p', { class: 'card__title' }, 'Photos of this album'),
      h('p', { class: 'hint' }, 'Add as many photos as you like. The first one is the cover. Give each photo a title: it shows under the photo when a visitor opens it. Click a photo to choose the part that must stay visible when it is cropped.'),
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
      h('p', { class: 'hint grow' }, `Each ${kind === 'film' ? 'film' : 'album'} belongs to one category. They show as tabs on the ${kind === 'film' ? 'films' : 'photography'} page; a category with nothing in it is hidden there.`),
      h('button', { class: 'btn btn--primary', type: 'button', onClick: () => (list.push({ id: uid(kind === 'film' ? 'fc' : 'pc'), slug: '', title: emptyL() }), markDirty(), render()) }, '+ New category'),
    ),
    list.length
      ? h('div', { class: 'rows' },
          list.map((cat, i) => {
            const used = items.filter((x) => x.categoryId === cat.id).length;
            const slugField = text('URL name', cat, 'slug', { required: true, transform: slugify, help: `Used in links like /${kind === 'film' ? 'films' : 'photography'}/?category=${cat.slug || 'name'}` });
            const name = localized('Name', cat, 'title', { required: true });
            name.querySelector('input')!.addEventListener('input', autoSlug(cat, () => slugField.querySelector('input')));
            return h('div', { class: 'row row--plain' },
              h('div', { class: 'card', style: { padding: '0', border: '0' } }, name, slugField, h('small', { class: 'help' }, `${used} ${what}`)),
              h('div', { class: 'row__actions' },
                h('button', { class: 'btn btn--sm icon', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onClick: () => move(list, i, -1) }, '↑'),
                h('button', { class: 'btn btn--sm icon', type: 'button', 'aria-label': 'Move down', disabled: i === list.length - 1, onClick: () => move(list, i, 1) }, '↓'),
                h('button', {
                  class: 'btn btn--sm btn--danger', type: 'button',
                  onClick: () => (used ? toast(`Move its ${used} ${what} to another category first.`, 'error') : remove(list, i, `the category "${cat.title.en || 'Untitled'}"`) && render()),
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
            media('Video (landscape)', film, 'video', 'video', { required: true, help: 'Plays muted. Keep it short (10–30 s) and under about 15 MB.' }),
            media('Portrait version for phones (optional)', film, 'videoMobile', 'video', { help: '9:16. Without it, phones crop the landscape video.' }),
          ),
          h('div', { class: 'row__actions' },
            h('button', { class: 'btn btn--sm icon', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onClick: () => (home.videos.splice(i - 1, 0, ...home.videos.splice(i, 1)), markDirty(), drawFilms()) }, '↑'),
            h('button', { class: 'btn btn--sm icon', type: 'button', 'aria-label': 'Move down', disabled: i === home.videos.length - 1, onClick: () => (home.videos.splice(i + 1, 0, ...home.videos.splice(i, 1)), markDirty(), drawFilms()) }, '↓'),
            h('button', { class: 'btn btn--sm btn--danger', type: 'button', disabled: home.videos.length < 2, title: home.videos.length < 2 ? 'The hero needs at least one film' : undefined, onClick: () => remove(home.videos, i, `film ${i + 1}`) && render() }, 'Delete'),
          ),
        ),
      ),
    );
  drawFilms();
  put(view,
    h('p', { class: 'hint' }, 'The heading (H1), the line under it and the button labels are under Texts → Hero. The big name is under Logo & contact.'),
    h('div', { class: 'card' },
      h('div', { class: 'toolbar' },
        h('p', { class: 'card__title grow' }, 'Background films'),
        h('button', { class: 'btn btn--sm btn--primary', type: 'button', onClick: () => (home.videos.push({ id: uid('hero'), video: null, videoMobile: null }), markDirty(), render()) }, '+ Add a film'),
      ),
      h('p', { class: 'hint' }, 'One film loops. With several, each plays to its end and the next one fades in, in this order, round and round.'),
      films,
    ),
    h('div', { class: 'card' },
      h('p', { class: 'card__title' }, 'Still image'),
      media('Still (landscape)', home, 'poster', 'image', { required: true, help: 'The first frame of film 1, shown while it loads.' }),
      media('Still (portrait, phones)', home, 'posterMobile', 'image', { help: 'The first frame of the portrait version of film 1.' }),
    ),
    h('div', { class: 'card' }, h('p', { class: 'card__title' }, 'About section'), media('Photo in the arch frame', home, 'aboutPhoto', 'image', { focus: true, help: 'A portrait works best.' })),
  );
}

// The curved row of cards near the bottom of the homepage ("Stories that keep moving").
function carouselScreen(view: HTMLElement) {
  const items = state.content!.curve.items;
  put(view,
    h('div', { class: 'toolbar' },
      h('p', { class: 'hint grow' }, items.length ? 'The cards of the moving curved row, in this order.' : 'No cards yet: the row shows the photos of the albums marked "Show on the homepage". Add cards to choose its photos and videos yourself.'),
      h('button', { class: 'btn btn--primary', type: 'button', onClick: () => (items.push({ id: uid('card'), kind: 'image', image: null, video: null, href: '' }), markDirty(), render()) }, '+ Add a card'),
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
              ? [media('Video (MP4)', item, 'video', 'video', { required: true, help: 'Muted, loops while the card is on screen. Short and light: 5–15 s, a few MB.' }), media('First frame (optional)', item, 'image', 'image', { help: 'Shown until the video starts.' })]
              : media('Photo', item, 'image', 'image', { required: true, focus: true, help: 'Portrait photos fit the tall cards best.' }),
            text('Link (optional)', item, 'href', { placeholder: 'https://… or /films/', help: 'Opens when the card is clicked: a page of this site (/films/, /contact/…) or a full address. Empty: no link.' }),
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
            h('button', { class: 'btn btn--sm icon', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onClick: () => (s.socials.splice(i - 1, 0, ...s.socials.splice(i, 1)), markDirty(), drawSocials()) }, '↑'),
            h('button', { class: 'btn btn--sm btn--danger', type: 'button', onClick: () => remove(s.socials, i, 'this link') && drawSocials() }, 'Delete'),
          ),
        ),
      ),
    );
  drawSocials();
  put(view,
    h('div', { class: 'card' },
      h('p', { class: 'card__title' }, 'Logo'),
      media('Full logo (footer)', s, 'logo', 'image', { required: true, accept: 'image/png,image/webp', help: 'Transparent PNG, white artwork, about 1000 px wide.' }),
      media('Logo mark (header, menu)', s, 'logoMark', 'image', { required: true, accept: 'image/png,image/webp', help: 'The small square mark. Transparent PNG, white artwork, about 300 px.' }),
      media('Hero logo (big name on the homepage)', s, 'logoWordmark', 'image', { accept: 'image/png,image/webp', help: 'The large "MED NOUKHAL / VISUALS" over the hero film. Transparent PNG, white artwork, about 1500 px wide. Empty: the built-in one.' }),
      h('div', { class: 'grid2' }, text('Name', s, 'name', { required: true }), text('Logo text (read by screen readers)', s, 'logoAlt')),
      text('Job title (for Google)', s, 'jobTitle'),
    ),
    h('div', { class: 'card' },
      h('p', { class: 'card__title' }, 'Contact'),
      h('p', { class: 'hint' }, 'An empty field is hidden on the site.'),
      h('div', { class: 'grid2' },
        text('Email', s, 'email', { type: 'email' }),
        text('Phone (as shown)', s, 'phone', { placeholder: '+212 600 000 000' }),
        text('WhatsApp number', s, 'whatsapp', { help: 'International digits only, for example 212600000000', transform: (v) => v.replace(/\D/g, '') }),
      ),
    ),
    h('div', { class: 'card' },
      h('div', { class: 'toolbar' }, h('p', { class: 'card__title grow' }, 'Social links'), h('button', { class: 'btn btn--sm', type: 'button', onClick: () => (s.socials.push({ id: uid('social'), label: '', handle: '', href: '', icon: 'instagram' }), markDirty(), drawSocials()) }, '+ Add link')),
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
  clients: 'Home page · Client logos (title)',
  reviews: 'Home page & Reviews page · Reviews (titles)',
  curve: 'Home page · Moving photo row (title and button)',
  films: 'Films page · Title and intro',
  film: 'Films · Video player buttons',
  photo: 'Photography page · Title, intro and photo viewer',
  advice: 'Advice page · Title and intro',
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
      return h('label', { class: 'lang' }, long ? h('textarea', { ...attrs, rows: 3 }) : h('input', { ...attrs, type: 'text' }), h('b', {}, lang.toUpperCase()));
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
          h('button', { class: 'btn btn--sm', type: 'button', onClick: () => (own(), items.push(Object.fromEntries(Object.keys(shape).map((k) => [k, emptyL()]))), markDirty(), draw()) }, '+ Add item'),
        ),
        ...items.map((item, i) =>
          h('div', { class: 'sub' },
            Object.keys(shape).map((k) => {
              const field = localized(label(k), item, k, { multiline: String(shape[k]).length > 90 });
              field.addEventListener('input', own, true);
              return field;
            }),
            h('div', { class: 'toolbar' },
              h('button', { class: 'btn btn--sm icon', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onClick: () => (own(), items.splice(i - 1, 0, ...items.splice(i, 1)), markDirty(), draw()) }, '↑'),
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
    placeholder: 'Find a word or sentence on the site, e.g. "Book a shoot"',
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
    h('p', { class: 'hint' }, 'All the words of the site, grouped by page. Click a group to open it, or search above. Change a text and it replaces the old one; English, French and Arabic each have their own box (empty French or Arabic keeps the current translation).'),
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

// ---------------------------------------------------------------- clients, reviews, advice
function clientsScreen(view: HTMLElement, id?: string) {
  const c = state.content!;
  if (id) {
    const client = c.clients.find((x) => x.id === id);
    if (!client) return go('clients');
    put(view,
      h('div', { class: 'detail-head' }, back('clients', 'All clients'), h('h2', {}, client.name || 'New client')),
      h('div', { class: 'card' },
        text('Name', client, 'name', { required: true }),
        media('Logo', client, 'logo', 'image', { required: true, accept: 'image/png,image/webp,image/jpeg', help: 'Transparent PNG, about 400 px wide.' }),
        checkbox('Keep the logo colours (greyscale)', client, 'tone', { help: 'For multi-colour logos that would lose detail as a flat white shape.' }),
      ),
    );
    return;
  }
  put(view,
    h('div', { class: 'toolbar' }, h('p', { class: 'hint grow' }, 'Logos in the homepage client strip, in this order. Reviews are linked to a client.'),
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
        select('Client', review, 'clientId', [...c.clients.map((x) => ({ value: x.id, label: x.name })), { value: '', label: 'Someone not in the client list…' }], { help: 'Its name and logo are used, unless a logo is uploaded below.', onPick: () => render() }),
        !c.clients.some((x) => x.id === review.clientId) && text('Name', review, 'name', { required: true, placeholder: 'Company or person' }),
        media(c.clients.some((x) => x.id === review.clientId) ? 'Logo (optional: replaces the client logo)' : 'Logo', review, 'logo', 'image', { required: !c.clients.some((x) => x.id === review.clientId), accept: 'image/png,image/webp,image/jpeg', help: 'Shown in the round badge. A square, transparent PNG works best.' }),
        localized('Sector', review, 'sector', { help: 'For example "Hotel · Marrakech"' }),
        textarea('Quote', review, 'quote', { required: true, help: 'Exactly as the client wrote it, in their language.' }),
        select('Rating', review, 'rating', [5, 4, 3, 2, 1].map((n) => ({ value: n, label: '★'.repeat(n) }))),
        checkbox('Draft text (not yet the client’s real words)', review, 'placeholder', { help: 'Still shown on the site: replace it before launch, then untick this.' }),
      ),
    );
    return;
  }
  put(view,
    h('div', { class: 'toolbar' }, h('p', { class: 'hint grow' }, 'The reviews wall on the homepage and the reviews page.'),
      h('button', { class: 'btn btn--primary', type: 'button', onClick: () => { const x: Review = { id: uid('review'), clientId: c.clients[0]?.id ?? '', name: '', logo: null, sector: emptyL(), quote: '', rating: 5, placeholder: false }; c.reviews.push(x); markDirty(); go(`reviews/${x.id}`); } }, '+ New review')),
    h('div', { class: 'rows' },
      c.reviews.map((r, i) => h('div', { class: 'row' }, thumb(r.logo ?? c.clients.find((x) => x.id === r.clientId)?.logo),
        h('div', {}, h('p', { class: 'row__title' }, c.clients.find((x) => x.id === r.clientId)?.name ?? (r.name || 'No client'), r.placeholder && h('span', { class: 'badge' }, 'Draft'), ' ', '★'.repeat(r.rating)), h('p', { class: 'row__meta' }, r.quote.slice(0, 140) || '…')),
        rowActions(c.reviews, i, () => go(`reviews/${r.id}`), 'this review'))),
    ),
  );
}

function adviceScreen(view: HTMLElement, id?: string) {
  const c = state.content!;
  if (id) {
    const item = c.advice.find((x) => x.id === id);
    if (!item) return go('advice');
    put(view,
      h('div', { class: 'detail-head' }, back('advice', 'All advice videos'), h('h2', {}, item.title || 'New advice video')),
      h('div', { class: 'card' }, text('Title', item, 'title', { required: true }), media('Video (MP4)', item, 'video', 'video', { required: true }), media('Thumbnail', item, 'poster', 'image', { required: true, focus: true })),
    );
    return;
  }
  put(view,
    h('div', { class: 'toolbar' }, h('p', { class: 'hint grow' }, 'Videos on the Advice page.'),
      h('button', { class: 'btn btn--primary', type: 'button', onClick: () => { const x: Advice = { id: uid('advice'), title: '', video: null, poster: null }; c.advice.push(x); markDirty(); go(`advice/${x.id}`); } }, '+ New video')),
    h('div', { class: 'rows' }, c.advice.map((a, i) => h('div', { class: 'row' }, thumb(a.poster), h('div', {}, h('p', { class: 'row__title' }, a.title || 'Untitled')), rowActions(c.advice, i, () => go(`advice/${a.id}`), `"${a.title}"`)))),
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
      h('p', { class: 'card__title' }, 'Sign-in email and password'),
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
      h('p', { class: 'hint' }, 'You are signed out automatically after 8 hours without activity.'),
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
