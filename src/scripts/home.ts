// Homepage behaviour: hero pause control, portfolio filter, carousels and the booking film.
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollMode: ScrollBehavior = calm ? 'auto' : 'smooth';
// Data saver or a slow connection: no video starts on its own (hero loop, film previews, booking film).
// Each one can still be played on request.
const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
const lean = !!net?.saveData || /2g|3g/.test(net?.effectiveType ?? '');

// --- Hero: the loop starts after the page has loaded, then fades in over the matching still ---
const hero = document.querySelector<HTMLVideoElement>('[data-hero-video]');
const pause = document.querySelector<HTMLButtonElement>('[data-hero-pause]');
if (hero && pause) {
  hero.addEventListener('playing', () => hero.classList.add('is-on'), { once: true });
  // Lean connections keep the still; the play button still starts the loop on request.
  const start = () => {
    if (!lean) hero.play().catch(() => {});
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
  pause.addEventListener('click', () => {
    if (hero.paused) hero.play().catch(() => {});
    else hero.pause();
  });
  const hud = document.querySelector<HTMLElement>('[data-hero-hud]');
  const sync = () => {
    pause.classList.toggle('is-paused', hero.paused);
    hud?.classList.toggle('is-paused', hero.paused);
    pause.setAttribute('aria-label', (hero.paused ? pause.dataset.resume : pause.dataset.pause) ?? '');
  };
  hero.addEventListener('play', sync);
  hero.addEventListener('pause', sync);
  if (lean) sync(); // show the play icon, since nothing is playing
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
  const step = (delta: number) => {
    const i = (nearestIndex(track, tiles) + delta + tiles.length) % tiles.length;
    moveTo(track, tiles[i]);
  };
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
    const next = inView && !carousel.hidden ? tiles[nearestIndex(track, tiles)] : null;
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

// --- Booking film: plays muted while on screen, with a sound toggle ---
const booking = document.querySelector<HTMLElement>('[data-booking-video]');
if (booking && lean) booking.querySelector('[data-booking-sound]')?.setAttribute('hidden', ''); // the poster stays; no video to unmute
if (booking && !lean) {
  const button = booking.querySelector<HTMLButtonElement>('[data-booking-sound]')!;
  const label = button.querySelector('span')!;
  let video: HTMLVideoElement | null = null;

  new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        if (!video) {
          video = document.createElement('video');
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.setAttribute('aria-hidden', 'true');
          video.src = booking.dataset.src!;
          booking.insertBefore(video, button);
        }
        video.play().catch(() => {});
      } else {
        video?.pause();
      }
    },
    { threshold: 0.4 },
  ).observe(booking);

  button.addEventListener('click', () => {
    if (!video) return;
    video.muted = !video.muted;
    button.classList.toggle('is-on', !video.muted);
    label.textContent = (video.muted ? button.dataset.on : button.dataset.off) ?? '';
  });
}
