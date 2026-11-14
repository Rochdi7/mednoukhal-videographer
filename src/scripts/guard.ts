// Discourages casual source viewing on the public site: blocks the dev-tools / view-source / save-page shortcuts,
// the right-click menu on everything except links, selected text and form fields, and dragging images or videos out.
// Selecting and copying text (Ctrl+C) and copying links keep working. Off in dev and while the owner is in edit mode.
// Note: this is a deterrent only; anything a browser downloads can still be read by a determined visitor.

function editing(): boolean {
  try {
    return new URLSearchParams(location.search).has('edit') || !!sessionStorage.getItem('mn-edit');
  } catch {
    return false;
  }
}

if (!import.meta.env.DEV && !editing()) {
  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    const blocked =
      key === 'f12' ||
      (mod && e.shiftKey && ['i', 'j', 'c', 'k'].includes(key)) || // dev tools, console, inspect element
      (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(key)) || // same shortcuts on macOS
      (mod && !e.shiftKey && (key === 'u' || key === 's')); // view source, save page
    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.addEventListener('contextmenu', (e) => {
    const target = e.target as Element | null;
    const allowed =
      !!target?.closest('a[href], input, textarea, [contenteditable]') ||
      !!window.getSelection()?.toString().trim();
    if (!allowed) e.preventDefault();
  });

  document.addEventListener('dragstart', (e) => {
    const target = e.target as Element | null;
    if (target?.closest('img, video, picture')) e.preventDefault();
  });
}
