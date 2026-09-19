# Supabase trial design checkpoint — 2026-09-19

## Implemented

- Reference-based French Revolution home: generated Paris backdrop, illustrated parchment menus,
  gold typography, real student collection/pack counts, recent records and working bottom navigation.
- Beginner quiz: two errors no longer reveal the full answer immediately; each retry round reveals more.
- Connections: twelve events, four groups of three, cause/effect selection and correction.
- Memory challenge: five-second reveal, four historical periods, tap-to-place controls,
  three-second hints and correction. Timer uses wall-clock deadlines, not tick counts.
- Practice modes are explicitly local only and do not grant cards or write server records.
- No SQL or Edge Function changes required for this checkpoint.

## Automated checks

17 checks pass: SQL lifecycle/permissions, normalization/progressive hints, practice state machines,
HTML escaping and real DOM login→quiz→completion→lost-response retry→pack→restoration.
The DOM integration also completes both local practice boards and verifies no additional API calls.
PGlite is a disposable test database; these checks are not a live classroom load test.

## Deployed browser checks

- The deployed design preview loads the new HTML/CSS and both optimized image assets.
- Desktop viewport: 1348px; document scroll width: 1348px (no horizontal overflow).
- Four desktop tiles: approximately 241px × 310px each; inspected actual browser screenshot.
- Narrow iframe viewport: 388px inside a 390px frame; document scroll width: 388px.
  Two-column tiles: approximately 172px × 263px; no horizontal overflow.
- Memory board: four colored era panels and all twelve labeled cards observed in browser.
- Menu changes reset page scroll; answering and countdown re-renders do not reset it.
- Artwork delivery: background 102,958 bytes + shared menu sprite 531,976 bytes.
  No 12-card image-bank prefetch on home.

## Preserved / still pending

Original GAS index.html, teacher.html and history-api are unchanged.
Production student data is not migrated. The 60-variant bank, intermediate/advanced modes,
server rewards for practice modes, teacher permissions/settings, full card economy and
integrated History ① curriculum navigation are subsequent work, not advertised as working here.
