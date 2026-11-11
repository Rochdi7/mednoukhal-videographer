// Plays a film in a full-screen dialog with sound. Links stay real, so this only enhances them.
interface FilmData { src: string; title: string; href: string; width: number; height: number }

const dialog = document.querySelector<HTMLDialogElement>('[data-theater]');

if (dialog) {
  const video = dialog.querySelector<HTMLVideoElement>('[data-theater-video]')!;
  const title = dialog.querySelector<HTMLElement>('[data-theater-title]')!;
  const link = dialog.querySelector<HTMLAnchorElement>('[data-theater-link]')!;
  const triggers = [...document.querySelectorAll<HTMLElement>('[data-film]')];
  const films = triggers.map((t) => JSON.parse(t.dataset.film!) as FilmData);
  let index = 0;

  const load = (film: FilmData) => {
    video.src = film.src;
    video.width = film.width;
    video.height = film.height;
    title.textContent = film.title;
    link.href = film.href;
    video.play().catch(() => {});
  };

  const step = (delta: number) => {
    index = (index + delta + films.length) % films.length;
    load(films[index]);
  };

  triggers.forEach((trigger, i) => {
    trigger.addEventListener('click', (event) => {
      const e = event as MouseEvent;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      index = i;
      // Hand over from any muted carousel preview so two films never play together.
      document.querySelectorAll<HTMLVideoElement>('.tile__video').forEach((preview) => preview.pause());
      dialog.showModal();
      load(films[index]);
    });
  });

  dialog.querySelector('[data-theater-close]')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-theater-prev]')!.addEventListener('click', () => step(-1));
  dialog.querySelector('[data-theater-next]')!.addEventListener('click', () => step(1));

  // Stop playback and the download when the dialog closes, then let the preview carry on.
  dialog.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    document.querySelectorAll<HTMLElement>('.tile.is-active video').forEach((preview) => (preview as HTMLVideoElement).play().catch(() => {}));
  });
}
