# Design and collection checkpoint — 2026-09-19

Scope: isolated Supabase student trial only. No GAS or production student-data migration.

## Implemented

- Enlarged gold heading, full-width parchment menu cards, reference-based dark French Revolution background.
- Latest menu grouping: basic/connections, beginner, intermediate, advanced; speedrun, baitrun, matching, memory.
- Connections now provides fixed cause/effect explanations and asks for the middle event.
- Reuses original five tier frames, twelve event illustrations and all eight pack designs.
- Grade-specific shiny effects (two each for normal/rare/unique, three for legend/myth).
- Owned-variant representative selection, complete-set/tier celebrations and badges.
- Pack probabilities and pity counters are database-authoritative. Basic inventory is retained;
  other pack inventories start at zero. No free packs or invented completion rewards.
- Additive migration 006 retains login/beginner logic, upgrades legacy trial shinies without losing quantities,
  and keeps all collection tables/functions inaccessible to anonymous and authenticated client roles.
- Read/write transactions use per-student locks and idempotent request receipts. Retried openings cannot reroll.

## Automated validation

Run `HISTORY_TEST_DEPS=/tmp/history-trial-tests.KNp2Lq node --experimental-vm-modules --test tests/*.test.mjs`.
The dependency directory is local tooling, not a deployed dependency.

26 checks pass in a disposable PGlite database plus the real app in jsdom:
login, answer replay, wrong-answer retries, lost responses, reload recovery, double-spend prevention,
eight pack types, three tier ceilings, common myth ceiling, batch atomicity, permission denials,
legacy shiny conversion/repeated migrations, missing-effect priority, owned-only representative selection,
set/tier achievements, acknowledgement, session revocation, practice flows and zero-network card flipping.

This is not a multi-user production load test or proof against automatic answer submission.
The existing beginner is intentionally local-graded; server replay verifies valid submitted answers,
not whether a human learned them. Official ranking remains out of scope.

## Assets and performance

Original PNG files are untouched. Trial-only WebP derivatives:
- Background: 136,244 bytes; four-menu shared art: 508,166 bytes.
- Twelve event pictures, five frames, eight packs: 2,681,488 bytes total.
- Home fetches its background, shared menu art and one 69,414-byte pack image; it does not prefetch the card bank.
- Gallery only renders the selected tier; unowned slots have no picture. Card images load lazily.
- Questions, card flipping, tier navigation and effects do not make database requests.

## Deployment boundary

Apply only `202609190006_trial_collection.sql` in the already-configured test Supabase project.
Expected result: `pack_types=8`, `collection_version=collection-v2`.
No Edge Function change, password, service key or JWT-setting change is required.
Before migration, the deployed frontend keeps the former basic-pack workflow and marks the upgrade pending.

## Still pending

60 question variants, other server-connected games, teacher settings/permissions, mission economy,
card fusion/shards/locks, real student migration, History ① curriculum portal.
Current probabilities use original defaults, not the teacher's individual GAS settings.
No claim that these remaining features are already migrated.
