# ENERGYDEX

**Scan it. Rate it. Collect it.**

ENERGYDEX is a mobile-first energy-drink collector built with Next.js 16,
React 19, Supabase, and a server-side OpenAI vision fallback. The core release
supports anonymous onboarding, a sourced product catalog, barcode-first and
image-assisted identification, atomic collection updates, tasting history,
current ratings, a responsive dashboard, and installable PWA behavior.

## Quick start

Prerequisites: Node.js 22+, npm, Docker, and the Supabase CLI (included as a
development dependency).

```bash
npm ci
npx supabase start
npx supabase status -o env
cp .env.example .env.local
npm run dev
```

Copy the local API URL, publishable/anon key, and service-role key reported by
Supabase into `.env.local`. Add `OPENAI_API_KEY` only when exercising the live
vision provider. Never commit `.env.local` or paste credentials into issues.

Open http://127.0.0.1:3000. See [SETUP.md](SETUP.md) for complete local,
hosted Supabase, and Vercel instructions.

## Commands

```bash
npm run verify       # formatting, lint, types, unit, DB, E2E, production build
npm run verify:app   # app checks without Docker-backed database tests
npm run test:db      # pgTAP schema, RLS, ownership, and RPC checks
npm run test:e2e     # deterministic UI-contract journeys; never calls live providers
npm run test:smoke-live # credentialed hosted Auth/RLS/RPC smoke test
```

The E2E suite enables an explicit test-only provider with `ENERGYDEX_E2E=1` in
the Playwright-managed process. It proves browser journeys and persistence
contracts, not hosted Supabase integration. Do not enable this variable in a
deployed environment. The hosted smoke test creates and then removes a temporary
anonymous user and catalog records; run it only against a prepared environment.

## Documentation

- [SETUP.md](SETUP.md): local setup, hosted services, and deployment
- [DATABASE.md](DATABASE.md): schema, migrations, RLS, storage, and type generation
- [AI_PIPELINE.md](AI_PIPELINE.md): barcode/vision pipeline, confidence, safety, and cost controls
- [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md): delivered scope, verification, blockers, and next releases

## Core-release boundary

Friends/social feeds, account upgrades, passkeys/app lock, advanced analytics,
achievements, full offline mutation sync, and broad catalog coverage are later
delivery units. The current UI labels unavailable social work honestly rather
than simulating it.
