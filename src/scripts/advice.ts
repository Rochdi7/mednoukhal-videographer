// Swaps a thumbnail for the player only when asked, so the video does not load until then.
document.querySelectorAll<HTMLButtonElement>('[data-video]').forEach((button) => {
  button.addEventListener(
    'click',
    () => {
      const video = document.createElement('video');
      video.src = button.dataset.video ?? '';
      video.setAttribute('aria-label', button.dataset.title ?? '');
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      const holder = document.createElement('div');
      holder.className = 'advice-card__frame';
      holder.append(video);
      button.replaceWith(holder);
      video.focus();
    },
    { once: true },
  );
});
