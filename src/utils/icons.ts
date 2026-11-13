// Brand line icons drawn in the same style as Lucide (24 grid, 1.5 stroke), since Lucide ships no brand logos.
// Returned as SVG markup for <Fragment set:html={brandIcon('instagram')} />.
const PATHS: Record<string, string> = {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none"/>',
  youtube: '<path d="M2.6 7.6a2.9 2.9 0 0 1 2.5-2.5C7.3 4.8 9.6 4.7 12 4.7s4.7.1 6.9.4a2.9 2.9 0 0 1 2.5 2.5c.2 1.5.3 2.9.3 4.4s-.1 2.9-.3 4.4a2.9 2.9 0 0 1-2.5 2.5c-2.2.3-4.5.4-6.9.4s-4.7-.1-6.9-.4a2.9 2.9 0 0 1-2.5-2.5C2.4 14.9 2.3 13.5 2.3 12s.1-2.9.3-4.4Z"/><path d="M10 9.2v5.6l4.8-2.8Z" fill="currentColor"/>',
  threads: '<path d="M18.6 7.4C17.3 4.9 15 3.5 12 3.5 7.1 3.5 4 6.9 4 12s3.1 8.5 8 8.5c3.9 0 6.6-2.2 6.6-5.3 0-2.6-2-4.1-5-4.1-2.4 0-3.9 1.2-3.9 2.8 0 1.4 1.1 2.4 2.7 2.4 2.4 0 3.6-2 3.6-4.6 0-3-1.5-4.6-4-4.6-1.5 0-2.7.6-3.4 1.6"/>',
  whatsapp: '<path d="M3.6 20.4 4.9 16A8.6 8.6 0 1 1 8 19.1Z"/><path d="M9 8.6c.2-.4.5-.5.8-.5h.4c.2 0 .3.1.4.3l.6 1.4c.1.2 0 .4-.1.6l-.5.6c.6 1.1 1.4 1.9 2.5 2.5l.6-.5c.2-.1.4-.2.6-.1l1.4.6c.2.1.3.2.3.4v.4c0 .3-.1.6-.5.8-.5.3-1.2.4-1.8.2-2.2-.7-4-2.5-4.7-4.7-.2-.6-.1-1.3.2-1.8Z" fill="currentColor" stroke="none"/>',
};

export const brandIcon = (name: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? PATHS.instagram}</svg>`;
