# Identification pipeline

ENERGYDEX uses the least expensive trustworthy path first.

1. The camera attempts EAN-8, EAN-13, or UPC capture; gallery and manual entry
   remain available.
2. A normalized barcode is checked against the internal catalog.
3. Unknown barcodes use Open Food Facts and retain source metadata.
4. Images are resized/normalized and fingerprinted before a server-only OpenAI
   multimodal request.
5. The response must match the Zod contract. Invalid or unavailable provider
   output becomes a typed error, not a guessed product.
6. Brand, name, flavor, variant, size, aliases, and barcode signals rank internal
   candidates. High confidence returns one suggestion, medium up to three, and
   low confidence requires explicit correction.
7. Server-owned scan/candidate rows preserve the identification decision.
   Confirmation is an ownership-checked, idempotent database transaction that
   only accepts the persisted match, candidate, or correction path.

## Truthfulness and provenance

Every catalog field can retain provider/source information. New AI/user-derived
records are provisional. Only authorized moderation can correct or verify them,
and correction writes an audit log. A low-confidence match never silently
becomes verified data.

## Cost and abuse controls

- Known barcodes never invoke vision.
- Identification results and image hypotheses are cached per user/fingerprint.
- A database-backed claim coordinates matching idempotency keys and image
  fingerprints across server instances before provider work starts.
- Scan state and every authorized candidate are committed in one transaction.
- Images are validated, resized, and bounded before provider submission.
- Database-backed rate limits consume quota under a per-user/action lock.
- Provider requests use a 15-second deadline and propagate abort signals.
- The E2E suite uses `ENERGYDEX_E2E=1`, an explicit deterministic server harness
  that is isolated from production configuration and makes no provider calls.
  It is UI-contract coverage, not a hosted provider/database integration test.

## Failure behavior

Provider outages return RFC-style problem details with a correlation ID. The
capture UI resets after failure so camera, gallery, and manual barcode recovery
remain usable. Missing credentials fail as configuration errors; there is no
production demo fallback.

## Live validation

`npm run test:smoke-live` validates the deployed application and manifest, then
uses an authenticated browser cookie to exercise the deployed barcode-identify
and confirmation routes, owner RLS, and provider credentials without making a
paid vision request. It creates and cleans up temporary records. A real
image-recognition check should be performed manually after budget/retention
approval using a non-sensitive can image, then verified against logs and the
provisional-data rules above.
