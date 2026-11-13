// Category tabs on the films and photography pages. Each tab group names the items it filters in
// data-cat-filter (a CSS selector); every item carries its category slug in data-cat.
// Items that have a data-slot (the films grid pattern) are renumbered in view order, so the layout keeps its rhythm.
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelectorAll<HTMLElement>('[data-cat-filter]').forEach((group) => {
  const items = [...document.querySelectorAll<HTMLElement>(group.dataset.catFilter!)];
  const buttons = [...group.querySelectorAll<HTMLButtonElement>('[data-filter]')];

  const apply = (filter: string) => {
    let slot = 0;
    items.forEach((item) => {
      const show = filter === 'all' || item.dataset.cat === filter;
      item.hidden = !show;
      if (show && item.dataset.slot !== undefined) item.dataset.slot = String(slot++ % 8);
      // Cards brought back by a filter fade in, rather than appearing already mid-animation.
      if (show && !calm) item.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'cubic-bezier(0.2, 0.7, 0.1, 1)' });
    });
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
  };

  buttons.forEach((button) => button.addEventListener('click', () => apply(button.dataset.filter!)));

  // A link like /films/?category=music-videos opens on that tab.
  const wanted = new URLSearchParams(location.search).get('category');
  if (wanted && buttons.some((b) => b.dataset.filter === wanted)) apply(wanted);
});
