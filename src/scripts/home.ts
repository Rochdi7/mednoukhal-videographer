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

// --- About badge (Arabic): letters keep their natural shape, so the ring is filled by fitting the font size, never by stretching ---
const ringText = document.querySelector<SVGTextElement>('[data-ring-fit]');
if (ringText) {
  document.fonts.ready.then(() => {
    const ring = 2 * Math.PI * 47 - 4; // the ring path's length, less a hair so the phrase never clips
    const length = ringText.getComputedTextLength();
    const size = parseFloat(getComputedStyle(ringText).fontSize);
    if (length > 0 && size > 0) ringText.style.fontSize = `${Math.min(14, Math.max(9, (size * ring) / length)).toFixed(2)}px`;
  });
}

// --- Services (phones): the dot under the carousel follows the card in view; tapping a dot goes to its card ---
const svcTrack = document.querySelector<HTMLElement>('[data-svc-track]');
const svcDots = [...document.querySelectorAll<HTMLElement>('[data-svc-dots] span')];
if (svcTrack && svcDots.length) {
  const cards = [...svcTrack.children] as HTMLElement[];
  const mark = (index: number) => svcDots.forEach((dot, i) => dot.classList.toggle('is-on', i === index));
  const watch = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && mark(cards.indexOf(e.target as HTMLElement))),
    { root: svcTrack, threshold: 0.6 },
  );
  cards.forEach((card) => watch.observe(card));
  svcDots.forEach((dot, i) => dot.addEventListener('click', () => cards[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })));
}

// --- Filter: the video categories narrow the film carousel (the photo carousel below is never filtered) ---
const filmFilters = [...document.querySelectorAll<HTMLButtonElement>('[data-film-filter] [data-filter]')];
const filmCarousel = document.querySelector<HTMLElement>('[data-panel="films"]');
filmFilters.forEach((button) => {
  button.addEventListener('click', () => {
    const value = button.dataset.filter;
    filmFilters.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    filmCarousel?.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
      tile.hidden = value !== 'all' && tile.dataset.cat !== value;
    });
    filmCarousel?.dispatchEvent(new Event('mn:filter'));
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
  const allTiles = [...track.querySelectorAll<HTMLElement>('.tile')];
  let tiles = allTiles; // the tiles not hidden by the category filter
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
  allTiles.forEach((tile) => {
    tile.addEventListener('pointermove', (e) => {
      const i = tiles.indexOf(tile);
      if (!strip || e.pointerType !== 'mouse' || i < 0 || i === current || hoverTimer || performance.now() < lockedUntil) return;
      hoverTimer = window.setTimeout(() => {
        hoverTimer = 0;
        if (tile.matches(':hover')) pick(tiles.indexOf(tile));
      }, 130);
    });
    tile.addEventListener('pointerleave', () => {
      clearTimeout(hoverTimer);
      hoverTimer = 0;
    });
    tile.addEventListener('focusin', () => {
      const i = tiles.indexOf(tile);
      if (strip && i >= 0 && i !== current) select(i);
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

  // A category was picked: start again from the first film of that category. With fewer than three films the strip centres them.
  carousel.addEventListener('mn:filter', () => {
    tiles = allTiles.filter((tile) => !tile.hidden);
    current = 0;
    carousel.classList.toggle('is-few', tiles.length < 3);
    allTiles.forEach((tile) => tile.classList.remove('is-main', 'is-near', 'is-lead'));
    if (strip) layout();
    else if (tiles[0]) moveTo(track, tiles[0], 'auto');
    refresh();
  });

  allTiles.forEach((tile) => {
    const button = soundButton(tile);
    button.addEventListener('click', () => {
      const video = tile.querySelector('video');
      if (!video) return;
      video.muted = !video.muted;
      setSoundUi(button, !video.muted);
    });
  });
});
