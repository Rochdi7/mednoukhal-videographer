# Implementation plan

## Target project audit

`C:\Users\ASUS\Desktop\Projects\mednoukhal` was an empty directory: no framework, dependencies, routes, Git repository or existing behaviour to preserve. Astro was therefore a fresh install, not a migration.

| Item | Decision |
|---|---|
| Framework | Astro 7, `output: 'static'` |
| Package manager | npm |
| Build | `npm run build`, deployable output in `dist/` |
| Hosting | Hostinger shared hosting. Static files plus one PHP form endpoint |
| Git | Not initialised. No commit, push or deploy without explicit permission |

## Design direction

The first version used an original editorial identity, which the owner rejected on 2026-11-09. The structure now follows chadifilms.com (centred logo, full-screen hero, video and image carousels, logo marquee, six service cards, centred booking film), with the owner's own identity on top, added later the same day:

- **Logo:** the MN Visual mark (play triangle with film strip) in the header and the full lockup in the hero and footer. Chadi's logo is not used.
- **Type:** LEMON MILK Medium for headings, buttons and navigation, LEMON MILK Light for eyebrows, labels and the ticker, Inter for paragraphs and form fields, IBM Plex Sans Arabic as the Arabic fallback. All self-hosted WOFF2, subset to Latin.
- **Palette:** black and white from the logo with one electric cyan accent (`#22D3EE` fills with black text, `#67E8F9` for text on black), replacing the original's red.
- **Closing section:** a dark band above the footer with a curved photo row that moves by itself (speed and curve measured from the owner's reference recording), handwritten notes in Mr Dafoe (self-hosted) and a pill button to the project form.
- **Touches beyond the original:** film grain over the page, a sprocket-hole ticker of the services after the hero and before the footer, a logo reveal with an animated rule, a full-bleed tilted image carousel with rounded photos, mouse dragging and giant text moving behind it, a "playing" indicator on the live carousel tile, a cursor spotlight on the service cards, numbered cards, and a white slide fill on buttons.

## Routes (each in EN at `/`, FR at `/fr/`, AR at `/ar/` with RTL)

| Route | Replaces |
|---|---|
| `/` | The one-page original: hero, showcase, clients, about, expertise, booking |
| `/films/`, `/films/[slug]/` | Video tiles in the showcase |
| `/photography/` | Photo tiles in the showcase |
| `/advice/` | Advices overlay |
| `/coaching/` | Booking section, coaching and consultation modals |
| `/contact/` | Project and photoshoot modals, footer contact |

## Attribution model

Mednoukhal is the site owner. The work shown is by Chadi Films and used with permission. This is stated on the hero, every film, every lightbox caption, the about section, the footer and in structured data (`creator`, `creditText`).

## Details that do not exist yet

No bio, contact details, logo or domain were supplied for Mednoukhal, and none are invented. All of them live in `src/config/site.ts`. Contact channels render only when filled in, and the form endpoint reports "not configured" until a recipient is set in `public/api/config.php`.

## Animation

GSAP is not used. `src/scripts/motion.ts` is a small dependency-free scroll engine: one-shot reveals (IntersectionObserver and the Web Animations API) and scrollbar-linked scrubs, smoothed in one frame loop that only runs while something is moving. Each section has its own treatment: hero zoom and fade to black, ticker speed tied to scroll, masked word reveals on headings, a video carousel that opens like a cinema screen, a tilt that swings through the image carousel, a read-along about paragraph, service cards tipping up, a booking film that pushes in, self-drawing arrows, photographs that wipe open, a hide-on-scroll header and a progress line. `prefers-reduced-motion` turns all of it off.

## Media

Masters stay in `media-source/`, which is not deployed. `npm run media` builds the deliverables. Photos and posters go to `src/assets/` rather than `public/media/` so Astro and Sharp can generate AVIF, WebP and responsive sizes.
