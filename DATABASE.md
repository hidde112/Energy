# Database and security model

Supabase PostgreSQL is the system of record. Six ordered migrations define the
core release:

1. `202610080001_core_schema.sql` — enums, profiles/settings/roles, sourced
   catalog, collections, tastings, ratings, scans, rate-limit events, audit
   logs, indexes, and automatic guest-profile creation.
2. `202610080002_core_rls.sql` — enables RLS and defines owner, public-read,
   provisional-write, and moderator boundaries.
3. `202610080003_storage_and_functions.sql` — public catalog images, private
   user photos, MIME/size constraints, and object ownership policies.
4. `202610080004_confirm_scan_and_moderation.sql` — idempotent atomic scan
   confirmation and audited provisional-product correction RPCs.
5. `202610080005_security_and_workflow_hardening.sql` — service-owned scan
   persistence, strict confirmation provenance, null-safe product identity, and
   atomic idempotent rating/tasting mutations.
6. `202610080006_concurrent_identification_and_private_provisionals.sql` —
   owner-scoped provisional identity and barcodes, atomic scan/candidate
   completion, in-flight identification claims, and concurrency-safe quotas.

`supabase/seed.sql` supplies a small sourced catalog for local development.

## Invariants

- `auth.uid()` owns profiles, collections, tastings, ratings, scans, and private photos.
- One current review exists per user/product; tasting sessions preserve history.
- Verified barcode values are globally unique; private provisional barcodes are
  unique within their owner boundary and remain hidden by product RLS.
- Provisional products require provenance and cannot be silently marked verified.
- Catalog moderation requires a moderator/admin role and writes an audit record.
- `confirm_scan` verifies ownership and the server-persisted candidate/source,
  then applies product, collection, tasting, review, and idempotency changes in
  one transaction.
- `save_rating` owns the optional tasting and current-review write in one
  transaction and rejects cross-user or cross-product tasting references.
- Browser clients cannot directly mutate scans, candidates, rate-limit events,
  tastings, or reviews; scoped server/RPC paths own those writes.
- The service-role key is never shipped to the browser.

## Migration workflow

Create forward-only migrations; do not edit an already-applied production
migration. Verify locally:

```bash
npm run db:start
npm run db:reset
npm run test:db
```

The pgTAP suite covers schema constraints, RLS policies and cross-user denial,
storage boundaries, hardened scan provenance, idempotent confirmation, atomic
rating writes, private provisional isolation, atomic identification, rate-limit
consumption, and moderation authorization.

After schema changes, regenerate checked-in application types:

```bash
npx supabase gen types typescript --local > /tmp/database.types.ts
```

Review the generated diff, then replace
`src/lib/supabase/database.types.ts` deliberately. For hosted generation use
`--project-id YOUR_PROJECT_REF` and authenticate through the CLI.

## Production operations

Apply changes with `npx supabase db push`, confirm with
`npx supabase migration list`, and inspect Supabase logs for failed RPCs or RLS
denials. Schedule provider-supported backups and practice restore procedures
before opening access beyond the initial friend group.
