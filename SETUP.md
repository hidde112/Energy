# ENERGYDEX setup and deployment

## Local development

Install Node.js 22+, npm, and a running Docker engine. Then:

```bash
npm ci
npx supabase start
npx supabase db reset
npx supabase status -o env
cp .env.example .env.local
```

Populate `.env.local` from the Supabase status output:

- `NEXT_PUBLIC_SUPABASE_URL`: local API URL (normally `http://127.0.0.1:54321`)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: local publishable or legacy anon key
- `SUPABASE_SERVICE_ROLE_KEY`: local service-role key; server only
- `OPENAI_API_KEY`: optional for real image identification

Run `npm run dev` and open http://127.0.0.1:3000. Missing public bindings are
reported as configuration errors; `/setup` lists the required bindings.

`npm run db:start` intentionally starts the slim database-only stack used by
pgTAP in constrained CI/cloud environments. Use `npx supabase start` for the
full local application stack (Auth, REST, and Storage included).

## Hosted Supabase

1. Create a Supabase project using PostgreSQL 17.
2. In Authentication settings, enable anonymous sign-ins.
3. Set the Site URL to the production Vercel URL and add preview/production
   callback URLs ending in `/auth/callback` to the redirect allow-list.
4. Link and apply the tracked migrations:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

5. Confirm that `catalog-images` is public and `user-photos` is private. Both
   are created by migration; do not loosen the tracked object policies.
6. Copy the project URL, publishable key, and service-role key directly into
   secure deployment settings. Do not put credentials in Git or chat.

Use `npx supabase migration list` to confirm local and hosted migration history.
Back up production data before destructive schema work; never run `db reset`
against a hosted project.

## OpenAI and product data

Set `OPENAI_API_KEY` only as a server-side Vercel/Supabase environment secret.
Open Food Facts barcode lookup requires no credential. Provider requests use
timeouts, validation, and user-facing fallback errors; see `AI_PIPELINE.md`.

## Vercel

1. Import the repository and select the Next.js framework preset.
2. Use `npm run build` as the build command and Node.js 22 or newer.
3. Configure the four runtime variables from `.env.example` for Preview and
   Production as appropriate. Never set `ENERGYDEX_E2E=1` in Vercel.
4. Add each Vercel origin to the Supabase Auth redirect allow-list.
5. Deploy, then set `ENERGYDEX_LIVE_BASE_URL` locally to the HTTPS deployment.
6. Run `npm run test:smoke-live`. It checks the app, manifest, Supabase Auth,
   REST, and OpenAI credential without issuing a paid vision request.

No hosted credentials are present in this repository, so live smoke testing is
blocked until the project owner supplies those bindings.

## Release checks

```bash
npm ci
npm run db:start
npm run db:reset
npm run verify
```

For Playwright, install Chromium with `npx playwright install chromium` when no
system Chromium is available. CI installs the browser and its OS dependencies.

## Troubleshooting

- Docker image pull failure: verify registry access and retry `npm run db:start`.
- Anonymous sign-in failure: enable anonymous users in hosted Auth settings.
- Camera unavailable: use HTTPS (localhost is exempt), grant permission, or use
  gallery/manual barcode fallback.
- Vision unavailable: verify `OPENAI_API_KEY`; barcode and manual paths remain usable.
- Stale generated types: run the type-generation command in `DATABASE.md` after migrations.
