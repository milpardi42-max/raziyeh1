# Artist directory and dedicated profiles

## Interface
- Replaced the crowded directory, duplicate card variants, service modals and hardcoded plan pitches with a concise bilingual introduction, one searchable/filterable directory, and a join-artists invitation.
- Reused a single `ArtistCard` on the directory and existing home sections. Cards have one cover, one work-preview image, avatar, name, specialty, location, short biography and recorded work counts. One semantic link opens the artist's dedicated URL; no nested buttons, mock following state or profile modal.
- Equal-height cards, fixed image ratios and clamped text create aligned rows. Responsive grid: one column on phones, two on tablets, three on desktop. Image-less profiles retain the same layout with explicit empty states.
- Search handles Persian/Arabic letter variants, names, specialties and cities. Filters include discipline and declared commission availability; sorting supports directory order, portfolio count and name. Clear-filters and empty-results states are included.

## Routes
- `/[locale]/artists/[slug]` remains a real dynamic route, now with a redesigned profile header, biography, work counts, social links and populated content tabs. It supports direct links, reloads and browser history. Newly published artist records use the same route automatically; no manually generated page file is needed.
- `/[locale]/artists/[slug]/inquiry` is a new independent page. Service links can preselect `?service=<id>`. Success and failure are inline, not modal. A failed request preserves form data. No promised response deadlines or invented quality guarantees.
- Public directory/profile/inquiry routes exclude pending and rejected artists. Invalid artist slugs use Next.js `notFound()` (a not-found screen and noindex; streamed responses may carry HTTP 200).
- Public artist projections omit client inquiries and private registration/account fields. Inquiry API validates the exact public artist and active service, derives the service title server-side, and never falls back to a different artist.

## Verification
- `node --test tests/*.test.mjs`: 9 passing tests, including prior statistics regressions.
- `npm run check`: no errors; existing repository warnings remain.
- `npm run build`: production build completed successfully.
- Browser checks (Chromium): equal card dimensions at 1440px, card-to-profile navigation, no profile dialog, search/empty/reset flow, English inquiry form failure retaining values, and no horizontal overflow at 390px. No browser page errors in this flow.
- Browser tooling/screenshots were kept outside the repository, with no new application dependency.

## Portfolio isolation follow-up
- Restored the public portfolio introduction/component/profile copy to its original repository version, removing the session's new dynamic founder-statistics content on `/portfolio` only.
- Added `/[locale]/artists/[slug]/portfolio` and `/[locale]/artists/[slug]/portfolio/[workSlug]`. Profile work cards, related works, breadcrumbs and back links remain in the same artist's space. Artist work pages do not import or render the studio portfolio page or founder introduction.
- Artist submissions carry `showcase: "artist"`; pre-existing self-service records with a publishing status are also treated as artist works. They do not enter the studio gallery, its detail URLs, homepage portfolio rails or the studio search index. The sitemap includes separate artist-work URLs.
- Legacy CMS gallery records are preserved, including their existing authorship; the artist can showcase their own legacy work without moving or deleting the studio original. Private drafts and review/rejected submissions are not public.
- The public portfolio intro intentionally uses its previous content again as requested. The prior statistics report's dynamic `/portfolio` founder-counter description is superseded by this restoration; `/razieh` remains unchanged.
- Added four isolation/restoration tests (13 total passing). No persisted content was deleted or migrated.
