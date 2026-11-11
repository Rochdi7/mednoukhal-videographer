# Media inventory

All media below comes from chadifilms.com and is by Chadi Films, used with permission. Masters are in `media-source/`, which is not deployed. The Chadifilms mirror was not modified.

## Videos

| Original (`projets/` unless noted) | Dimensions | Duration | Master size | Orientation | Audio | Web file (`public/media/videos/`) | Treatment |
|---|---|---|---|---|---|---|---|
| `website-video.mp4` (site root) | 1920×1080 | 5:56 | 160.5 MB | Landscape | AAC | `showreel.mp4` | Remuxed, quality unchanged, fast start |
| `website-video.mp4`, 99.6–114.2 s | 1920×1080 | 0:15 | n/a | Landscape | None | `hero-1080.mp4` (3.1 MB) | Hero loop |
| `website-video.mp4`, 99.6–114.2 s | 608×1080 centre crop, scaled to 720 wide | 0:15 | n/a | Portrait | None | `hero-portrait.mp4` (0.9 MB) | Mobile hero loop |
| `video-1.mp4` | 2880×2160 | 0:32 | 53.1 MB | Landscape 4:3 | AAC | `maghrebti.mp4` (37.0 MB) | Encoded to 1920×1440, CRF 20 |
| `video-2.mp4` | 3840×2160 | 1:39 | 46.6 MB | Landscape, letterbox baked in | AAC | `motorcycle-at-night.mp4` (21.2 MB) | Encoded to 1920×1080, CRF 20 |
| `video-3.mp4` | 2880×2160 | 0:59 | 67.1 MB | Landscape 4:3 | AAC | `cafe-scene.mp4` (32.0 MB) | Encoded to 1920×1440, CRF 21 |
| `video-4.mp4` | 1920×1080 | 1:01 | 17.7 MB | Landscape | AAC | `alfa-romeo-at-dusk.mp4` | Remuxed |
| `video-5.mp4` | 1280×720 | 1:22 | 12.1 MB | Landscape | AAC | `champions-fitness-gym.mp4` | Remuxed |
| `video-6.mp4` | 1280×720 | 0:39 | 4.0 MB | Landscape | AAC | `residence-tour.mp4` | Remuxed |
| `video-7.mp4` | 2160×3840 | 2:23 | 180.6 MB | Portrait | AAC | `protech-interview.mp4` (43.1 MB) | Encoded to 1080×1920, CRF 22 |
| `video-8.mp4` | 1920×1080 | 3:37 | 145.1 MB | Landscape | PCM | `mobilia-triangle-dor.mp4` (92.2 MB) | Video stream copied, PCM audio converted to AAC |
| `coaching-video.mp4` | 1920×1080 | 4:46 | 177.3 MB | Landscape | AAC | `coaching-film.mp4` (107.2 MB) | Encoded, CRF 23 |
| `video-9.mp4` | n/a | n/a | n/a | n/a | n/a | n/a | Referenced by the page, but returns 404 on the server |

No poster images exist for any video in the original. Posters were captured from each film and stored in `src/assets/films/`, with baked-in letterbox and pillarbox bars removed from the still.

## Photographs (19)

`photo-11` returns 404 and is not referenced by the page. No duplicates were found (SHA-1 compared).

| Original | Dimensions | Size | Web source (`src/assets/photos/`) | Album |
|---|---|---|---|---|
| `photo-1.jpg` | 1170×1462 | 252 KB | `shoreline-01.jpg` | Shoreline |
| `photo-6.jpg` | 1170×1462 | 224 KB | `shoreline-02.jpg` | Shoreline |
| `photo-9.jpg` | 1170×1555 | 178 KB | `shoreline-03.jpg` | Shoreline |
| `photo-10.jpg` | 1170×1555 | 382 KB | `shoreline-04.jpg` | Shoreline |
| `photo-3.jpg` | 1170×1555 | 102 KB | `caftan-01.jpg` | Caftan |
| `photo-13.jpg` | 1170×1559 | 262 KB | `caftan-02.jpg` | Caftan |
| `photo-14.jpg` | 1170×1555 | 117 KB | `caftan-03.jpg` | Caftan |
| `photo-15.jpg` | 1170×1555 | 124 KB | `caftan-04.jpg` | Caftan |
| `photo-4.jpg` | 960×1200 | 133 KB | `caftan-05.jpg` | Caftan |
| `photo-2.jpg` | 1170×1555 | 98 KB | `studio-01.jpg` | Studio |
| `photo-7.jpg` | 1170×1555 | 88 KB | `studio-02.jpg` | Studio |
| `photo-12.jpg` | 1600×2133 | 863 KB | `automotive-01.jpg` | Automotive |
| `photo-19.jpg` | 1600×2133 | 728 KB | `automotive-02.jpg` | Automotive |
| `photo-20.jpg` | 1600×2133 | 428 KB | `automotive-03.jpg` | Automotive |
| `photo-5.jpg` | 1600×2133 | 231 KB | `automotive-04.jpg` | Automotive |
| `photo-8.jpg` | 1600×1200 | 185 KB | `automotive-05.jpg` | Automotive |
| `photo-16.jpg` | 1600×2133 | 218 KB | `automotive-06.jpg` | Automotive |
| `photo-17.jpg` | 1600×2133 | 226 KB | `macarina-sweets-01.jpg` | Macarina Sweets |
| `photo-18.png` | 1600×2133 | 2.6 MB | `macarina-sweets-02.jpg` | Macarina Sweets (PNG flattened to JPEG q95) |

Astro and Sharp generate AVIF and WebP at build time.

## Other images

| Original | Dimensions | Web source | Note |
|---|---|---|---|
| `clients/client-1.png` | 225×225 | `spa-for-cars.png` | Opaque black background |
| `clients/client-2.png` | 321×228 | `serenity-dental-care.png` | Transparent |
| `clients/client-3.png` | 269×195 | `champions-fitness-gym.png` | Transparent, white logo |
| `clients/client-4.png` | 360×243 | `mezzo-mezzo.png` | Transparent |
| `clients/client-5.png` | 496×493 | `mobilia-triangle-dor.png` | Transparent |
| `logo.png` | 533×468 | Not used on the site | Chadi Films' logo. Kept in `media-source/branding/` only, as it does not belong to Mednoukhal |
| 5 YouTube thumbnails | 480×360 | `src/assets/advice/` | Fetched from `i.ytimg.com` so no YouTube request is made until a visitor presses play |

## Section mapping

| Original section | Assets | New location |
|---|---|---|
| Hero | `website-video.mp4` | Home hero (loop), `/films/showreel/` (full) |
| Showcase, Films & Commercials | `video-1` to `video-8` | Home showcase, `/films/`, 8 film pages |
| Showcase, Luxury Photography | 19 photographs | Home strip, `/photography/` |
| Trusted By | 5 client logos | Home, labelled as Chadi Films' clients |
| Book A Session | `coaching-video.mp4` | Home booking, `/coaching/` |
| Advices | 5 YouTube videos | `/advice/` |
