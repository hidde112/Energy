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
- Deterministic desktop/mobile UI-contract coverage, pgTAP security coverage,
  CI, and deployment docs.

## Verification evidence

- Unit/component tests: 106 passing tests across 28 files.
- Database tests: 88 passing pgTAP assertions across 6 files.
- End-to-end tests: 20 Playwright cases across desktop, Pixel 7, and iPhone-sized profiles.
- Formatting, ESLint, strict TypeScript, and production build are required by `npm run verify`.
- Playwright uses an explicit non-production cookie fixture. It proves browser
  behavior and persistence contracts, while pgTAP proves database policies and
  transactions; the credentialed hosted smoke test is the integration boundary.

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

## Automated acceptance evidence

1. Guest identity and normalized unique username: implemented; unit,
   UI-contract, and database constraints cover it.
2. Browser refresh persistence: covered by deterministic onboarding,
   collection, and rating journeys; hosted persistence awaits the live smoke test.
3. iPhone-sized, Android-sized, and desktop layouts: responsive Playwright profiles pass without overflow.
4. Installable PWA: manifest, icons, registration, and offline state are implemented and unit-tested.
5. Camera/gallery/manual truthful fallbacks: component and E2E coverage pass.
6. Known barcode avoids vision: orchestration unit tests and deterministic barcode journey pass.
7. Unknown image uses validated server-side vision candidates: adapter/unit coverage and deterministic browser journey pass.
8. Low-confidence output remains provisional/correctable: domain, database, and moderation tests pass.
9. Confirmation adds an explicit collection status atomically: RPC/pgTAP and UI-contract journey pass.
10. Tasting history plus one current rating: atomic RPC, schema, unit, and UI-contract coverage pass.
11. Collection/rating refresh behavior passes in the UI harness; database ownership and persistence are covered separately by pgTAP.
12. Cross-user and unauthorized mutation denial: RLS/RPC pgTAP plus UI ownership denial pass.
13. Missing configuration is explicit and secrets stay server-side: env tests, setup page, and client-bundle scan pass.
14. Required automated gates and production build: `npm run verify` passes
    after a clean five-migration database rebuild.
15. Setup, migration, deployment, pipeline, progress, and limitations: documented in the repository.

These checks do not certify a deployment. Release acceptance remains pending
until `npm run test:smoke-live` passes with the owner's hosted Supabase, Vercel,
and OpenAI bindings.

## Later delivery units

Account recovery/upgrades, multi-device session management, profile-photo UI,
passkeys and app lock, friends/feeds/groups/comments, achievements and XP,
recommendations/chat, advanced analytics, push delivery, full admin catalog
operations, broad international seed coverage, and offline mutation sync remain
future work. The core architecture provides extension points without presenting
these features as complete.
