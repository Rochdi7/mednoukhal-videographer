// Album viewer: opens on the selected photograph, with square previews of its whole album below.
const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox]');

if (dialog) {
  const img = dialog.querySelector<HTMLImageElement>('[data-lightbox-img]')!;
  const cap = dialog.querySelector<HTMLElement>('[data-lightbox-cap]')!;
  const count = dialog.querySelector<HTMLElement>('[data-lightbox-count]')!;
  const albumName = dialog.querySelector<HTMLElement>('[data-lightbox-album]')!;
  const stage = dialog.querySelector<HTMLElement>('[data-lightbox-stage]')!;
  const strip = dialog.querySelector<HTMLElement>('[data-lightbox-thumbs]')!;
  const all = [...document.querySelectorAll<HTMLAnchorElement>('[data-photo]')];
  const rtl = document.documentElement.dir === 'rtl';
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const of = dialog.dataset.of;
  let items: HTMLAnchorElement[] = [];
  let thumbs: HTMLButtonElement[] = [];
  let index = 0;

  const show = (i: number, direction = 0) => {
    index = (i + items.length) % items.length;
    const item = items[index];
    const alt = item.querySelector('img')?.alt ?? '';
    img.src = item.href;
    img.alt = alt;
    cap.textContent = alt;
    count.textContent = `${index + 1} ${of} ${items.length}`;
    if (!calm && direction) {
      const offset = direction * (rtl ? -28 : 28);
      img.animate([{ opacity: 0, transform: `translateX(${offset}px)` }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
    }
    thumbs.forEach((thumb, t) => {
      if (t === index) {
        thumb.setAttribute('aria-current', 'true');
        strip.scrollTo({ left: thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2, behavior: calm ? 'auto' : 'smooth' });
      } else {
        thumb.removeAttribute('aria-current');
      }
    });
    new Image().src = items[(index + 1) % items.length].href;
    new Image().src = items[(index - 1 + items.length) % items.length].href;
  };

  const buildThumbs = () => {
    thumbs = items.map((item, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lightbox__thumb';
      button.setAttribute('aria-label', `${dialog.dataset.openLabel} ${i + 1}`);
      const preview = document.createElement('img');
      preview.src = item.dataset.thumb!;
      preview.alt = '';
      preview.width = 68;
      preview.height = 68;
      button.append(preview);
      button.addEventListener('click', () => show(i, Math.sign(i - index)));
      return button;
    });
    strip.replaceChildren(...thumbs);
  };

  all.forEach((item) => {
    item.addEventListener('click', (event) => {
      const e = event as MouseEvent;
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      items = all.filter((other) => other.dataset.album === item.dataset.album);
      albumName.textContent = item.dataset.albumTitle ?? '';
      buildThumbs();
      dialog.showModal();
      show(items.indexOf(item));
    });
  });

  const next = () => show(index + 1, 1);
  const prev = () => show(index - 1, -1);

  dialog.querySelector('[data-lightbox-close]')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-lightbox-next]')!.addEventListener('click', next);
  dialog.querySelector('[data-lightbox-prev]')!.addEventListener('click', prev);

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') (rtl ? prev : next)();
    if (e.key === 'ArrowLeft') (rtl ? next : prev)();
  });

  stage.addEventListener('click', (e) => {
    if (e.target === stage) dialog.close();
  });

  let startX: number | null = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') startX = e.clientX;
  });
  stage.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) < 48) return;
    (rtl ? dx > 0 : dx < 0) ? next() : prev();
  });
  stage.addEventListener('pointercancel', () => {
    startX = null;
  });
}
