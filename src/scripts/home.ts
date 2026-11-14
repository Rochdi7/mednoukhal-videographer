// Homepage behaviour: hero loop, portfolio filter and carousels.
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollMode: ScrollBehavior = calm ? 'auto' : 'smooth';
// Data saver or a slow connection: no video starts on its own (hero loop, film previews).
// Each one can still be played on request.
const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
const lean = !!net?.saveData || /2g|3g/.test(net?.effectiveType ?? '');

// --- Hero: the loop starts after the page has loaded, then fades in over the matching still ---
const hero = document.querySelector<HTMLVideoElement>('[data-hero-video]');
if (hero) {
  hero.addEventListener('playing', () => hero.classList.add('is-on'), { once: true });
  // Always loops (muted, no controls); it just waits for the load event so it never competes with the first paint.
  const start = () => hero.play().catch(() => {});
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
  // If the browser refuses to play (e.g. low-power mode), the REC light stops blinking over the still.
  const hud = document.querySelector<HTMLElement>('[data-hero-hud]');
  const sync = () => hud?.classList.toggle('is-paused', hero.paused);
  hero.addEventListener('play', sync);
  hero.addEventListener('pause', sync);

  // Several films (set in the dashboard): each plays to its end, then the next one fades in, round and round.
  // Phones held upright get a film's portrait version when it has one.
  const playlist = JSON.parse(hero.dataset.heroPlaylist ?? '[]') as { src: string; srcMobile?: string }[];
  if (playlist.length > 1) {
    const portrait = window.matchMedia('(max-width: 700px) and (orientation: portrait)');
    let index = 0;
    hero.addEventListener('ended', () => {
      index = (index + 1) % playlist.length;
      const film = playlist[index];
      hero.classList.add('is-switching');
      window.setTimeout(() => {
        hero.src = portrait.matches && film.srcMobile ? film.srcMobile : film.src;
        hero.play().catch(() => {});
      }, 350);
    });
    hero.addEventListener('playing', () => hero.classList.remove('is-switching'));
  }
}

// --- Hero viewfinder: the timecode follows the clip (HH:MM:SS:FF at 25 fps) and freezes when it pauses ---
const timecode = document.querySelector<HTMLElement>('[data-hero-tc]');
if (hero && timecode) {
  const FPS = 25;
  const pad = (n: number) => String(n).padStart(2, '0');
  let shown = -1;
  let ticking = false;
  const draw = () => {
    const t = hero.currentTime;
    const frame = Math.floor(t * FPS);
    if (frame !== shown) {
      shown = frame;
      timecode.textContent = `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(Math.floor(t) % 60)}:${pad(frame % FPS)}`;
    }
    ticking = !hero.paused;
    if (ticking) requestAnimationFrame(draw);
  };
  const run = () => {
    if (!ticking) draw();
  };
  hero.addEventListener('playing', run);
  hero.addEventListener('seeked', run);
  if (!hero.paused) run();
}

// --- Filter ---
const filters = document.querySelectorAll<HTMLButtonElement>('[data-filter]');
const panels = document.querySelectorAll<HTMLElement>('[data-panel]');
filters.forEach((button) => {
  button.addEventListener('click', () => {
    const value = button.dataset.filter;
    filters.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    panels.forEach((panel) => {
      panel.hidden = value !== 'all' && panel.dataset.panel !== value;
    });
  });
});

// --- Carousels ---
const moveTo = (track: HTMLElement, tile: HTMLElement, behavior: ScrollBehavior = scrollMode) => {
  const x = tile.offsetLeft - (track.clientWidth - tile.offsetWidth) / 2;
  track.scrollTo({ left: x, behavior }); // also correct in RTL, where offsetLeft and scrollLeft are both negative
};

const nearestIndex = (track: HTMLElement, tiles: HTMLElement[]) => {
  const box = track.getBoundingClientRect();
  const middle = box.left + box.width / 2;
  let best = 0;
  let distance = Infinity;
  tiles.forEach((tile, i) => {
    const r = tile.getBoundingClientRect();
    const d = Math.abs(r.left + r.width / 2 - middle);
    if (d < distance) {
      distance = d;
      best = i;
    }
  });
  return best;
};

document.querySelectorAll<HTMLElement>('[data-carousel]').forEach((carousel) => {
  const track = carousel.querySelector<HTMLElement>('[data-track]')!;
  const tiles = [...track.querySelectorAll<HTMLElement>('.tile')];
  // Strip mode (film row, desktop with a mouse): no scrolling; `current` is the wide film and the CSS animates the widths.
  let strip = false;
  let current = 0;
  let onSelect = () => {};
  const index = () => (strip ? current : nearestIndex(track, tiles));
  const layout = () => {
    const first = Math.max(0, Math.min(current - 1, tiles.length - 3));
    tiles.forEach((tile, i) => {
      const shown = i >= first && i < first + 3;
      tile.classList.toggle('is-main', i === current);
      tile.classList.toggle('is-near', shown && i !== current);
      tile.classList.toggle('is-lead', i === first);
    });
  };
  const select = (i: number) => {
    if (strip) {
      current = i;
      layout();
      onSelect();
    } else {
      moveTo(track, tiles[i]);
    }
  };
  const step = (delta: number) => select((index() + delta + tiles.length) % tiles.length);
  carousel.querySelector('[data-prev]')?.addEventListener('click', () => step(-1));
  carousel.querySelector('[data-next]')?.addEventListener('click', () => step(1));

  // The tilted image row opens mid-sequence, so photos fill both edges, and can be pulled with the mouse.
  if (carousel.hasAttribute('data-drag')) {
    moveTo(track, tiles[Math.min(2, tiles.length - 1)], 'auto');
    let down = false;
    let moved = false;
    let startX = 0;
    let startScroll = 0;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true;
      moved = false;
      startX = e.clientX;
      startScroll = track.scrollLeft;
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 6) {
        moved = true;
        track.classList.add('is-dragging');
      }
      if (moved) track.scrollLeft = startScroll - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (moved) {
        const nearest = tiles[nearestIndex(track, tiles)];
        track.classList.remove('is-dragging');
        moveTo(track, nearest);
      }
    });
    // A drag must not open the album when the button is released over a photo.
    track.addEventListener(
      'click',
      (e) => {
        if (!moved) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        moved = false;
      },
      true,
    );
    track.addEventListener('dragstart', (e) => e.preventDefault());
  }

  // Only the video carousel plays. A single tile runs at a time, so the page never loads every film.
  if (!carousel.hasAttribute('data-autoplay')) return;

  // Film strip: hovering (or tabbing to) a side film makes it the wide one. A short delay keeps a mouse passing over from
  // flipping it. It reacts to real mouse movement only, and waits out the resize: otherwise the tile that slides under a
  // resting cursor would take over too, and the row would run on to the end by itself.
  const stripQuery = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 861px)');
  let hoverTimer = 0;
  let lockedUntil = 0;
  const pick = (i: number) => {
    lockedUntil = performance.now() + 950;
    select(i);
  };
  tiles.forEach((tile, i) => {
    tile.addEventListener('pointermove', (e) => {
      if (!strip || e.pointerType !== 'mouse' || i === current || hoverTimer || performance.now() < lockedUntil) return;
      hoverTimer = window.setTimeout(() => {
        hoverTimer = 0;
        if (tile.matches(':hover')) pick(i);
      }, 130);
    });
    tile.addEventListener('pointerleave', () => {
      clearTimeout(hoverTimer);
      hoverTimer = 0;
    });
    tile.addEventListener('focusin', () => {
      if (strip && i !== current) select(i);
    });
  });
  const applyMode = () => {
    const was = strip;
    strip = stripQuery.matches;
    if (strip === was) return;
    if (strip) {
      current = nearestIndex(track, tiles);
      track.scrollLeft = 0;
      layout();
    } else {
      tiles.forEach((tile) => tile.classList.remove('is-main', 'is-near', 'is-lead'));
    }
    carousel.classList.toggle('is-strip', strip);
    if (!strip) moveTo(track, tiles[current], 'auto');
    refresh();
  };

  let active: HTMLElement | null = null;
  let inView = false;

  const soundButton = (tile: HTMLElement) => tile.querySelector<HTMLButtonElement>('[data-sound]')!;
  const setSoundUi = (button: HTMLButtonElement, on: boolean) => {
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-label', (on ? button.dataset.off : button.dataset.on) ?? '');
  };

  const videoFor = (tile: HTMLElement) => {
    let video = tile.querySelector('video');
    if (!video) {
      video = document.createElement('video');
      video.className = 'tile__video';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('aria-hidden', 'true');
      video.src = tile.dataset.src!;
      video.addEventListener('ended', () => step(1));
      tile.querySelector('.tile__open')!.append(video);
    }
    return video;
  };

  const stop = (tile: HTMLElement | null) => {
    if (!tile) return;
    tile.classList.remove('is-active');
    const video = tile.querySelector('video');
    if (video) {
      video.pause();
      video.muted = true;
    }
    setSoundUi(soundButton(tile), false);
  };

  const refresh = () => {
    const next = inView && !carousel.hidden ? tiles[index()] : null;
    if (next !== active) {
      stop(active);
      active = next;
    }
    if (active && !lean) {
      active.classList.add('is-active');
      videoFor(active).play().catch(() => {});
    }
  };

  new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      refresh();
    },
    { threshold: 0.35 },
  ).observe(track);

  let timer = 0;
  track.addEventListener(
    'scroll',
    () => {
      clearTimeout(timer);
      timer = window.setTimeout(refresh, 140);
    },
    { passive: true },
  );

  onSelect = refresh;
  applyMode();
  stripQuery.addEventListener('change', applyMode);

  tiles.forEach((tile) => {
    const button = soundButton(tile);
    button.addEventListener('click', () => {
      const video = tile.querySelector('video');
      if (!video) return;
      video.muted = !video.muted;
      setSoundUi(button, !video.muted);
    });
  });
});
