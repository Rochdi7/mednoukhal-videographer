// Films page: the reel at the top loops muted while it is on screen, and every other film plays a muted preview
// inside its frame while the mouse rests on it. Data saver, slow connections and reduced motion keep the posters.
const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
const lean = !!net?.saveData || /2g|3g/.test(net?.effectiveType ?? '');
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const previewFor = (card: HTMLElement) => {
  let video = card.querySelector<HTMLVideoElement>('.film__preview');
  if (!video) {
    video = document.createElement('video');
    video.className = 'film__preview';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('aria-hidden', 'true');
    video.src = (JSON.parse(card.dataset.film!) as { src: string }).src;
    video.addEventListener('playing', () => card.classList.add('is-previewing'));
    video.addEventListener('pause', () => card.classList.remove('is-previewing'));
    card.querySelector('.film__frame')!.prepend(video);
  }
  return video;
};

if (!lean && !calm) {
  const reel = document.querySelector<HTMLElement>('.film--feature');
  if (reel) {
    let visible = false;
    const sync = () => {
      if (visible && !document.querySelector('[data-theater][open]')) previewFor(reel).play().catch(() => {});
      else reel.querySelector('video')?.pause();
    };
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.35 },
    ).observe(reel);
    // The theater pauses every preview while a film plays with sound; pick the reel back up when it closes.
    document.querySelector('[data-theater]')?.addEventListener('close', sync);
  }

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll<HTMLElement>('.film-grid .film:not(.film--feature)').forEach((card) => {
      let timer = 0;
      card.addEventListener('pointerenter', () => {
        timer = window.setTimeout(() => previewFor(card).play().catch(() => {}), 160);
      });
      card.addEventListener('pointerleave', () => {
        clearTimeout(timer);
        card.querySelector('video')?.pause();
      });
    });
  }
}
