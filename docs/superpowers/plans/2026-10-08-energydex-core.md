# ENERGYDEX Core Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first deployable ENERGYDEX vertical slice: durable guest identity, sourced catalog, barcode and AI-assisted identification, collection and ratings, dashboard, PWA behavior, and verified Supabase/Vercel setup.

**Architecture:** Use a modular Next.js App Router monolith with strict TypeScript. Supabase owns PostgreSQL, Auth, Storage, and RLS; server-only feature modules orchestrate privileged writes and external providers, while narrow domain interfaces keep identity, catalog, scanning, collection, and reviews independently testable.

**Tech Stack:** Node.js 24, npm, Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Motion, Lucide, TanStack Query, Zod, Supabase, OpenAI, Open Food Facts, ZXing, Vitest, Testing Library, pgTAP, and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-energydex-core-design.md`

## Global Constraints

- Use the existing checkout directly; do not create a Git worktree unless the user explicitly requests one.
- Resolve current stable, mutually compatible package versions during Task 1 and commit `package-lock.json`; do not use floating versions afterward.
- Keep TypeScript strict and keep server credentials out of client bundles, logs, fixtures, and tracked files.
- Use Supabase anonymous Auth, PostgreSQL, Storage, and RLS; deploy the web application to Vercel.
- Support iOS Safari, Android Chrome, and desktop with a mobile-first layout and safe-area spacing.
- Unknown product facts remain `null`; AI output is an untrusted hypothesis, not verified catalog data.
- Do not display success until required persistence completes; offline or missing configuration must be explicit.
- Barcode hits must not invoke paid vision; all external product facts and images retain provenance.
- Use test-driven development for behavior, one independently reviewable commit per task, and no unrelated refactors.

## Review Focus

- Camera permission denial or unavailable camera must leave gallery upload and manual barcode entry usable; Task 7 pins all three states.
- Invalid, duplicate, or oddly formatted EAN/UPC input must normalize safely or return a typed validation/conflict error; Tasks 5 and 10 pin it.
- Malformed AI output, low-confidence candidates, and provider timeouts must never create a verified product; Tasks 8 through 10 pin these paths.
- Anonymous session refresh and cross-user requests must preserve the owner session while RLS denies unrelated data; Tasks 3, 4, 6, and 12 pin it.
- Repeated confirmation after a timeout must be idempotent and must not duplicate a product, collection row, rating, or paid inference; Tasks 9, 10, and 12 pin it.

## Planned File Structure

- `src/app/`: route layouts, pages, route handlers, manifest, and error/loading boundaries.
- `src/features/identity/`: anonymous session, onboarding, profile, and account-upgrade boundaries.
- `src/features/catalog/`: product types, normalization, repositories, search, and product UI.
- `src/features/scanner/`: camera/decode UI, provider adapters, matching, orchestration, and confirmation.
- `src/features/collection/`: collection domain, repositories, actions, and views.
- `src/features/reviews/`: tasting/rating rules, repositories, actions, and views.
- `src/features/dashboard/`: derived personal statistics and home presentation.
- `src/features/moderation/`: provisional-product review and correction boundaries.
- `src/lib/`: configuration, Supabase clients, errors, logging, rate limits, and shared test utilities.
- `supabase/`: local configuration, migrations, seed data, database tests, and generated types.
- `tests/e2e/`: Playwright fixtures and complete user journeys.
- `public/`: PWA icons, offline page assets, and service worker.

---

### Task 1: Application Foundation and Quality Harness

**Files:**
- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.prettierrc.json`, `postcss.config.mjs`
- Create: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/error.tsx`, `src/app/not-found.tsx`
- Create: `src/components/app-shell.tsx`, `src/components/bottom-nav.tsx`, `src/components/desktop-sidebar.tsx`, `src/components/theme-provider.tsx`
- Create: `src/components/__tests__/app-shell.test.tsx`, `src/app/__tests__/home-page.test.tsx`

**Interfaces:**
- Consumes: none.
- Produces: `AppShell({ children }: PropsWithChildren)`, shared CSS tokens, npm scripts `dev`, `build`, `start`, `lint`, `typecheck`, `format:check`, `test:unit`, `test:db`, `test:e2e`, and `verify`.

- [ ] **Step 1: Create the manifest and test harness, then write failing shell tests**

  Assert that the shell exposes Home, Discover, Scan, Collection, and Friends; Scan is the primary action; desktop and mobile navigation use accessible labels; and the root page has an ENERGYDEX heading plus “Scan it. Rate it. Collect it.”

- [ ] **Step 2: Run the focused tests and verify they fail because the shell does not exist**

  Run: `npm run test:unit -- src/components/__tests__/app-shell.test.tsx src/app/__tests__/home-page.test.tsx`
  Expected: FAIL with missing component/module assertions.

- [ ] **Step 3: Implement the minimal Next.js shell and design tokens**

  Install and pin compatible dependencies with:

  ```bash
  npm install next react react-dom @supabase/supabase-js @supabase/ssr zod @tanstack/react-query lucide-react motion recharts @zxing/browser openai sharp class-variance-authority clsx tailwind-merge @radix-ui/react-slot
  npm install --save-dev typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss supabase vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test eslint eslint-config-next prettier prettier-plugin-tailwindcss
  ```

  Build the charcoal/electric-lime theme with light-mode variables, add safe-area navigation, and keep the Friends route visibly marked as a later release rather than presenting fake controls.

- [ ] **Step 4: Run the task tests and static checks**

  Run: `npm run test:unit -- src/components/__tests__/app-shell.test.tsx src/app/__tests__/home-page.test.tsx`
  Expected: PASS.

  Run: `npm run lint && npm run typecheck && npm run build`
  Expected: all commands exit 0.

- [ ] **Step 5: Commit**

  ```bash
  git add package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs .prettierrc.json postcss.config.mjs vitest.config.ts vitest.setup.ts playwright.config.ts src
  git commit -m "feat: scaffold ENERGYDEX application shell"
  ```

### Task 2: Typed Configuration, Errors, and Supabase Clients

**Files:**
- Create: `.env.example`
- Create: `src/lib/env/public.ts`, `src/lib/env/server.ts`, `src/lib/env/__tests__/env.test.ts`
- Create: `src/lib/errors/app-error.ts`, `src/lib/errors/problem-details.ts`, `src/lib/errors/__tests__/problem-details.test.ts`
- Create: `src/lib/actions/action-result.ts`
- Create: `src/lib/supabase/browser.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`
- Create: `src/lib/logging/logger.ts`

**Interfaces:**
- Consumes: Zod and Supabase packages pinned in Task 1.
- Produces: `parsePublicEnv(input): PublicEnv`, `parseServerEnv(input): ServerEnv`, `ActionResult<T>`, `AppError`, `toProblemDetails(error, correlationId): ProblemDetails`, `createBrowserSupabaseClient()`, `createServerSupabaseClient()`, and `createAdminSupabaseClient()`.

- [ ] **Step 1: Write failing configuration and error-contract tests**

  Assert that missing public configuration yields code `CONFIGURATION_MISSING`, server-only variables never appear in `PublicEnv`, known `AppError` codes map to stable HTTP statuses, and unknown errors produce a generic message with a correlation ID.

- [ ] **Step 2: Run the tests and verify the missing modules fail**

  Run: `npm run test:unit -- src/lib/env/__tests__/env.test.ts src/lib/errors/__tests__/problem-details.test.ts`
  Expected: FAIL on missing exports.

- [ ] **Step 3: Implement schemas, errors, clients, and safe structured logging**

  Use `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`. Parse lazily so a configuration help page can render without secrets; throw before any operation that requires a missing value. Redact keys, authorization headers, cookies, image payloads, and PIN-like fields in logs.

- [ ] **Step 4: Run tests, type checking, and a client-bundle secret scan**

  Run: `npm run test:unit -- src/lib/env/__tests__/env.test.ts src/lib/errors/__tests__/problem-details.test.ts`
  Expected: PASS.

  Run: `npm run typecheck && npm run build`
  Expected: exit 0 and no server secret names/values emitted into client chunks.

- [ ] **Step 5: Commit**

  ```bash
  git add .env.example src/lib
  git commit -m "feat: add typed runtime configuration"
  ```

### Task 3: Supabase Schema, RLS, Storage, and Seed Foundation

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202610080001_core_schema.sql`
- Create: `supabase/migrations/202610080002_core_rls.sql`
- Create: `supabase/migrations/202610080003_storage_and_functions.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/tests/core_schema.test.sql`, `supabase/tests/core_rls.test.sql`
- Create: `src/lib/supabase/database.types.ts`

**Interfaces:**
- Consumes: Supabase CLI pinned as a development dependency.
- Produces: core tables and enums from the spec; SQL functions `public.is_moderator()`, `public.handle_new_user()`, and later-consumed `public.confirm_scan(p_scan_id uuid, p_user_id uuid, p_confirmation jsonb, p_idempotency_key text) returns jsonb` contract; generated `Database` TypeScript type.

- [ ] **Step 1: Write failing pgTAP tests for constraints and isolation**

  Cover unique normalized usernames and barcodes, rating range `0.5..10.0`, one collection row per user/product, one current review per user/product, source-required provisional products, owner access, unrelated-user denial, public verified-catalog reads, provisional-product restriction, and moderator-only audit access.

- [ ] **Step 2: Start local Supabase and prove the database tests fail before migrations exist**

  Run: `npx supabase start`

  Run: `npm run test:db`
  Expected: FAIL because the tested relations/policies are absent.

- [ ] **Step 3: Implement normalized schema, indexes, triggers, RLS, storage policies, and seed data**

  Create profiles/settings; catalog/source/flavor tables; collection/tasting/review tables; scans/candidates; roles/audit tables; rate-limit/idempotency support; and public/private media buckets. Keep unverified facts nullable and seed only synthetic users plus a small sourced catalog fixture.

- [ ] **Step 4: Regenerate types and run database tests twice from a clean reset**

  Run: `npx supabase db reset && npm run test:db`
  Expected: PASS.

  Run: `npx supabase gen types typescript --local > /tmp/energydex-database.types.ts`, apply the generated content to `src/lib/supabase/database.types.ts`, then rerun `npm run test:db && npm run typecheck`.
  Expected: PASS with repeatable migrations and seed.

- [ ] **Step 5: Commit**

  ```bash
  git add package.json package-lock.json supabase src/lib/supabase/database.types.ts
  git commit -m "feat: add secure Supabase core schema"
  ```

### Task 4: Anonymous Identity and Profile Onboarding

**Files:**
- Create: `src/features/identity/contracts.ts`, `src/features/identity/server/session.ts`, `src/features/identity/server/profile-actions.ts`
- Create: `src/features/identity/components/onboarding-form.tsx`, `src/features/identity/components/profile-menu.tsx`
- Create: `src/features/identity/__tests__/session.test.ts`, `src/features/identity/__tests__/onboarding-form.test.tsx`
- Create: `src/app/onboarding/page.tsx`, `src/app/profile/page.tsx`, `src/app/auth/callback/route.ts`
- Create: `src/proxy.ts`

**Interfaces:**
- Consumes: Task 2 clients/errors and Task 3 `profiles` schema.
- Produces: `ensureAnonymousSession(): Promise<User>`, `getCurrentProfile(): Promise<Profile | null>`, and `completeOnboarding(input: { username: string; displayName?: string }): Promise<ActionResult<Profile>>`.

- [ ] **Step 1: Write failing session and onboarding tests**

  Assert one anonymous sign-in for a missing session, no replacement of an existing user ID after refresh, lowercase username normalization, duplicate username conflict, Unicode-safe display name validation, and redirect to onboarding only when the profile is incomplete.

- [ ] **Step 2: Run the focused tests and verify failure**

  Run: `npm run test:unit -- src/features/identity`
  Expected: FAIL on missing session/actions/components.

- [ ] **Step 3: Implement cookie-safe Supabase SSR session refresh and onboarding**

  Keep account-linking boundaries documented but do not build an unverified passkey UI. Return typed action results, preserve the Supabase user UUID, and never use an IP address as identity.

- [ ] **Step 4: Run identity tests plus an RLS regression**

  Run: `npm run test:unit -- src/features/identity && npm run test:db && npm run typecheck`
  Expected: PASS, including cross-user profile denial.

- [ ] **Step 5: Commit**

  ```bash
  git add src/features/identity src/app/onboarding src/app/profile src/app/auth src/proxy.ts
  git commit -m "feat: add anonymous onboarding"
  ```

### Task 5: Catalog Domain, Search, and Product Detail

**Files:**
- Create: `src/features/catalog/domain/barcode.ts`, `src/features/catalog/domain/normalize.ts`, `src/features/catalog/domain/types.ts`
- Create: `src/features/catalog/server/catalog-repository.ts`, `src/features/catalog/server/supabase-catalog-repository.ts`
- Create: `src/features/catalog/components/product-card.tsx`, `src/features/catalog/components/catalog-search.tsx`, `src/features/catalog/components/product-detail.tsx`
- Create: `src/features/catalog/__tests__/barcode.test.ts`, `src/features/catalog/__tests__/normalize.test.ts`, `src/features/catalog/__tests__/catalog-search.test.tsx`
- Create: `src/app/discover/page.tsx`, `src/app/products/[productId]/page.tsx`, `src/app/api/catalog/search/route.ts`

**Interfaces:**
- Consumes: `Database`, `AppError`, and verified/provisional catalog policies.
- Produces: `normalizeBarcode(value: string): Barcode`, `normalizeProductName(value: string): string`, and `CatalogRepository` methods `findByBarcode`, `search`, `getById`, and `findCandidates`.

- [ ] **Step 1: Write failing domain and search tests**

  Pin EAN-8/EAN-13/UPC-A checksum validation, spaces/hyphens normalization, leading-zero preservation, invalid checksum rejection, accent/case-safe product normalization, debounced search, empty state, and verified/provisional visibility.

- [ ] **Step 2: Run the catalog tests and verify failure**

  Run: `npm run test:unit -- src/features/catalog`
  Expected: FAIL on missing domain/repository/UI exports.

- [ ] **Step 3: Implement catalog types, Supabase repository, search route, and responsive product UI**

  Return provenance and nullable facts explicitly. Paginate server-side, avoid N+1 image/source queries, and show source/verification labels without exposing private provisional records.

- [ ] **Step 4: Run focused tests, database tests, and static checks**

  Run: `npm run test:unit -- src/features/catalog && npm run test:db && npm run lint && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/features/catalog src/app/discover src/app/products src/app/api/catalog
  git commit -m "feat: add sourced product catalog"
  ```

### Task 6: Collection, Tasting History, and Current Ratings

**Files:**
- Create: `src/features/collection/domain/collection.ts`, `src/features/collection/server/collection-actions.ts`, `src/features/collection/components/collection-grid.tsx`
- Create: `src/features/collection/__tests__/collection.test.ts`, `src/features/collection/__tests__/collection-grid.test.tsx`
- Create: `src/features/reviews/domain/rating.ts`, `src/features/reviews/server/review-actions.ts`, `src/features/reviews/components/rating-form.tsx`
- Create: `src/features/reviews/__tests__/rating.test.ts`, `src/features/reviews/__tests__/rating-form.test.tsx`
- Create: `src/app/collection/page.tsx`, `src/app/products/[productId]/rate/page.tsx`

**Interfaces:**
- Consumes: Task 3 tables, Task 4 identity, and Task 5 `CatalogRepository`.
- Produces: `setCollectionStatus(input): Promise<ActionResult<CollectionEntry>>`, `recordTasting(input): Promise<ActionResult<TastingSession>>`, and `upsertCurrentReview(input): Promise<ActionResult<Review>>`.

- [ ] **Step 1: Write failing domain, action, and component tests**

  Cover tried versus physically collected, archive/reactivate transitions, idempotent status updates, rating increments of `0.5`, rejection below `0.5` or above `10.0`, multiple tastings with one current review, failed-write UI rollback, and cross-user action denial.

- [ ] **Step 2: Run focused tests and verify failure**

  Run: `npm run test:unit -- src/features/collection src/features/reviews`
  Expected: FAIL on missing rules/actions/components.

- [ ] **Step 3: Implement transactional server actions and mobile collection/rating views**

  Make status updates idempotent, keep tasting history immutable except explicit correction, and update aggregate ratings only from each user's current review.

- [ ] **Step 4: Run focused tests and database policy tests**

  Run: `npm run test:unit -- src/features/collection src/features/reviews && npm run test:db && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/features/collection src/features/reviews src/app/collection src/app/products
  git commit -m "feat: add collections and ratings"
  ```

### Task 7: Camera, Upload, and Barcode Capture

**Files:**
- Create: `src/features/scanner/domain/scan-input.ts`
- Create: `src/features/scanner/client/barcode-decoder.ts`, `src/features/scanner/client/camera-controller.ts`
- Create: `src/features/scanner/components/scan-capture.tsx`, `src/features/scanner/components/manual-barcode-form.tsx`
- Create: `src/features/scanner/__tests__/scan-capture.test.tsx`, `src/features/scanner/__tests__/manual-barcode-form.test.tsx`
- Create: `src/app/scan/page.tsx`

**Interfaces:**
- Consumes: Task 5 `normalizeBarcode`.
- Produces: discriminated `ScanInput` (`barcode`, `image`, or `camera-frame`), `BarcodeDecoder.decode(source): Promise<Barcode | null>`, and `ScanCapture({ onCapture }): JSX.Element`.

- [ ] **Step 1: Write failing capability and fallback tests**

  Assert rear-camera request when available, clear permission-denied copy, decoder timeout cleanup, unsupported torch hiding, gallery fallback, image type/size rejection, manual barcode submission, and no duplicate capture callback.

- [ ] **Step 2: Run scanner component tests and verify failure**

  Run: `npm run test:unit -- src/features/scanner/__tests__/scan-capture.test.tsx src/features/scanner/__tests__/manual-barcode-form.test.tsx`
  Expected: FAIL on missing components/adapters.

- [ ] **Step 3: Implement progressive camera and ZXing decoding**

  Stop media tracks on success, cancellation, error, and unmount. Treat focus/torch as optional capabilities and retain upload/manual entry at all times.

- [ ] **Step 4: Run scanner tests, lint, and type checking**

  Run: `npm run test:unit -- src/features/scanner && npm run lint && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/features/scanner src/app/scan
  git commit -m "feat: add resilient scan capture"
  ```

### Task 8: Open Food Facts and OpenAI Provider Adapters

**Files:**
- Create: `src/features/scanner/providers/contracts.ts`, `src/features/scanner/providers/open-food-facts.ts`, `src/features/scanner/providers/openai-vision.ts`
- Create: `src/features/scanner/server/image-preprocessor.ts`
- Create: `src/features/scanner/providers/__tests__/open-food-facts.test.ts`, `src/features/scanner/providers/__tests__/openai-vision.test.ts`
- Create: `src/features/scanner/providers/__fixtures__/open-food-facts.json`, `src/features/scanner/providers/__fixtures__/vision-responses.ts`

**Interfaces:**
- Consumes: Task 2 configuration/errors, Task 5 `Barcode`, and Zod/OpenAI/Sharp dependencies.
- Produces: `ProductDataProvider.lookupBarcode(barcode, signal): Promise<ExternalProduct | null>`, `VisionProvider.identify(image, signal): Promise<VisionHypothesis>`, and `preprocessScanImage(file): Promise<PreparedImage>`.

- [ ] **Step 1: Write failing provider-contract tests**

  Cover valid mapping with source URL/license metadata, Open Food Facts not-found, timeout, malformed JSON, image magic-byte/size/dimension enforcement, metadata stripping, strict vision parsing, malicious label text treated as data, and missing OpenAI key.

- [ ] **Step 2: Run provider tests and verify failure**

  Run: `npm run test:unit -- src/features/scanner/providers`
  Expected: FAIL on missing adapters and schemas.

- [ ] **Step 3: Implement abortable provider adapters and validated image preprocessing**

  Do not retry validation failures. Map provider outages to typed errors, allow bounded retry for transient network responses, and never log images or raw model responses containing user content.

- [ ] **Step 4: Run provider tests and type checking**

  Run: `npm run test:unit -- src/features/scanner/providers && npm run typecheck`
  Expected: PASS with no live provider calls.

- [ ] **Step 5: Commit**

  ```bash
  git add package.json package-lock.json src/features/scanner/providers src/features/scanner/server/image-preprocessor.ts
  git commit -m "feat: add product identification providers"
  ```

### Task 9: Matching, Confidence, Caching, and Identification Orchestration

**Files:**
- Create: `src/features/scanner/domain/matching.ts`, `src/features/scanner/domain/confidence.ts`
- Create: `src/features/scanner/server/identification-service.ts`, `src/features/scanner/server/scan-cache.ts`
- Create: `src/lib/rate-limit/database-rate-limiter.ts`
- Create: `src/features/scanner/__tests__/matching.test.ts`, `src/features/scanner/__tests__/identification-service.test.ts`

**Interfaces:**
- Consumes: Task 5 `CatalogRepository`, Task 8 providers, and Task 3 scan/cache/rate-limit tables.
- Produces: `rankCandidates(hypothesis, products): RankedCandidate[]`, `classifyConfidence(score): 'high' | 'medium' | 'low'`, and `IdentificationService.identify(userId, input, idempotencyKey): Promise<IdentificationResult>`.

- [ ] **Step 1: Write failing ranking and orchestration tests**

  Assert exact barcode outranks every fuzzy signal; aliases/brand/variant contribute deterministic weights; high returns one candidate, medium at most three, low requires correction; barcode hits never call vision; cached image fingerprint avoids a second inference; rate limit returns `RATE_LIMITED`; retry with one idempotency key returns the original result; timeout does not create catalog data.

- [ ] **Step 2: Run focused tests and verify failure**

  Run: `npm run test:unit -- src/features/scanner/__tests__/matching.test.ts src/features/scanner/__tests__/identification-service.test.ts`
  Expected: FAIL on missing ranking/service.

- [ ] **Step 3: Implement deterministic ranking and barcode-first orchestration**

  Keep score weights and high/medium thresholds as named constants covered by tests. Persist stage metadata and estimated provider usage, but store neither private image content nor a verified product before confirmation.

- [ ] **Step 4: Run scanner unit tests and database tests**

  Run: `npm run test:unit -- src/features/scanner && npm run test:db && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/features/scanner src/lib/rate-limit
  git commit -m "feat: orchestrate reliable product identification"
  ```

### Task 10: Scan API, Candidate Confirmation, and Atomic Persistence

**Files:**
- Modify: `supabase/migrations/202610080003_storage_and_functions.sql`
- Modify: `supabase/tests/core_schema.test.sql`, `supabase/tests/core_rls.test.sql`
- Create: `src/features/scanner/server/confirm-scan.ts`, `src/features/scanner/components/scan-result.tsx`, `src/features/scanner/components/candidate-list.tsx`
- Create: `src/features/scanner/__tests__/confirm-scan.test.ts`, `src/features/scanner/__tests__/scan-result.test.tsx`
- Create: `src/features/moderation/server/product-correction-actions.ts`, `src/features/moderation/components/provisional-product-list.tsx`
- Create: `src/features/moderation/__tests__/product-correction-actions.test.ts`, `src/app/admin/products/page.tsx`
- Create: `src/app/api/scans/identify/route.ts`, `src/app/api/scans/[scanId]/confirm/route.ts`, `src/app/scan/[scanId]/page.tsx`

**Interfaces:**
- Consumes: Task 6 collection/review actions and Task 9 `IdentificationService`.
- Produces: POST `/api/scans/identify`, POST `/api/scans/:scanId/confirm`, `confirmScan(input): Promise<ConfirmedScan>` backed by atomic `public.confirm_scan`, and `correctProvisionalProduct(input): Promise<ActionResult<Product>>` for moderators.

- [ ] **Step 1: Write failing API, transaction, and UI tests**

  Cover authentication, body/file validation, correlation IDs, no more than three medium candidates, low-confidence correction, provenance-linked provisional creation, duplicate barcode conflict, atomic scan/product/collection/rating writes, double-submit idempotency, retry after response loss, no success screen after failed persistence, moderator correction with audit history, and non-moderator denial.

- [ ] **Step 2: Run focused unit and database tests and verify failure**

  Run: `npm run test:unit -- src/features/scanner/__tests__/confirm-scan.test.ts src/features/scanner/__tests__/scan-result.test.tsx src/features/moderation && npm run test:db`
  Expected: FAIL on missing routes/RPC/confirmation UI.

- [ ] **Step 3: Implement route handlers, transactional confirmation, correction, and result UI**

  Require authenticated ownership of the scan, preserve provider provenance, mark new products provisional, reuse the idempotency key across client retries, and require a moderator role plus audit event for catalog correction.

- [ ] **Step 4: Run scanner, database, and static checks**

  Run: `npm run test:unit -- src/features/scanner src/features/moderation && npm run test:db && npm run lint && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add supabase src/features/scanner src/features/moderation src/app/api/scans src/app/scan src/app/admin
  git commit -m "feat: confirm scans atomically"
  ```

### Task 11: Dashboard, PWA, Offline States, and Accessibility

**Files:**
- Create: `src/features/dashboard/server/dashboard-query.ts`, `src/features/dashboard/components/dashboard.tsx`, `src/features/dashboard/__tests__/dashboard.test.tsx`
- Create: `src/app/manifest.ts`, `src/app/offline/page.tsx`, `src/components/service-worker-registration.tsx`
- Create: `public/sw.js`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`
- Create: `src/lib/i18n/en.ts`, `src/lib/i18n/nl.ts`, `src/lib/i18n/index.ts`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: identity, collection, reviews, and catalog queries.
- Produces: `getDashboard(userId): Promise<DashboardSummary>`, PWA manifest/service-worker registration, explicit offline state, and `translate(locale, key, values?)`.

- [ ] **Step 1: Write failing dashboard, manifest, offline, locale, and accessibility tests**

  Assert persisted unique-product/brand/rating summaries, empty state, localized navigation keys in English and Dutch, valid manifest icons/theme colors, offline GET fallback without caching private mutations, keyboard navigation, visible focus, reduced motion, and no horizontal overflow at representative mobile widths.

- [ ] **Step 2: Run focused tests and verify failure**

  Run: `npm run test:unit -- src/features/dashboard src/lib/i18n src/app/__tests__`
  Expected: FAIL on missing dashboard/PWA/i18n behavior.

- [ ] **Step 3: Implement the dashboard, installability assets, safe read caching, and accessibility polish**

  Cache only versioned static assets and explicitly public GET responses. Never queue or report a private mutation as complete from the service worker.

- [ ] **Step 4: Run unit tests, Lighthouse-compatible manifest checks, and production build**

  Run: `npm run test:unit && npm run lint && npm run typecheck && npm run build`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/features/dashboard src/app src/components src/lib/i18n public
  git commit -m "feat: add dashboard and installable PWA"
  ```

### Task 12: End-to-End Proof, CI, Documentation, and Deployment Readiness

**Files:**
- Create: `tests/e2e/fixtures/supabase.ts`, `tests/e2e/onboarding.spec.ts`, `tests/e2e/scan-collection-rating.spec.ts`, `tests/e2e/security.spec.ts`, `tests/e2e/responsive.spec.ts`
- Create: `scripts/smoke-live.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`
- Create: `SETUP.md`, `DATABASE.md`, `AI_PIPELINE.md`, `PROJECT_PROGRESS.md`
- Modify: `.env.example`, `package.json`

**Interfaces:**
- Consumes: every prior task.
- Produces: repeatable `npm run verify`, `npm run test:smoke-live`, CI gates, and complete local/hosted setup and deployment documentation.

- [ ] **Step 1: Write failing end-to-end journeys**

  Cover guest onboarding and refresh persistence; manual barcode hit without vision; deterministic image candidate fallback; confirmation into collection; rating update with history; duplicate confirmation retry; provider outage recovery; camera denial fallback; unrelated-user API and database denial; mobile/desktop navigation; and missing-config setup state.

- [ ] **Step 2: Run Playwright and verify failures identify remaining integration gaps**

  Run: `npm run test:e2e`
  Expected: FAIL until fixtures, routes, and full flow are wired.

- [ ] **Step 3: Wire deterministic test providers, complete integration gaps, add CI, and document operations**

  Document local Supabase/Docker prerequisites, migrations, generated types, variables, provider setup, Vercel deployment, storage/auth redirect configuration, live smoke testing, known limitations, and the distinction between implemented and later-release features.

- [ ] **Step 4: Run the complete clean verification**

  Run: `npx supabase db reset`

  Run: `npm ci && npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:db && npm run test:e2e && npm run build`
  Expected: every required command exits 0, no required suite reports zero tests, and the build contains no server credentials.

  Run `npm run test:smoke-live` only after hosted Supabase/OpenAI bindings exist; until then, document it as blocked rather than passed.

- [ ] **Step 5: Commit**

  ```bash
  git add tests scripts .github README.md SETUP.md DATABASE.md AI_PIPELINE.md PROJECT_PROGRESS.md .env.example package.json package-lock.json
  git commit -m "test: verify ENERGYDEX core release"
  ```

## Final Verification and Handoff

- [ ] Run `git status --short` and confirm only intentional files remain.
- [ ] Run `npm run verify` from a clean dependency install and record exact test/build counts in `PROJECT_PROGRESS.md`.
- [ ] Run the live smoke test after secure environment bindings are present; keep live integration explicitly blocked otherwise.
- [ ] Review the implementation against all 15 core acceptance criteria in the design spec.
- [ ] Use `superpowers:verification-before-completion` before any readiness claim.
- [ ] Use `superpowers:requesting-code-review` for a whole-branch review.
- [ ] Use `superpowers:finishing-a-development-branch` to present integration options after review passes.
