// Auto-moving curved photo row. Each card is placed from its distance to the screen centre:
// the centre stays flat, and the sides grow and turn inward like the inside of a curved screen.
const root = document.querySelector<HTMLElement>('[data-curve]');

if (root) {
  const stage = root.querySelector<HTMLElement>('[data-curve-stage]')!;
  const cards = [...root.querySelectorAll<HTMLElement>('[data-curve-card]')];
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SPEED = 0.0535; // share of the row's width travelled per second
  const GROWTH = 0.22; // extra size at the screen edge
  const TURN = 27; // degrees of inward turn at the screen edge
  const SPACING = 1.085; // card pitch as a multiple of the card width

  let width = 0;
  let step = 0;
  let total = 0;
  let half = 0;
  let depth = 0;
  let cardWidth = 0;
  let offset = 0;

  const measure = () => {
    width = stage.clientWidth;
    cardWidth = cards[0].offsetWidth;
    step = cardWidth * SPACING;
    total = step * cards.length;
    half = Math.max(width / 2, step * 2); // keeps the curve gentle on phones, where few cards fit
    depth = Math.max(width * 0.6, 700);
  };

  const paint = () => {
    cards.forEach((card, i) => {
      let x = (((i * step - offset) % total) + total) % total;
      if (x > total / 2) x -= total;
      if (Math.abs(x) > width / 2 + cardWidth * 1.5) {
        card.style.visibility = 'hidden';
        return;
      }
      const d = Math.max(-1.25, Math.min(1.25, x / half));
      card.style.visibility = 'visible';
      card.style.transform = `translate3d(${x.toFixed(2)}px,0,0) perspective(${depth}px) rotateY(${(-TURN * d).toFixed(2)}deg) scale(${(1 + GROWTH * d * d).toFixed(4)})`;
    });
  };

  measure();
  paint();
  window.addEventListener('resize', () => {
    measure();
    paint();
  }, { passive: true });

  // Fetch every photo shortly before the section arrives, so none pops in while the row moves.
  new IntersectionObserver(
    ([entry], observer) => {
      if (!entry.isIntersecting) return;
      root.querySelectorAll('img').forEach((img) => (img.loading = 'eager'));
      observer.disconnect();
    },
    { rootMargin: '1000px' },
  ).observe(root);

  if (!calm) {
    let frame = 0;
    let last = 0;
    let pace = 1;
    let target = 1;
    let boost = 0; // scrolling the page adds a push to the row
    let lastY = window.scrollY;

    window.addEventListener('scroll', () => {
      boost += (window.scrollY - lastY) * 0.7;
      lastY = window.scrollY;
    }, { passive: true });

    const tick = (now: number) => {
      const elapsed = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      pace += (target - pace) * 0.08; // eases into and out of the hover pause
      const push = boost * 0.1;
      boost -= push;
      offset = (offset + width * SPEED * pace * elapsed + push) % total;
      paint();
      frame = requestAnimationFrame(tick);
    };

    // Runs only while the section is on screen.
    new IntersectionObserver(
      ([entry]) => {
        cancelAnimationFrame(frame);
        last = 0;
        root.classList.toggle('is-running', entry.isIntersecting); // layers are only promoted while moving
        if (entry.isIntersecting) frame = requestAnimationFrame(tick);
      },
      { rootMargin: '100px' },
    ).observe(stage);

    stage.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') target = 0;
    });
    stage.addEventListener('pointerleave', () => {
      target = 1;
    });
  }
}
