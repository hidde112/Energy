# ENERGYDEX project progress

Updated: 2026-10-08

## Delivered core release

- Next.js 16 / React 19 mobile-first shell with dark/light themes, responsive
  bottom navigation/sidebar, dashboard, offline state, manifest, icons, and service worker.
- Supabase anonymous identity and onboarding with refresh persistence.
- Provenance-aware catalog, barcode validation/search, seed products, and product detail UI.
- Owner-protected collection states, tasting history, and one current rating per product.
- Camera/gallery/manual capture with permission and provider-failure fallbacks.
- Barcode-first Open Food Facts lookup, validated OpenAI vision adapter,
  matching/confidence ranking, caching, and rate limiting.
- Atomic idempotent scan confirmation, provisional products, moderation, and audit logging.
- Deterministic desktop/mobile E2E coverage, pgTAP security coverage, CI, and deployment docs.

## Verification evidence

- Unit/component tests: 97 passing tests across 26 files.
- Database tests: 68 passing pgTAP assertions across 4 files.
- End-to-end tests: 20 Playwright cases across desktop, Pixel 7, and iPhone-sized profiles.
- Formatting, ESLint, strict TypeScript, and production build are required by `npm run verify`.
- Final clean-install verification is recorded in the completing commit/task handoff.

## Configuration required

- A hosted Supabase project with anonymous Auth enabled, migrations applied,
  redirect origins configured, and storage policies verified.
- Vercel environment bindings for the public Supabase URL/key and server-only secrets.
- A server-only OpenAI key and explicit provider retention/budget approval.
- `ENERGYDEX_LIVE_BASE_URL` when running the post-deployment smoke test.

## Blocked external proof

The repository has no hosted Supabase, Vercel, or OpenAI credentials. Therefore
`npm run test:smoke-live` is intentionally blocked—not reported as passing—until
the owner supplies secure environment bindings and a deployment URL.

## Core acceptance audit

1. Guest identity and normalized unique username: implemented; unit, E2E, and DB constraints cover it.
2. Refresh persistence: covered by onboarding, collection, and rating E2E journeys.
3. iPhone-sized, Android-sized, and desktop layouts: responsive Playwright profiles pass without overflow.
4. Installable PWA: manifest, icons, registration, and offline state are implemented and unit-tested.
5. Camera/gallery/manual truthful fallbacks: component and E2E coverage pass.
6. Known barcode avoids vision: orchestration unit tests and barcode E2E path pass.
7. Unknown image uses validated server-side vision candidates: adapter/unit coverage and deterministic E2E pass.
8. Low-confidence output remains provisional/correctable: domain, database, and moderation tests pass.
9. Confirmation adds an explicit collection status atomically: RPC/pgTAP and E2E pass.
10. Tasting history plus one current rating: schema/service/unit and E2E pass.
11. Collection/rating refresh persistence: E2E pass; database ownership/persistence is covered by pgTAP.
12. Cross-user and unauthorized mutation denial: RLS/RPC pgTAP plus E2E ownership denial pass.
13. Missing configuration is explicit and secrets stay server-side: env tests, setup page, and client-bundle scan pass.
14. Required automated gates and production build: `npm run verify` passes from a clean install.
15. Setup, migration, deployment, pipeline, progress, and limitations: documented in the repository.

## Later delivery units

Account recovery/upgrades, multi-device session management, profile-photo UI,
passkeys and app lock, friends/feeds/groups/comments, achievements and XP,
recommendations/chat, advanced analytics, push delivery, full admin catalog
operations, broad international seed coverage, and offline mutation sync remain
future work. The core architecture provides extension points without presenting
these features as complete.
