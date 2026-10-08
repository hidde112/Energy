# ENERGYDEX Core Release Design

Date: 2026-10-08
Status: Approved conversational design; written specification pending final review

## 1. Purpose

ENERGYDEX is a mobile-first energy drink collector and social platform for a small friend group. The finished product must be a real, persistent application rather than a static prototype: people can identify cans, maintain a collection, rate products, compare activity with friends, and receive grounded recommendations.

The product priorities are trustworthy identification, accurate catalog data, excellent mobile use, secure persistent accounts, and a design polished enough for daily use. Missing facts must remain unknown, and no interface may imply that an operation or persistence succeeded when it did not.

The complete product brief spans several independent subsystems. Work will therefore proceed as staged delivery units. This document defines the architecture and first independently usable release while preserving clear extension points for later units.

## 2. Delivery strategy

### 2.1 Core release

The first release is a production-shaped vertical slice containing:

- guest/anonymous onboarding and an upgrade-ready account identity;
- username and basic profile setup;
- responsive mobile navigation and desktop sidebar;
- dark and light themes, with dark as the default;
- installable PWA metadata and offline-aware states;
- a sourced product catalog with search and product detail;
- camera, image upload, and manual barcode scan entry;
- internal catalog and Open Food Facts barcode lookup;
- server-side OpenAI vision fallback for unrecognized products;
- confidence-based candidate selection and user confirmation;
- personal collection states;
- tasting history and one current primary rating per product;
- a basic personal dashboard; and
- minimal catalog moderation capabilities needed to correct provisional records.

The release is complete only when this flow works end to end against Supabase, survives a refresh, can be installed as a PWA, and has tested setup and deployment instructions. Missing external configuration must produce an honest setup state rather than simulated success.

### 2.2 Later delivery units

Later units extend the core without changing its public module contracts:

1. Social discovery: friendships, shared profiles, activity, reactions, comparisons, groups, and richer discovery.
2. Gamification and Energy AI: XP, levels, achievements, challenges, leaderboards, personalized recommendations, and conversational explanations.
3. Analytics and experiences: advanced statistics, yearly recap, blind taste tests, wishlist discovery tracking, import/export, and shareable artifacts.
4. Operations and polish: notifications, full administration, moderation, localization depth, offline mutation synchronization, performance tuning, security review, and broader device validation.

The database may reserve stable concepts needed by later units, but the core release will not add unused screens or speculative service layers.

## 3. Architecture

### 3.1 Application shape

ENERGYDEX will be a modular monolith built with a current stable, mutually compatible set of:

- Next.js App Router and strict TypeScript;
- React;
- Tailwind CSS and shadcn/ui;
- Motion for purposeful transitions;
- Lucide icons;
- TanStack Query where client caching or mutation state adds value;
- Zod at all external and server boundaries;
- Supabase PostgreSQL, Auth, Storage, and Realtime;
- a browser-compatible barcode decoder with EAN-8, EAN-13, and UPC support;
- Open Food Facts as the first external product-data provider;
- OpenAI multimodal models behind a server-only adapter; and
- Playwright plus unit, component, database, and policy tests.

The application deploys to Vercel. Supabase remains a separate managed service. Dependency versions will be pinned during scaffolding after compatibility checks; this design intentionally does not guess versions before those checks.

### 3.2 Module boundaries

Feature modules have narrow typed interfaces and do not reach through one another to arbitrary database tables:

- `identity`: sessions, guest onboarding, account linking, profiles, and settings;
- `catalog`: brands, products, aliases, barcodes, media, provenance, and search;
- `scanner`: capture, decoding, provider orchestration, candidates, and confirmation;
- `collection`: user/product status and collection views;
- `reviews`: tasting events, current ratings, rating dimensions, and notes;
- `dashboard`: derived personal summaries;
- `moderation`: provisional records, catalog correction, roles, and audit events; and
- `platform`: Supabase clients, validation, errors, rate limits, logging, and provider adapters.

Browser components can perform explicitly safe RLS-protected reads. Privileged writes, external provider calls, scan orchestration, AI calls, and administrative actions run in server-only modules. The database independently enforces access control even when a request passes through Next.js.

### 3.3 Route shape

The core application exposes:

- onboarding and identity routes;
- Home;
- Discover/catalog search;
- Scan as the prominent central action;
- Collection;
- product and scan-confirmation detail;
- profile/settings; and
- a role-protected minimal moderation area.

Mobile uses a five-item bottom navigation: Home, Discover, Scan, Collection, and Friends. The Friends entry may clearly identify the later social release until that module is delivered; it must not contain nonfunctional controls masquerading as finished functionality. Desktop uses a sidebar with the same information architecture.

## 4. Identity and account model

Supabase anonymous authentication creates a durable guest user on first use. The user selects a unique public username during onboarding. Profile and collection data reference the Supabase user UUID, so linking email/passwordless or passkey-capable authentication later does not replace the identity or lose data.

Account authentication and the optional local privacy lock are separate:

- Supabase sessions authenticate access to server data.
- A local privacy lock hides the interface on that device.
- PINs are never stored in plaintext.
- Biometric wording is used only when real WebAuthn or platform authenticator support is available.
- IP addresses are not identities and may be used only for proportionate abuse controls.

The core data model and commands must leave room for session management, remote sign-out, export, deletion, and account recovery. Account deletion and export are server-side operations with explicit confirmation, auditability, and privacy-safe output.

## 5. Data model

### 5.1 Catalog

The first migrations define normalized tables for:

- brands;
- products;
- product aliases;
- product barcodes;
- product images;
- product sources;
- categories;
- flavor tags; and
- product/flavor relationships.

Products hold only fields justified by a source or confirmed correction. Nullable nutrition, origin, release, and regional fields remain null when unknown. Verification status distinguishes provisional, community-confirmed, and verified records. Canonical names, normalized aliases, and barcode uniqueness constraints prevent duplicates while still supporting regional variants.

Every displayed external fact and image can be traced to source metadata and applicable usage information. Arbitrary search-engine image scraping is excluded.

### 5.2 User data

The first migrations also define:

- profiles and user settings;
- user collection entries and statuses;
- tasting sessions;
- reviews and rating dimensions;
- scans and scan candidates;
- application roles; and
- moderation audit events.

A user may record multiple tasting sessions for a product, while exactly one review state represents the current primary rating used in aggregates. Collection status distinguishes trying a product from physically owning its can. Constraints enforce the 0.5 through 10.0 rating range and valid status transitions.

UUID primary keys, foreign keys, timestamps, archival fields, targeted indexes, and database constraints protect integrity. Search, collection listing, barcode lookup, and user/product joins receive indexes based on concrete query plans rather than speculative indexing.

### 5.3 Generated types and migrations

SQL migrations are the source of truth. Generated TypeScript database types are committed after schema changes. Development seed data contains sourced representative products and synthetic users only; it never contains production credentials or personal data.

## 6. Authorization, privacy, and storage

All user-owned tables use Row Level Security with owner-only access by default. Public, verified catalog records are readable without granting write access. Provisional submissions and private media are visible only to their owner and authorized moderators until policy permits wider access.

Server commands recheck authentication and authorization for:

- scan confirmation and provisional product creation;
- catalog correction;
- uploads;
- account export and deletion;
- role-restricted moderation; and
- any operation using a privileged Supabase client.

Storage separates public verified catalog media from private user photos. Upload handling validates authentication, MIME type, file signature, dimensions, and size before storage. Private buckets never rely on obscure URLs for access control.

Only Supabase public browser configuration reaches the client bundle. Service credentials and OpenAI secrets remain server-side. Logs exclude access tokens, raw provider credentials, private images, PIN material, and unnecessary profile data. Administrative changes emit audit records.

Rate limits cover anonymous signup, scans, AI calls, search abuse, and uploads. Limits are keyed using authenticated identity where possible and use privacy-conscious network signals only as secondary protection.

## 7. Scanner and identification pipeline

### 7.1 Capture

The scan experience progressively detects browser capabilities:

1. Request the rear camera with a clear permission explanation.
2. Attempt EAN-8, EAN-13, and UPC decoding through supported browser capabilities and a maintained JavaScript fallback.
3. Allow gallery upload when camera access is unavailable or unsuitable.
4. Allow manual barcode entry as a final fallback.
5. Validate image and barcode input before creating a server request.

The UI handles denial, unavailable hardware, unsupported torch/focus behavior, decode timeout, and duplicate scans without claiming unsupported native behavior.

### 7.2 Lookup order

For a decoded barcode, the server checks:

1. the internal product database;
2. the internal barcode and alias indexes; and
3. Open Food Facts through a typed provider adapter.

A successful barcode lookup never invokes paid vision. Provider data is normalized and recorded with provenance before presentation.

### 7.3 Vision fallback

When deterministic lookup fails, the user may submit a can image. The server:

1. validates file signature, size, and dimensions;
2. resizes the image and strips unnecessary metadata;
3. computes a safe fingerprint for duplicate/cached lookup;
4. sends the image through a server-only OpenAI adapter using a constrained prompt;
5. parses strict structured output with Zod; and
6. rejects malformed or unsafe results.

The structured result includes brand, product name, flavor, line, regular/zero status, special-edition indicators, estimated size, readable label text, possible barcode, region, evidence, and confidence per field. AI output is a hypothesis, never a catalog fact.

### 7.4 Matching and confidence

Candidate ranking uses deterministic signals first:

- exact barcode;
- normalized canonical name and aliases;
- brand;
- product line and variant;
- flavor tags; and
- bounded fuzzy similarity only after stronger signals.

High confidence presents one suggested match. Medium confidence presents no more than three candidates. Low confidence asks for another image or a concise correction. Thresholds are explicit, tested configuration rather than prompt prose.

If no candidate exists, confirmation creates a provisional product with source records and uncertain fields clearly marked. A model response alone cannot create a verified global product. Confirmed scan, collection, and rating writes occur transactionally where their consistency depends on one another.

### 7.5 Cost and reliability

Successful identification is cached by barcode and safe image fingerprint. AI requests have per-user limits, timeouts, bounded retries with backoff, and usage metadata sufficient for cost monitoring. Retrying a failed persistence step does not automatically repeat a successful paid inference.

The client retains the captured result long enough to retry confirmation after a transient error. Missing provider configuration, dependency outages, and low-confidence results have distinct actionable states.

## 8. User experience

The design system uses charcoal/near-black surfaces, electric-lime primary actions, and restrained cyan, purple, and orange status accents. Product imagery and collection progress establish hierarchy; gradients and motion support comprehension rather than decoration. Light mode remains fully supported.

Interaction requirements include:

- thumb-reachable primary mobile actions and safe-area spacing;
- keyboard and screen-reader navigation;
- visible focus and WCAG-conscious contrast;
- reduced-motion behavior;
- skeleton, empty, error, offline, and permission states;
- no placeholder buttons presented as active features;
- responsive layouts from small mobile screens through desktop; and
- Dutch and English localization foundations without hard-coded UI prose scattered through components.

Optimistic updates are limited to reversible preference-like changes. Scan confirmation, ratings, catalog writes, identity changes, and account operations report success only after persistence.

Previously viewed catalog and collection data may be cached for offline reading. Queued mutations, when introduced, must be labeled pending, idempotent, and conflict-aware. The core release does not silently pretend an offline write reached the server.

## 9. Error handling and observability

Errors use a shared typed contract:

- validation;
- unauthenticated;
- unauthorized;
- not found;
- conflict or duplicate;
- rate limited;
- provider unavailable;
- provider data invalid;
- configuration missing; and
- unexpected server failure.

The UI maps these codes to concise, actionable messages. Server logs include correlation IDs, module, operation, duration, and safe provider status without including secrets or raw private content. Scan stages record enough metadata to diagnose decoding, provider, matching, and persistence failures separately.

External providers are isolated behind interfaces. Open Food Facts or OpenAI failure can reduce identification capability but cannot directly mutate or corrupt catalog data.

## 10. Testing strategy

### 10.1 Unit tests

Unit tests cover:

- barcode normalization and validation;
- product/alias normalization;
- confidence scoring and candidate ordering;
- provider response parsing;
- rating ranges and primary-rating rules;
- collection state transitions;
- authorization helpers; and
- typed error mapping.

### 10.2 Component and integration tests

Component tests cover camera permission states, upload fallback, candidate selection, confirmation, collection mutations, rating input, navigation, accessibility basics, and offline/error recovery.

Database and policy tests prove:

- owners can access their data;
- unrelated users cannot;
- public catalog data is readable but not writable;
- provisional/private records remain restricted;
- moderator and administrator operations require the correct role; and
- constraints prevent duplicate barcodes and invalid ratings.

External provider calls are mocked only in automated tests and explicit development fixtures.

### 10.3 End-to-end tests

Playwright covers:

1. anonymous onboarding and username selection;
2. session persistence after refresh;
3. barcode/manual fallback lookup;
4. image-to-candidate behavior using a deterministic test provider;
5. scan confirmation and collection persistence;
6. rating creation and update;
7. collection search/filter basics;
8. protected route and authorization behavior;
9. mobile navigation; and
10. core desktop responsiveness.

A separate credentialed smoke test validates live Supabase and provider integration before deployment. Passing mocked tests is not evidence that a live external integration works.

### 10.4 Quality gates

The default CI pipeline must pass:

- formatting checks;
- linting;
- strict TypeScript;
- unit and component tests;
- database/policy tests when their runtime is available;
- core Playwright flows; and
- a production build.

Zero-test runs and skipped required suites do not count as validation.

## 11. Configuration and deployment

The repository will include `.env.example`, setup documentation, database documentation, AI pipeline documentation, and a progress ledger. Required initial configuration is expected to include Supabase public URL/key, server-only Supabase credentials where a privileged operation truly requires them, and an OpenAI server credential. Exact variable names will be selected during implementation and documented once, centrally.

The initial implementation is prepared before connecting a hosted Supabase project. Credentials are entered securely through environment settings, never chat or tracked files. Migrations are applied to a user-controlled Supabase project, and Vercel receives the corresponding environment bindings. Deployment readiness includes migration status, storage policies, authentication settings, redirect origins, and live smoke tests.

## 12. Documentation and progress

Implementation maintains:

- `README.md` for product and common commands;
- `SETUP.md` for local and hosted setup;
- `DATABASE.md` for schema, migrations, and RLS;
- `AI_PIPELINE.md` for providers, matching, confidence, safety, and cost controls;
- `.env.example` for variable names without secret values; and
- `PROJECT_PROGRESS.md` for completed, verified, blocked, and future work.

Documentation distinguishes implemented behavior, configured-but-untested integration, and planned functionality.

## 13. Acceptance criteria for the core release

The core release is accepted when evidence demonstrates that:

1. A new visitor obtains a guest identity and chooses a unique username.
2. The session and user data persist after refresh.
3. The app is usable on representative iPhone-sized, Android-sized, and desktop viewports.
4. The app can be installed as a PWA where browser support permits it.
5. Camera, gallery, and manual barcode fallbacks provide truthful capability/error states.
6. Known barcodes resolve without an AI request.
7. Unknown products can use server-side vision and produce validated candidates.
8. Low-confidence output cannot silently become verified catalog data.
9. A confirmed product can be added to the collection with an explicit status.
10. A user can record tasting history and maintain one current primary rating.
11. Collection and rating data remain after refresh.
12. RLS tests prevent cross-user access and unauthorized catalog mutation.
13. Missing external configuration fails clearly without exposing secrets or simulating success.
14. Required automated quality gates and the production build pass.
15. Setup, migration, deployment, and known limitations are documented.

## 14. Explicit non-goals for the core release

The following remain outside the first delivery unit unless required to validate a core boundary:

- full friend feeds, groups, comments, and collection comparison;
- complete achievement, challenge, XP, and leaderboard systems;
- conversational Energy AI and taste-profile recommendations;
- advanced analytics and yearly recap;
- multiplayer blind taste tests;
- push notification delivery;
- full catalog operations dashboard;
- broad international seed coverage; and
- complete offline mutation synchronization.

These are planned product work, not placeholder features. Their absence from the first release must be visible and honestly documented.

## 15. Assumptions and decisions

- The first audience is a small friend group, but security boundaries are production-oriented.
- Supabase is the required backend and Vercel is the required web deployment target.
- A hosted Supabase project and external credentials will be connected after the application and migrations are prepared.
- The first release includes both barcode lookup and OpenAI vision fallback.
- The architecture is a modular Next.js monolith, not a separate API deployment.
- No existing application code constrains the initial structure.
- The existing checkout is used directly; implementation will not create a separate Git worktree unless explicitly requested.
