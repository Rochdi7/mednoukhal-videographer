// Page loader. The counter follows real loading: it eases toward 90% on a timer, then only
// completes once the page has finished loading (or after MAX_WAIT, so a slow video never traps anyone).
// When it reaches 100% the black screen splits into tiles that shrink away in a random order,
// and 'mn:reveal' tells the rest of the site to start its entrance animations.

const MIN_COUNT = 1000; // ms the counter takes to run when the page is already loaded
const MAX_WAIT = 4500; // ms after which the counter completes regardless
const HOLD = 260; // ms the 100% stays on screen
const TILE_TIME = 560;
const TILE_SPREAD = 380; // tiles start at random moments within this window
const EASE = 'cubic-bezier(0.76, 0, 0.24, 1)';

const root = document.documentElement;
const loader = document.querySelector<HTMLElement>('[data-preloader]');
let revealed = false;

const reveal = () => {
  if (revealed) return;
  revealed = true;
  root.classList.remove('is-loading');
  document.dispatchEvent(new Event('mn:reveal'));
};

if (!loader || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  loader?.remove();
  reveal();
} else {
  try {
    run(loader);
  } catch (error) {
    loader.remove();
    reveal();
    console.error(error);
  }
}

function run(el: HTMLElement) {
  // Moving between pages (class set in Base.astro): no counter, the tiles open as soon as the fonts are ready.
  if (root.classList.contains('pre-quick')) {
    const fonts = document.fonts?.ready ?? Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 600))]).then(() => tiles(el));
    return;
  }
  const num = el.querySelector<HTMLElement>('[data-preloader-num]')!;
  const count = el.querySelector<HTMLElement>('.preloader__count')!;
  let loaded = document.readyState === 'complete';
  if (!loaded) window.addEventListener('load', () => (loaded = true), { once: true });

  const start = performance.now();
  let shown = 0;
  const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

  const step = () => {
    // performance.now(), not the frame timestamp: the first frame can be stamped before `start`.
    const t = Math.max(0, performance.now() - start);
    const timed = easeOut(Math.min(t / MIN_COUNT, 1));
    const done = loaded || t > MAX_WAIT;
    // Still loading: hold near 90% and creep forward so the number never looks frozen.
    const cap = done ? 1 : 0.9 + 0.08 * Math.min(Math.max(t - MIN_COUNT, 0) / (MAX_WAIT - MIN_COUNT), 1);
    const target = Math.min(timed, cap);
    shown += (target - shown) * 0.25;
    if (done && timed >= 1 && 1 - shown < 0.004) shown = 1;
    num.textContent = String(Math.round(shown * 100));
    if (shown < 1) requestAnimationFrame(step);
    else setTimeout(() => leave(el, count), HOLD);
  };
  requestAnimationFrame(step);
}

function leave(el: HTMLElement, count: HTMLElement) {
  count.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 320, easing: 'ease-in', fill: 'forwards' })
    .finished.then(() => tiles(el));
}

function tiles(el: HTMLElement) {
  const wide = window.innerWidth >= 700;
  const cols = wide ? 5 : 3;
  const rows = wide ? 4 : 6;
  el.style.setProperty('--cols', String(cols));
  el.style.setProperty('--rows', String(rows));

  const grid = document.createElement('div');
  grid.className = 'preloader__tiles';
  const origins = [
    ['scaleX(0)', 'left center'],
    ['scaleX(0)', 'right center'],
    ['scaleY(0)', 'center top'],
    ['scaleY(0)', 'center bottom'],
  ];
  const cells = Array.from({ length: cols * rows }, () => {
    const cell = document.createElement('span');
    grid.append(cell);
    return cell;
  });
  // Swap the solid backdrop for identical tiles in the same frame, so nothing flashes.
  el.append(grid);
  el.classList.add('is-tiled');
  reveal();

  const runs = cells.map((cell) => {
    const [shrink, origin] = origins[Math.floor(Math.random() * origins.length)];
    cell.style.transformOrigin = origin;
    return cell.animate([{ transform: 'none' }, { transform: shrink }], {
      duration: TILE_TIME,
      delay: Math.random() * TILE_SPREAD,
      easing: EASE,
      fill: 'forwards',
    }).finished;
  });
  Promise.all(runs).finally(() => el.remove());
}
