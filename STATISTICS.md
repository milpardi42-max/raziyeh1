# Statistics sources and definitions

- Home / About: exact CMS pattern and artist counts; projects are portfolios with `isProject`. No multipliers, lower-bound `+` signs or off-site activity estimates.
- Artist-directory hero: counts from the entire published directory, not the currently filtered cards. Patterns, portfolios and products count records belonging to those artists.
- Founder profile (`/portfolio`, `/razieh`): records belonging to `artist-razieh-khairipour`; participants are unique normalized emails with non-cancelled reservations for that instructor's published academy items. These are site registrations, not graduates or lifetime students. Unverifiable exhibition/experience counters are no longer displayed.
- Shop hero already aggregates products, families and colourways from the catalogue. Academy uses published content and reservations; deleted-item reservations and case/whitespace email duplicates no longer inflate its overview.
- Artist ratings, followers and generated testimonials have no persisted review/follow source. Legacy CMS numbers are retained in storage but no longer presented as measured activity or editable analytics. New artist accounts begin without ratings/reviews. Implement a persisted, authenticated review/follow workflow before exposing these metrics again.
- Admin shop dashboard: sums only confirmed, shipped and delivered orders. Pending/cancelled orders remain in order counts and status distribution, but not accepted order value. The shop has no payment-confirmation ledger, so the UI explicitly calls this **accepted order value**, not received revenue. Amounts use `total.fa` (toman); the independent marketplace payment analytics are not mixed into this figure.
- Seven-day buckets use Asia/Tehran and order creation dates. The weekly badge sums only those seven days; all-time value remains a separate card. A zero-valued day has no artificial bar height.
- Dashboard request failures are not presented as fresh zero-valued success. Orders/users APIs return 503 on storage failure; missing local files still mean an empty store. Last successfully loaded statistics remain visible with a stale-data warning.

## Important deployment boundary

Counts describe the site's published CMS records; they do not prove that seeded example content represents real-world business activity. This change does not delete or overwrite existing content, connect an external production database, verify biographies, or invent off-site historical figures. Review/replace the repository's initial seed content in the CMS before launch. Existing store configuration and seed fallback behavior are unchanged.

## Verification

```sh
node --test tests/statistics.test.mjs
npm run check
npm run build
```

Tests cover empty data, exact content counts, project classification, accepted/cancelled/pending orders, weekly versus lifetime totals, Tehran midnight boundaries, and founder-scoped unique registration counts.
