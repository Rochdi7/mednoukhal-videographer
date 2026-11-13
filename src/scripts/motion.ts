// Scroll animation for the whole site. Two kinds of motion:
// - reveals play once when something enters the screen;
// - scrubs follow the scrollbar, smoothed so a mouse wheel still feels fluid.
// Visitors who ask for reduced motion get the finished layout and none of this.

const root = document.documentElement;
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// If anything here ever fails, the content must still be visible.
let begun = false;
const begin = () => {
  if (begun) return;
  begun = true;
  try {
    if (!calm) start();
  } catch (error) {
    document.querySelectorAll('.m-pre').forEach((el) => el.classList.remove('m-pre'));
    console.error(error);
  }
  root.classList.add('m-ready');
};

// While the preloader covers the page, entrance animations would play unseen; start them as it clears.
if (root.classList.contains('is-loading') && document.querySelector('[data-preloader]')) {
  document.addEventListener('mn:reveal', begin, { once: true });
  setTimeout(begin, 9000);
} else {
  begin();
}

function start() {
  const rtl = root.dir === 'rtl';
  const wide = window.matchMedia('(min-width: 900px)').matches;
  const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
  const NEAR = '0px 0px -6% 0px';
  const $$ = <T extends Element = HTMLElement>(selector: string, scope: ParentNode = document) => [...scope.querySelectorAll<T>(selector)];
  const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

  /* ---------- Reveals ---------- */

  interface Recipe {
    from: Keyframe;
    duration?: number;
    gap?: number;
    margin?: string;
    inner?: { selector: string; from: Keyframe; duration: number };
  }

  // Elements arriving together play in reading order, so a grid ripples without per-item setup.
  const reveal = (selector: string, recipe: Recipe) => {
    const { from, duration = 1000, gap = 90, margin = NEAR, inner } = recipe;
    const items = $$(selector).filter((el) => !el.dataset.m && !el.hasAttribute('data-reveal'));
    if (!items.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
          .forEach((entry, i) => {
            const el = entry.target as HTMLElement;
            const delay = Math.min(i * gap, 700);
            io.unobserve(el);
            el.classList.remove('m-pre');
            el.animate([from, { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)' }].map(only(from)), { duration, delay, easing: EASE, fill: 'backwards' });
            if (inner) el.querySelector(inner.selector)?.animate([inner.from, { transform: 'none' }], { duration: inner.duration, delay, easing: EASE, fill: 'backwards' });
          });
      },
      { rootMargin: margin },
    );
    items.forEach((el) => {
      el.dataset.m = '1';
      el.classList.add('m-pre');
      io.observe(el);
    });
  };

  // Keeps only the properties the starting frame actually animates.
  const only = (from: Keyframe) => (frame: Keyframe) => Object.fromEntries(Object.entries(frame).filter(([key]) => key in from)) as Keyframe;

  const toWords = (el: HTMLElement, outerClass: string | null, innerClass: string) => {
    if ([...el.childNodes].some((n) => n.nodeType !== Node.TEXT_NODE)) return [];
    const words = (el.textContent ?? '').trim().split(/\s+/);
    el.textContent = '';
    return words.map((word, i) => {
      const inner = document.createElement('span');
      inner.className = innerClass;
      inner.textContent = word;
      if (outerClass) {
        const outer = document.createElement('span');
        outer.className = outerClass;
        outer.append(inner);
        el.append(outer);
      } else {
        el.append(inner);
      }
      if (i < words.length - 1) el.append(' ');
      return inner;
    });
  };

  // Headings: words climb out from behind a mask, one after another.
  const headingWatch = new IntersectionObserver(
    (entries) => {
      entries.filter((e) => e.isIntersecting).forEach((entry) => {
        headingWatch.unobserve(entry.target);
        $$('.m-wi', entry.target).forEach((word, i) => {
          word.classList.remove('m-pre');
          word.animate(
            [{ transform: `translateY(118%) rotate(${rtl ? -5 : 5}deg)` }, { transform: 'none' }],
            { duration: 1100, delay: i * 75, easing: EASE, fill: 'backwards' },
          );
        });
      });
    },
    { rootMargin: NEAR },
  );
  $$('.h-xl, .h-lg, .about h2, .curve__intro h2, .album__title').forEach((heading) => {
    const words = toWords(heading, 'm-w', 'm-wi');
    if (!words.length) return;
    words.forEach((w) => w.classList.add('m-pre'));
    headingWatch.observe(heading);
  });

  const up = (distance: number): Keyframe => ({ opacity: 0, transform: `translateY(${distance}px)` });
  const side = (distance: number): Keyframe => ({ opacity: 0, transform: `translateX(${rtl ? distance : -distance}px)` });

  // Labels and supporting text
  reveal('.eyebrow', { from: side(26), duration: 900, gap: 60 });
  reveal('.lead, .curve__lead, .film-page__text p, .film__cap', { from: up(26), duration: 1100, gap: 80 });
  reveal('.carousel__head', { from: up(20), duration: 900 });
  reveal('.filters button', { from: up(16), duration: 800, gap: 70 });
  // About photo: the arch wipes open from the bottom while the still settles from a push-in.
  reveal('.about__frame', { from: { clipPath: 'inset(100% 0 0 0)' }, duration: 1400, inner: { selector: 'img', from: { transform: 'scale(1.3)' }, duration: 1700 } });
  reveal('.about__badge', { from: { opacity: 0, transform: 'scale(0.6) rotate(-90deg)' }, duration: 1200 });

  // Service cards tip up toward the viewer, rippling across the grid.
  reveal('.expertise__item', { from: { opacity: 0, transform: 'perspective(900px) translateY(70px) rotateX(-16deg)' }, duration: 1150, gap: 110 });

  // The photos on screen land one by one when the row arrives. Every other photo is simply in place when dragged to.
  const firstTiles = $$('[data-panel="photo"] .tile').slice(0, 6);
  const tileRow = document.querySelector('[data-panel="photo"] .carousel__view');
  if (tileRow && firstTiles.length) {
    firstTiles.forEach((tile) => tile.classList.add('m-pre'));
    const tileWatch = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        tileWatch.disconnect();
        const onScreen = firstTiles
          .filter((tile) => {
            const r = tile.getBoundingClientRect();
            return r.right > 0 && r.left < window.innerWidth;
          })
          .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        firstTiles.forEach((tile) => tile.classList.remove('m-pre'));
        onScreen.forEach((tile, i) => {
          tile.animate([{ opacity: 0, transform: 'translateY(90px)' }, { opacity: 1, transform: 'none' }], { duration: 1200, delay: i * 110, easing: EASE, fill: 'backwards' });
        });
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    tileWatch.observe(tileRow);
  }

  // Photography page: each print wipes open while the picture settles inside it.
  reveal('.print', {
    from: { clipPath: 'inset(100% 0 0 0)', opacity: 1 },
    duration: 1200,
    gap: 100,
    inner: { selector: 'img', from: { transform: 'scale(1.3)' }, duration: 1500 },
  });
  reveal('.album__head .album__count', { from: up(14), duration: 800 });

  reveal('.film', { from: up(70), duration: 1100, gap: 110 });
  reveal('.spec div', { from: up(18), duration: 800, gap: 70 });
  reveal('.next-film', { from: up(40), duration: 1000 });
  // Contact: the direct-line cards slide in one after another, the form panel rises behind them.
  reveal('.contact__cards > li, .contact__social li', { from: up(24), duration: 900, gap: 90 });
  reveal('.contact__panel', { from: { opacity: 0, transform: 'translateY(50px) scale(0.98)' }, duration: 1200 });
  reveal('.form-grid .field, .form-foot', { from: up(22), duration: 800, gap: 55 });

  // Reviews: the wall rises into place, then the controls under it.
  reveal('.reviews__stage', { from: { opacity: 0, transform: 'translateY(60px) scale(0.97)' }, duration: 1300 });
  reveal('.reviews__foot > *', { from: up(18), duration: 800 });

  // Clients: the count settles in, then the film strips slide in from opposite sides.
  reveal('.clients__count', { from: { opacity: 0, transform: 'translateY(30px) scale(0.9)' }, duration: 1100 });
  // Animates `translate` (not `transform`) and leaves the end frame implicit, so each strip keeps its CSS tilt and opacity.
  const stage = document.querySelector('.clients__stage');
  if (stage) {
    const strips = $$('.strip', stage);
    strips.forEach((strip) => strip.classList.add('m-pre'));
    const stripWatch = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        stripWatch.disconnect();
        strips.forEach((strip, i) => {
          strip.classList.remove('m-pre');
          strip.animate([{ opacity: 0, translate: `${i ? 14 : -14}vw 0`, offset: 0 }], { duration: 1600, delay: i * 140, easing: EASE, fill: 'backwards' });
        });
      },
      { rootMargin: NEAR },
    );
    stripWatch.observe(stage);
  }

  // Closing section
  reveal('.curve__stage', { from: { opacity: 0, transform: 'translateY(70px) scale(0.96)' }, duration: 1300 });
  reveal('.curve__note', { from: { opacity: 0, transform: 'translateY(14px) rotate(-10deg) scale(0.9)' }, duration: 900, gap: 200 });
  reveal('.curve__btn', { from: { opacity: 0, transform: 'scale(0.82)' }, duration: 1000 });

  // Footer sits at the very end of the page, so it must trigger without any bottom margin.
  // The closing title rises in, then the credits roll up column by column.
  reveal('.site-foot__title, .site-foot__mail', { from: up(40), duration: 1200, gap: 120 });
  reveal('.site-foot__actions > *', { from: up(20), duration: 900, gap: 110 });
  reveal('.site-foot__mark', { from: { opacity: 0, transform: 'translateY(40px) scale(0.92)' }, duration: 1200, margin: '0px' });
  reveal('.site-foot__col li', { from: up(16), duration: 800, gap: 45, margin: '0px' });
  reveal('.site-foot__bar > *', { from: up(12), duration: 800, gap: 90, margin: '0px' });
  reveal('.site-foot__giant', { from: { opacity: 0, transform: 'translateY(60px)' }, duration: 1600, margin: '0px' });

  // Hand-drawn arrows draw themselves.
  const drawWatch = new IntersectionObserver(
    (entries) => {
      entries.filter((e) => e.isIntersecting).forEach((entry) => {
        drawWatch.unobserve(entry.target);
        entry.target.classList.remove('m-pre');
        $$<SVGPathElement>('path', entry.target).forEach((path, i) => {
          path.style.strokeDashoffset = '0';
          path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: i ? 400 : 1300, delay: i ? 1200 : 200, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'backwards' });
        });
      });
    },
    { rootMargin: NEAR },
  );
  $$('.curve__arrow, .curve__squiggle').forEach((svg) => {
    svg.classList.add('m-pre');
    $$<SVGPathElement>('path', svg).forEach((path) => {
      path.setAttribute('pathLength', '1');
      path.style.strokeDasharray = '1';
      path.style.strokeDashoffset = '1';
    });
    drawWatch.observe(svg);
  });

  /* ---------- Scrubs ---------- */

  interface Scrub {
    measure: HTMLElement;
    range: (top: number, bottom: number, vh: number) => [number, number];
    apply: (p: number) => void;
    a: number;
    b: number;
    now: number;
    shown: number;
    on: boolean; // measured in layout(), never in tick(): reading layout there would force a reflow every frame
  }

  const scrubs: Scrub[] = [];
  const scrub = (measure: HTMLElement | null, range: Scrub['range'], apply: Scrub['apply']) => {
    if (measure) scrubs.push({ measure, range, apply, a: 0, b: 1, now: -1, shown: -1, on: false });
  };

  // Hero: the footage drifts closer while the logo lifts away and the frame sinks to black.
  const hero = document.querySelector<HTMLElement>('.hero');
  if (hero) {
    const media = hero.querySelector<HTMLElement>('.hero__media')!;
    const inner = hero.querySelector<HTMLElement>('.hero__inner')!;
    const cue = hero.querySelector<HTMLElement>('.hero__scroll');
    const hud = hero.querySelector<HTMLElement>('.hero__hud');
    const veil = document.createElement('div');
    veil.className = 'm-veil';
    media.after(veil);
    scrub(hero, (top, bottom) => [top, bottom], (p) => {
      media.style.transform = `scale(${(1 + 0.16 * p).toFixed(4)})`;
      inner.style.transform = `translate3d(0,${(-26 * p).toFixed(2)}vh,0)`;
      inner.style.opacity = clamp(1 - p * 1.7).toFixed(3);
      veil.style.opacity = (0.92 * p).toFixed(3);
      if (cue) cue.style.opacity = clamp(1 - p * 6).toFixed(3);
      if (hud) hud.style.opacity = clamp(1 - p * 2.5).toFixed(3);
    });

    // Stops decoding the loop once it is out of sight, and resumes only if it was playing.
    const video = hero.querySelector<HTMLVideoElement>('[data-hero-video]');
    if (video) {
      let resume = false;
      new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) {
          resume = !video.paused;
          video.pause();
        } else if (resume) {
          video.play().catch(() => {});
        }
      }).observe(hero);
    }
  }

  // Video carousel: the frame opens outward like a cinema screen.
  if (wide) {
    const view = document.querySelector<HTMLElement>('[data-panel="films"] .carousel__view');
    scrub(view, (top, _b, vh) => [top - vh, top - vh * 0.62], (p) => {
      if (!view) return;
      view.style.clipPath = p >= 0.992 ? '' : `inset(0 ${(16 * (1 - p)).toFixed(2)}% 0 ${(16 * (1 - p)).toFixed(2)}% round ${(22 * (1 - p)).toFixed(1)}px)`;
    });
  }

  // Image carousel: the giant words behind the straight row slide apart as it passes.
  const tiltView = document.querySelector<HTMLElement>('[data-panel="photo"] .carousel__view');
  if (tiltView) {
    const rows = $$('.giant__row', tiltView);
    scrub(tiltView, (top, bottom, vh) => [top - vh, bottom], (p) => {
      rows.forEach((row, i) => {
        row.style.translate = `${((p - 0.5) * (i ? 18 : -18)).toFixed(2)}vw 0`;
      });
    });
  }

  // About: the words light up as they are read. The starting level keeps every word legible (4.5:1 or better).
  const aboutText = document.querySelector<HTMLElement>('.about__text');
  if (aboutText) {
    const words = toWords(aboutText, null, 'm-rw');
    if (words.length) {
      const tail = 7;
      scrub(aboutText, (top, bottom, vh) => [top - vh * 0.86, bottom - vh * 0.5], (p) => {
        words.forEach((word, i) => {
          word.style.opacity = (0.56 + 0.44 * clamp((p * (words.length + tail) - i) / tail)).toFixed(3);
        });
      });
    }
  }

  /* ---------- Frame loop: only runs while something is moving ---------- */

  const head = document.querySelector<HTMLElement>('[data-head]');
  const bar = document.createElement('div');
  bar.className = 'm-bar';
  bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);

  // Only the client film strips react to the scroll. The big type marquee keeps one steady pace: changing a running
  // animation's playbackRate re-syncs it with the compositor each time, which showed as stutter and sudden bursts.
  const tickers = $$('.strip__track').flatMap((track) => track.getAnimations());

  let vh = window.innerHeight;
  let maxScroll = 1;
  let frame = 0;
  // Read once per scroll event, before any rAF callback writes styles; tick() and other scripts use this value.
  // Reading scrollY after a style write forces the browser to recompute styles mid-frame.
  let scrollPos = window.scrollY;
  let lastY = scrollPos;
  let heading = 0;
  let rate = 1;
  let shownRate = 1;

  const layout = () => {
    vh = window.innerHeight;
    maxScroll = Math.max(1, root.scrollHeight - vh);
    const y = (scrollPos = window.scrollY);
    for (const s of scrubs) {
      s.on = s.measure.offsetWidth > 0; // false while filtered out
      if (!s.on) continue;
      const r = s.measure.getBoundingClientRect();
      [s.a, s.b] = s.range(r.top + y, r.bottom + y, vh);
    }
  };

  const tick = () => {
    frame = 0;
    const y = scrollPos;
    const delta = y - lastY;
    lastY = y;
    let moving = false;
    // The curved photo row takes its scroll push from here instead of reading the scroll position itself.
    if (delta) document.dispatchEvent(new CustomEvent('mn:scroll', { detail: delta }));

    for (const s of scrubs) {
      if (!s.on) continue;
      const target = clamp((y - s.a) / (s.b - s.a || 1));
      s.now = s.now < 0 ? target : s.now + (target - s.now) * 0.14;
      if (Math.abs(target - s.now) < 0.0006) s.now = target;
      else moving = true;
      if (s.now !== s.shown) {
        s.shown = s.now;
        s.apply(s.now);
      }
    }

    bar.style.transform = `scaleX(${clamp(y / maxScroll).toFixed(4)})`;

    // Film strips speed up with the scroll and ease back to their resting pace.
    const wanted = 1 + Math.min(Math.abs(delta) * 0.22, 7);
    rate += (wanted - rate) * (wanted > rate ? 0.3 : 0.06);
    if (rate - 1 < 0.01) rate = 1;
    else moving = true;
    if (Math.abs(rate - shownRate) > 0.1 || (rate === 1 && shownRate !== 1)) {
      shownRate = rate;
      tickers.forEach((animation) => (animation.playbackRate = rate));
    }

    if (head) {
      if (delta > 0) heading = Math.max(0, heading) + delta;
      else if (delta < 0) heading = Math.min(0, heading) + delta;
      if (y < vh * 0.5 || heading < -12) head.classList.remove('m-hide');
      else if (heading > 24) head.classList.add('m-hide');
    }

    if (moving) request();
  };

  const request = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  layout();
  tick();
  window.addEventListener('scroll', () => {
    scrollPos = window.scrollY;
    request();
  }, { passive: true });

  let relayout = 0;
  const later = () => {
    cancelAnimationFrame(relayout);
    relayout = requestAnimationFrame(() => {
      layout();
      request();
    });
  };
  window.addEventListener('resize', later, { passive: true });
  new ResizeObserver(later).observe(document.body);
}
