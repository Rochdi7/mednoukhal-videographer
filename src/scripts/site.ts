// Header state, mobile menu and scroll reveals. Loaded on every page.
const head = document.querySelector<HTMLElement>('[data-head]');
// The header turns solid once the page has scrolled 60px. A 1px marker at that depth is watched instead of
// reading scrollY on every scroll event, which would force a style recalculation mid-frame.
if (head) {
  const mark = document.createElement('div');
  mark.setAttribute('aria-hidden', 'true');
  mark.style.cssText = 'position:absolute;top:60px;left:0;width:1px;height:1px;pointer-events:none;visibility:hidden';
  document.body.prepend(mark);
  new IntersectionObserver(([entry]) => {
    head.classList.toggle('is-stuck', !entry.isIntersecting && entry.boundingClientRect.top < 0);
  }).observe(mark);
}

// On the homepage, Services is a section rather than a page: while it crosses the middle of the screen the
// nav underline moves from Home to Services, and back again once it scrolls away.
const services = document.getElementById('services');
if (services && 'IntersectionObserver' in window) {
  const homeLinks = [...document.querySelectorAll<HTMLAnchorElement>('.site-nav a[aria-current="page"], .menu__links a[aria-current="page"]')];
  const serviceLinks = [...document.querySelectorAll<HTMLAnchorElement>('.site-nav a[href$="#services"], .menu__links a[href$="#services"]')];
  new IntersectionObserver(
    ([entry]) => {
      const inView = entry.isIntersecting;
      homeLinks.forEach((a) => (inView ? a.removeAttribute('aria-current') : a.setAttribute('aria-current', 'page')));
      serviceLinks.forEach((a) => (inView ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
    },
    { rootMargin: '-50% 0px -50% 0px' },
  ).observe(services);
}

const menu = document.querySelector<HTMLDialogElement>('[data-menu]');
const openBtn = document.querySelector('[data-menu-open]');
if (menu && openBtn) {
  openBtn.addEventListener('click', () => menu.showModal());
  menu.querySelector('[data-menu-close]')?.addEventListener('click', () => menu.close());
  menu.querySelectorAll('[data-menu-link]').forEach((a) => a.addEventListener('click', () => menu.close()));
}

// Cursor spotlight on cards: the glow follows the pointer through two CSS variables.
document.querySelectorAll<HTMLElement>('[data-spot]').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});

// Endless decorative animations (marquees, film strips, REC light, button light leaks) pause while off screen,
// so a phone only spends frames on what can actually be seen.
const looping = document.querySelectorAll<HTMLElement>('.hero, .ticker, .clients__stage, .reviews__stage, .btn');
if (looping.length && 'IntersectionObserver' in window) {
  const idle = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.target.classList.toggle('is-offscreen', !e.isIntersecting)),
    { rootMargin: '120px' },
  );
  looping.forEach((el) => idle.observe(el));
}

// Images start loading long before they reach the screen. Native lazy loading waits until a picture is close,
// and inside carousels and film strips it waits until each card slides into view, which shows as empty frames.
// Both steps wait for the first screen to finish loading, so they never slow the opening view or the preloader.
// 1. Near: once a section is within one and a half screens, all of its pictures load, sliding cards included.
// 2. Idle: the rest of the page follows at low priority, so a fast scroll never meets an empty frame.
//    Skipped when the visitor has Data Saver on or a 2G/3G connection, except small images marked data-early.
const lazy = [...document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')];
const wake = (img: HTMLImageElement, priority: 'high' | 'low') => {
  if (img.loading !== 'lazy') return;
  img.fetchPriority = priority;
  img.loading = 'eager';
};
const warmImages = () => {
  if (!('IntersectionObserver' in window)) return lazy.forEach((img) => wake(img, 'low'));
  const groups = new Map<Element, HTMLImageElement[]>();
  for (const img of lazy) {
    const group = img.closest('section, footer') ?? document.body;
    groups.set(group, [...(groups.get(group) ?? []), img]);
  }
  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        groups.get(e.target)?.forEach((img) => wake(img, 'high'));
        near.unobserve(e.target);
      }
    },
    { rootMargin: '150% 0px' },
  );
  groups.forEach((_, group) => near.observe(group));
  lazy.forEach((img) => 'early' in img.dataset && wake(img, 'low'));

  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /2g|3g/.test(conn?.effectiveType ?? '')) return;
  const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 300));
  idle(() => lazy.forEach((img) => wake(img, 'low')), { timeout: 2500 });
};
if (lazy.length) {
  if (document.readyState === 'complete') warmImages();
  else window.addEventListener('load', warmImages, { once: true });
}

const revealed = document.querySelectorAll<HTMLElement>('[data-reveal]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  revealed.forEach((el) => io.observe(el));
} else {
  revealed.forEach((el) => el.classList.add('is-in'));
}
