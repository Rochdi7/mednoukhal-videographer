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
const looping = document.querySelectorAll<HTMLElement>('.hero, .ticker, .clients__stage, .btn');
if (looping.length && 'IntersectionObserver' in window) {
  const idle = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.target.classList.toggle('is-offscreen', !e.isIntersecting)),
    { rootMargin: '120px' },
  );
  looping.forEach((el) => idle.observe(el));
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
