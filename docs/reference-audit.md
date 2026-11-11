# Reference audit: chadifilms.com

Audited 2026-11-08. The reference was treated as read-only.

## Source state

The local HTTrack mirror at `C:\Users\ASUS\Desktop\https___www.chadifilms.com_` was incomplete when audited. WinHTTrack (PID 19212) was still running, the root `index.html` was 0 bytes, and the homepage HTML had not been written to disk. The audit therefore used:

- one read-only fetch of the live homepage, saved outside the project
- screenshots of the live page in Chrome at 1440×900, 768×1024 and 390×844, stored in `docs/screenshots/reference/`
- the two completed videos from the mirror, and direct downloads of the rest of the referenced media

The mirror was not modified or interrupted. HTTrack later finished on its own. The file sizes it saved for the videos match the masters used here. It also captured `api/index41b0.json`, a 61-byte status response with no customer data.

## Ownership and permission

The site presents itself as the work of "Chadi" (Chadi Films). Mednoukhal is a separate person. The site owner confirmed on 2026-11-08 that Chadi has given permission for the reuse. This drives four build rules:

1. Every film and photograph is credited to Chadi Films where it appears.
2. Chadi's first-person bio is not attributed to Mednoukhal.
3. Chadi's phone, email and social accounts are not presented as Mednoukhal's.
4. The client logos are labelled as clients of Chadi Films, not of Mednoukhal.

## 1. Pages

There is one URL, `https://www.chadifilms.com/`. Everything else is an in-page anchor, a full-screen overlay or a modal. `robots.txt` returns 404, and there is no sitemap.

## 2. Sections in original order

| # | Section | Anchor | Content |
|---|---|---|---|
| 1 | Navigation | n/a | Home, Services, Portfolio, then a centred logo, then Advices, Coaching, Contact, and an EN/FR/AR switch |
| 2 | Hero | `#home` | Looping video, H1 "CHADI FILMS", "Photography · Videography", CTAs "I Have A Project In Mind" and "Book 1-1 Coaching", scroll hint |
| 3 | The Cinematic Showcase | `#showcase` | Filters (All Works, Films & Commercials, Luxury Photography), horizontal track of 9 video slots and 19 photos |
| 4 | Trusted By | `#clients` | Infinite logo marquee, 5 logos |
| 5 | About | `#about` | Two-paragraph first-person bio |
| 6 | Our Expertise | `#services` | Six services: Advertising, Brand Content, Digital Media, Music Video, Documentary, Luxury Photography |
| 7 | Book A Session | `#booking` | Coaching video with sound toggle, CTAs "1-1 Coaching" and "Book Consultation" |
| 8 | Advices (overlay) | n/a | Five YouTube embeds, opened from the nav |
| 9 | Footer | `#contact` | Wordmark and six icon links |
| 10 | Modals | n/a | Project choice, Start A Project, Book A Photoshoot, 1-1 Coaching, Book Consultation |

## 3 to 5. Media

See `docs/media-inventory.md`.

## 6. Fonts and icons

- Google Fonts via `@import`: Anton, Oswald, Inter, Cormorant Garamond.
- Palette: black `#000`, white, grey `#9b9b9b`, red accent `#e8181c`.
- Icons: hand-written inline SVG in the footer, emoji for sound toggles.

## 7. Animations and interactions

- Hero video autoplays muted and loops.
- Up to 9 showcase videos autoplay at once, muted, and the track advances when one ends.
- Clicking a video enlarges it in place and dims the others. A per-video sound toggle mutes all the others.
- A missing video removes its own tile.
- Client marquee at 26 s linear, infinite.
- Modal and overlay fades, card hover transforms.

## 8. Responsive behaviour

Breakpoints at 860 px and 700 px. Below them, the nav becomes a burger with a slide-in panel, the showcase stays a horizontal scroller, and form rows stack.

## 9. Important content

**Forms.** All four posted to `api/index.php?action=save`, a PHP dashboard not included in the public page.

| Form | Fields |
|---|---|
| Start A Project | Name, email, phone, project type (Advertising, Brand Content, Digital Media, Music Video, Documentary, Other), city (Agadir, Casablanca, Rabat, Marrakech, Tanger, Fès, other), description |
| Book A Photoshoot | Name, email, phone, shoot type (Luxury/Portrait, Product/E-commerce, Event, Other), city, date, slot, message |
| 1-1 Coaching | Name, email, phone, level (Beginner, Intermediate, Expert), message. Hidden price field: 700, 1000 or 1500 DH |
| Book Consultation | Name, email, phone, date, slot, message. Hidden price field: 200 DH |

Slots: 09:00–10:00, 11:00–12:00, 14:00–15:00, 16:00–17:00.

**Contact details (Chadi's, not reused).** WhatsApp and phone +212 663 271 574, contact@chadifilms.com, Instagram, Facebook and YouTube `@Chadi-Films`. Footer location: Agadir, Morocco.

**Translations.** Inline EN/FR/AR dictionary toggled in the browser. The URL does not change, so search engines see only one language.

## Defects found in the original

| Defect | Handling in the rebuild |
|---|---|
| Client logo alt text is mismatched with the images: `client-2` is tagged "Maghreb Detailing" but shows Serenity, `client-3` is tagged "Serenity" but shows Champions, `client-4` is tagged "Mobilia" but shows Mezzo-Mezzo, `client-5` is tagged "Champions" but shows Mobilia | Named from what each logo shows. "Maghreb Detailing" has no logo and is dropped |
| Projects are labelled only "Projet Vidéo 01" and "Shooting Photo 01" | Titled from on-screen text, or described plainly from what is visible |
| Up to 9 videos autoplay, up to about 860 MB of source media | Poster images only, video loads on click |
| No SEO metadata beyond a title | Full SEO layer |
| Forms and buttons rely on `onclick` on `div` elements, and there is no keyboard path for dialogs | Native links, buttons and `<dialog>` |
| Hardcoded French strings in the forms regardless of the selected language | Fully translated forms |

## 10. Features preserved

Trilingual content (now on crawlable URLs), hero loop, portfolio filter, portrait video support, sound control through native player controls, client strip, about, six services, coaching and consultation booking, the advice video library, and all four enquiry paths.
