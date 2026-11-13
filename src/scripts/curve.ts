// Auto-moving curved photo row. Each card is placed from its distance to the screen centre:
// the centre stays flat, and the sides grow and turn inward like the inside of a curved screen.
// The row drifts on its own, speeds up gently while the page scrolls, pauses under the mouse, and can be dragged or
// swiped with a little momentum on release.
const root = document.querySelector<HTMLElement>('[data-curve]');

if (root) {
  const stage = root.querySelector<HTMLElement>('[data-curve-stage]')!;
  const cards = [...root.querySelectorAll<HTMLElement>('[data-curve-card]')];
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Video cards (from the dashboard) play only while they are on screen, never with reduced motion or data saver.
  const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const stillOnly = calm || !!net?.saveData || /2g|3g/.test(net?.effectiveType ?? '');
  const videos = cards.map((card) => card.querySelector<HTMLVideoElement>('video'));
  let stageOn = false;
  const syncVideo = (i: number, visible: boolean) => {
    const video = videos[i];
    if (!video || stillOnly) return;
    if (visible && stageOn) video.play().catch(() => {});
    else if (!video.paused) video.pause();
  };

  const SPEED = 0.0535; // share of the row's width travelled per second
  const GROWTH = 0.22; // extra size at the screen edge
  const TURN = 27; // degrees of inward turn at the screen edge
  const SPACING = 1.085; // card pitch as a multiple of the card width
  const SURGE_MAX = 2.4; // scrolling can add at most this many times the resting pace
  const EASE = 5; // how quickly the speed follows its target, per second

  let width = 0;
  let step = 0;
  let total = 1;
  let half = 0;
  let depth = 0;
  let cardWidth = 0;
  let offset = 0;
  // Last visibility written, so it is only touched when it changes. Cards start hidden in the CSS.
  const shown = cards.map(() => false);

  const wrap = (v: number) => ((v % total) + total) % total;

  const measure = () => {
    width = stage.clientWidth;
    cardWidth = cards[0].offsetWidth;
    step = cardWidth * SPACING;
    total = step * cards.length || 1;
    half = Math.max(width / 2, step * 2); // keeps the curve gentle on phones, where few cards fit
    depth = Math.max(width * 0.6, 700);
  };

  const paint = () => {
    const reach = width / 2 + cardWidth * 1.5;
    cards.forEach((card, i) => {
      let x = wrap(i * step - offset);
      if (x > total / 2) x -= total;
      const visible = Math.abs(x) <= reach;
      if (visible !== shown[i]) {
        shown[i] = visible;
        card.style.visibility = visible ? 'visible' : 'hidden';
        syncVideo(i, visible);
      }
      if (!visible) return;
      const d = Math.max(-1.25, Math.min(1.25, x / half));
      card.style.transform = `translate3d(${x.toFixed(1)}px,0,0) perspective(${depth.toFixed(0)}px) rotateY(${(-TURN * d).toFixed(2)}deg) scale(${(1 + GROWTH * d * d).toFixed(4)})`;
    });
  };

  measure();
  paint();
  root.classList.add('is-ready');

  // Only a width change matters; phones resize the window height whenever the address bar slides.
  new ResizeObserver(() => {
    if (stage.clientWidth === width) return;
    measure();
    paint();
  }).observe(stage);

  // Fetch every photo shortly before the section arrives, so none pops in while the row moves.
  new IntersectionObserver(
    ([entry], observer) => {
      if (!entry.isIntersecting) return;
      root.querySelectorAll('img').forEach((img) => (img.loading = 'eager'));
      observer.disconnect();
    },
    { rootMargin: '1000px' },
  ).observe(root);

  // Each photo fades in once decoded instead of appearing in one hard step.
  cards.forEach((card) => {
    const img = card.querySelector('img');
    const done = () => card.classList.add('is-loaded');
    if (!img || (img.complete && img.naturalWidth)) return done();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });

  let frame = 0;
  let last = 0;
  let onScreen = false;
  let target = calm ? 0 : 1; // resting pace: 0 under the mouse or with reduced motion
  let speed = target; // pace actually applied, eased toward target + surge
  let surge = 0; // extra pace from scrolling the page, fades back to zero
  let fling = 0; // px per second left over from a drag
  let dragging = false;

  const tick = (now: number) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    const k = 1 - Math.exp(-dt * EASE);
    speed += ((dragging ? 0 : target) + surge - speed) * k;
    surge *= Math.exp(-dt * 1.8);
    fling *= Math.exp(-dt * 3.2);
    if (Math.abs(fling) < 2) fling = 0;
    if (!dragging) offset = wrap(offset + (width * SPEED * speed + fling) * dt);
    paint();
    // With reduced motion the row only moves while a drag or its momentum lasts.
    const idle = calm && !dragging && !fling;
    frame = onScreen && !idle ? requestAnimationFrame(tick) : 0;
  };

  const wake = () => {
    if (frame || !onScreen) return;
    last = 0;
    frame = requestAnimationFrame(tick);
  };

  // The scroll distance comes from motion.ts ('mn:scroll'), which reads the position once per frame;
  // reading it here, after this row's style writes, would force an extra style pass every frame.
  // It sets a speed, not a distance, so a long fast scroll can never fling the row far ahead.
  const onScroll = (e: Event) => {
    surge = Math.max(surge, Math.min(Math.abs((e as CustomEvent<number>).detail) * 0.04, SURGE_MAX));
  };

  // Runs only while the section is on screen.
  new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
      stageOn = onScreen;
      shown.forEach((visible, i) => syncVideo(i, visible));
      root.classList.toggle('is-running', onScreen); // layers are only promoted while moving
      if (onScreen) {
        if (!calm) document.addEventListener('mn:scroll', onScroll);
        if (!calm) wake();
      } else {
        document.removeEventListener('mn:scroll', onScroll);
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    { rootMargin: '100px' },
  ).observe(stage);

  if (!calm) {
    stage.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') target = 0;
    });
    stage.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') target = 1;
    });
  }

  // Drag or swipe sideways; vertical swipes still scroll the page (touch-action: pan-y in the CSS).
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  const release = (e: PointerEvent, keepMomentum: boolean) => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('is-dragging');
    if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    // A finger that stopped before lifting should not throw the row.
    fling = keepMomentum && e.timeStamp - lastT < 90 ? Math.max(-2600, Math.min(2600, velocity)) : 0;
    wake();
  };
  // The drag starts once the pointer has moved a few pixels, so a plain click still opens a linked card;
  // a click that ends a drag is swallowed instead.
  let armed = false;
  let startX = 0;
  let dragged = false;
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    armed = true;
    dragged = false;
    startX = e.clientX;
    lastX = e.clientX;
    lastT = e.timeStamp;
    velocity = 0;
  });
  stage.addEventListener('pointermove', (e) => {
    if (armed && !dragging && Math.abs(e.clientX - startX) > 6) {
      dragging = true;
      dragged = true;
      fling = 0;
      stage.setPointerCapture(e.pointerId);
      stage.classList.add('is-dragging');
      wake();
    }
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dt = e.timeStamp - lastT;
    lastX = e.clientX;
    lastT = e.timeStamp;
    offset = wrap(offset - dx);
    if (dt > 0) velocity = velocity * 0.5 + ((-dx / dt) * 1000) * 0.5;
  });
  stage.addEventListener('pointerup', (e) => {
    armed = false;
    release(e, true);
  });
  // The browser took the gesture over for a vertical scroll.
  stage.addEventListener('pointercancel', (e) => {
    armed = false;
    release(e, false);
  });
  stage.addEventListener(
    'click',
    (e) => {
      if (!dragged) return;
      e.preventDefault();
      e.stopPropagation();
      dragged = false;
    },
    true,
  );
  stage.addEventListener('dragstart', (e) => e.preventDefault());
}
