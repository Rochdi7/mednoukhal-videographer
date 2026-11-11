// Header state, mobile menu and scroll reveals. Loaded on every page.
const head = document.querySelector<HTMLElement>('[data-head]');
if (head) {
  const update = () => {
    head.classList.toggle('is-stuck', window.scrollY > 60);
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
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
