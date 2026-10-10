# Studio portfolio hero

A dedicated `PortfolioHero` replaces the generic listing-page hero only on `/[locale]/portfolio`.

- Full-width studio background, dark green overlay, warm gold type/accent colours, responsive two-column editorial composition.
- Framed inline video preview with an explicit play button, native playback controls after play, duration from metadata, and retry/error messaging. No autoplay, modal or unsolicited sound.
- A separate ivory instructor card shows name, profession and the current CMS avatar for `artist-razieh-khairipour`; only these public fields are passed to the hero. The card and introduction CTA link to the existing `#about` section on this page.
- Work CTAs link to `#works`. The existing introduction and portfolio grid remain intact; artist-specific portfolio routes are unchanged.
- Persian RTL and English LTR layouts, keyboard-visible focus, native video controls, and no horizontal overflow at mobile widths.

## Media provenance

- Background: existing `/images/hero/hero-back.webp`.
- Poster: existing `/images/portfolios/pf-process.jpg`.
- Preview: existing `/videos/academy/preview.mp4`, reused as the site's available preview (16.4 seconds). This is not presented as a newly produced instructor introduction.
- Instructor image: existing CMS avatar. In the seed data this is the abstract artwork `/images/education/e01.jpg`, not a verified portrait. A real instructor photo must be uploaded to that profile to replace it; no invented portrait was generated.

## Checks

- `node --test tests/*.test.mjs`: 17 passing tests.
- `npm run check`: TypeScript and ESLint pass (existing warnings remain).
- Chromium: actual MP4 playback advances, native controls appear, no autoplay, FA/EN anchor links work, no horizontal overflow at 390px, no browser page errors in the exercised flow.
