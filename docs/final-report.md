# Final report: Mednoukhal website

Status on 2026-11-09: built and tested locally. Not deployed, and no Git repository was created.

## Before going live

These details do not exist yet and were not invented.

| Needed | Where it goes | Effect until supplied |
|---|---|---|
| Recipient and sender email | `public/api/config.php` | The form validates but shows "not yet connected to an inbox" |
| Real domain | `astro.config.mjs` or `SITE_URL` at build | Canonicals, sitemap and social tags use the placeholder `https://mednoukhal.com` |
| Email, WhatsApp, phone, socials | `src/config/site.ts` | Those links stay hidden |
| Real bio | `about` in `src/i18n/strings.ts` | A short neutral statement is shown, with no biographical claims |

## Decisions for the site owner

1. **Coaching film.** `coaching-film.mp4` is mostly Chadi speaking to camera, with `www.chadifilms.com` burned into the picture. It is credited, but it now autoplays in the booking section, as on the original, so visitors see Chadi pitching on Mednoukhal's site. It should be replaced by Mednoukhal's own film, or removed.
2. **Coaching and consultation offer.** These sections were kept as requested, but they are Chadi's services. Keep them only if Mednoukhal offers the same. The time slots also come from Chadi's forms. Chadi's prices were not carried over.
3. **Client logos.** Shown under "Brands in this work", labelled as clients of Chadi Films. Those brands did not engage Mednoukhal, so check that Chadi's permission covers this use.
4. **Advice videos.** These are Chadi's YouTube videos, attributed on the page. Two titles speak in the first person about Chadi's own prices and living.
5. **Translations.** The French and Arabic copy has not been reviewed by a native speaker.
6. **Font licence.** LEMON MILK is donationware: its README says commercial use requires a donation to the author at marsnev.com. That is due before launch.
7. **Brand name.** The logo reads "MN Visual" while page titles, the about section and the copyright line say "Mednoukhal". Both are used as supplied. If the public name should be MN Visual everywhere, it is one change in `src/config/site.ts` and `src/i18n/strings.ts`.

## Original site audit

One long page with overlays, in `docs/reference-audit.md`. The media inventory is in `docs/media-inventory.md`. The HTTrack mirror was still running when audited, so the live homepage and direct downloads filled the gaps. The mirror later finished on its own.

## Sections preserved and redesigned

| Original | Now |
|---|---|
| Hero | Full-width autoplaying loop with centred name and two buttons, plus a pause control |
| Cinematic Showcase with filters | Video carousel and a full-bleed tilted image carousel with the same three filters, plus `/films/`, 9 film pages and `/photography/`. Selecting an image opens its album with square previews below |
| Trusted By marquee | Logo marquee with corrected names, credited to Chadi Films |
| About | Rewritten neutrally, with Chadi's first-person bio removed |
| Six services | Six cards linking to pre-selected enquiries |
| Book A Session | Centred film with sound toggle and two buttons, plus `/coaching/` with its form |
| Advices overlay | `/advice/`, loading YouTube only on play |
| Four modal forms | One form with four enquiry types, at `/contact/` and `/coaching/` |
| Client-side EN/FR/AR toggle | Crawlable `/`, `/fr/` and `/ar/` with RTL |

Design: the structure follows chadifilms.com at the owner's request, with the owner's MN Visual logo, LEMON MILK type, a cyan accent in place of the red, and extra touches (film grain, sprocket-hole ticker, logo reveal, spotlight cards, live-tile indicator). See `implementation-plan.md`.

## Media reused

| Type | Count |
|---|---|
| Videos | 10 of 10 available (8 films, showreel, coaching film), plus 2 hero loops cut from the showreel |
| Photographs | 19 of 19 available, in 5 albums |
| Client logos | 5 |
| YouTube videos | 5 |

`video-9` and `photo-11` return 404 on the source server. Film titles use on-screen names where they exist (Maghrebti, Champions Fitness Gym, Mobilia Triangle d'Or) and otherwise plainly describe the footage. Album names and captions also describe what is visible.

Every film and photograph is credited to Chadi Films on the page and in structured data. The build contains none of Chadi's phone, email or first-person bio.

## Technology

Astro 7 static output, custom CSS, Sharp with AVIF and WebP, Lucide icons, self-hosted WOFF2, native `<video>` and `<dialog>`, PHP form endpoint.

GSAP was not added. Every effect worked in CSS, IntersectionObserver or the Web Animations API, in line with the brief's rule. Script is small enough that Astro inlined it, so pages make no separate JavaScript requests.

## SEO

Unique titles and descriptions, canonicals, hreflang (including x-default), Open Graph, Twitter cards, 45-URL sitemap with language alternates, `robots.txt`, breadcrumbs, single H1 per page, and descriptive alt text.

JSON-LD: WebSite, Person, VideoObject, ImageGallery with ImageObject, BreadcrumbList. `uploadDate` uses each file's real server date. ProfessionalService was left out because there is no business address or service area to state yet.

## Performance and Lighthouse

Median of three runs per page on a local server with no compression, so Apache with `.htaccess` should do at least as well.

| Page | Performance | Accessibility | Best Practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| Home, mobile | 93 | 100 | 100 | 100 | 3.2 s | 0 |
| Home, desktop | 99 | 100 | 100 | 100 | 0.8 s | 0 |
| Films, mobile | 96 | 100 | 100 | 100 | 2.7 s | 0 |
| Photography, mobile | 91 | 100 | 100 | 100 | 3.5 s | 0 |
| Contact, mobile | 99 | 100 | 100 | 100 | 2.1 s | 0 |
| Arabic home, mobile | 86 | 100 | 100 | 100 | 3.8 s | 0 |

Scroll animation is built into `src/scripts/motion.ts` with no library. It switches off for visitors who ask for reduced motion, and if it ever fails all content still shows. Performance varies between runs on this machine.

The hero loop (3.1 MB desktop, 0.9 MB phone) starts immediately. In the video carousel only the film in the centre plays, muted, so the page never downloads all of them at once. It stops when scrolled away.

## Testing

Run in Chrome through Playwright against the production build.

| Check | Result |
|---|---|
| 45 pages: console errors, broken images, dead links, H1, metadata, JSON-LD | No issues |
| 8 viewports, 10 routes each (including Arabic): overflow and tap targets | No issues |
| Hero autoplay at full width, filters, film player, next and close | Pass |
| Video carousel: one film autoplays muted, arrows, sound toggle | Pass |
| Image carousel opens the right album with square previews, previews jump to a photo | Pass |
| Lightbox: keyboard, wrap, Escape, touch swipe, RTL arrows | Pass |
| Mobile menu, skip link, reduced motion | Pass |
| Form: pre-selection, validation messages, successful send | Pass |
| PHP endpoint, 12 cases: bad input, whitelist, past date, honeypot, timing trap, cross-origin, header injection, rate limit, not-configured state | Pass |

The restyle with the logo, fonts and cyan accent was followed by a full rerun: every check passed. The only reports were the new ticker strip being wider than the screen, which is by design (it scrolls and is clipped, like the logo marquee), and the test now allows for it.

Build status: passes, 46 pages including the 404.

Screenshots: `docs/screenshots/reference/` and `docs/screenshots/final/`.

**Reference files.** The project only read from the mirror, and the copied originals keep their dates and sizes. The mirror itself changed during the audit because HTTrack was still writing to it.

## Not tested

These need the live host:

- Real email delivery. PHP `mail()` was replaced with a local test file.
- `.htaccess` rules, including the HTTPS redirect and the 404 page. The local server ignores this file.
- Seeking within long videos on Apache. The local server does not support byte-range requests the way Apache does.

## Hostinger deployment

1. Fill in the first table above.
2. Run `npm run build`.
3. Upload the **contents** of `dist/` to `public_html`, including the hidden `.htaccess` (560 MB, 513 files). FTP or a zip extracted in File Manager both work.
4. Enable SSL for the domain in hPanel.
5. Create the sender mailbox on the domain and send a test enquiry.
6. Submit `sitemap-index.xml` in Google Search Console.

No Node.js or database is needed on the server. `media-source/` is about 870 MB of masters and should not be uploaded. Keep it to rebuild the media with `npm run media`.

## Remaining issues

- The largest files are the showreel (160 MB), coaching film (107 MB) and Mobilia film (92 MB). They load only when played, but will use noticeable bandwidth on slow connections.
- The source photos top out at 1600 px wide, so large screens show them near native size.
- There are no captions or subtitles, as none exist in the source.
