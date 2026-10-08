begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (
  instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  is_anonymous, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '51000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'confirm@example.test', '{}', '{}', true, now(), now()
);

insert into public.scans (
  id, user_id, status, input_kind, barcode, idempotency_key,
  matched_product_id, provider_usage
)
values
  (
    '52000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001',
    'identified', 'barcode', '9002490100070', 'identify-existing',
    '30000000-0000-0000-0000-000000000001', '{}'::jsonb
  ),
  (
    '52000000-0000-0000-0000-000000000002',
    '51000000-0000-0000-0000-000000000001',
    'identified', 'image', null, 'identify-new', null,
    '{"result":{"requiresCorrection":true}}'::jsonb
  ),
  (
    '52000000-0000-0000-0000-000000000003',
    '51000000-0000-0000-0000-000000000001',
    'identified', 'barcode', '9002490100070', 'identify-conflict', null,
    '{"result":{"requiresCorrection":true}}'::jsonb
  );

insert into public.scan_candidates (
  scan_id, product_id, position, score, confidence
) values (
  '52000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  1, 1, 'high'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

create temporary table first_confirmation as
select public.confirm_scan(
  '52000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'product_id', '30000000-0000-0000-0000-000000000001',
    'collection_status', 'tried',
    'rating', 8.5,
    'record_tasting', true
  ),
  'confirm-existing'
) as result;

select is(
  (select status::text from public.scans where id = '52000000-0000-0000-0000-000000000001'),
  'confirmed',
  'confirmation marks the scan confirmed'
);
select is((select count(*) from public.user_collections), 1::bigint, 'collection write is committed');
select is((select count(*) from public.tasting_sessions), 1::bigint, 'tasting write is committed');
select is((select rating from public.reviews), 8.5::numeric, 'current review is committed');

select is(
  public.confirm_scan(
    '52000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001',
    '{"product_id":"30000000-0000-0000-0000-000000000001"}'::jsonb,
    'confirm-existing'
  ),
  (select result from first_confirmation),
  'retry returns the original result'
);
select is((select count(*) from public.reviews), 1::bigint, 'retry does not duplicate a review');

select lives_ok(
  $$
    select public.confirm_scan(
      '52000000-0000-0000-0000-000000000002',
      '51000000-0000-0000-0000-000000000001',
      '{
        "provisional_product": {
          "brand_name": "Pulse Labs",
          "normalized_brand_name": "pulse labs",
          "name": "Night Charge",
          "normalized_name": "night charge",
          "size_ml": 330,
          "barcode": "12345670",
          "barcode_format": "EAN-8",
          "source_kind": "user",
          "field_names": ["brand", "name", "size_ml"]
        },
        "collection_status": "want_to_try"
      }'::jsonb,
      'confirm-new'
    )
  $$,
  'provisional product confirmation succeeds with provenance'
);
select is(
  (select verification_status::text from public.products where name = 'Night Charge'),
  'provisional',
  'new scan product remains provisional'
);
select is(
  (select count(*) from public.product_sources ps join public.products p on p.id = ps.product_id where p.name = 'Night Charge'),
  1::bigint,
  'provisional product has a source record'
);
select is(
  (select count(*) from public.scan_confirmations),
  2::bigint,
  'one confirmation receipt is stored per scan'
);

create function pg_temp.duplicate_barcode_rolls_back()
returns boolean
language plpgsql
as $$
begin
  perform public.confirm_scan(
    '52000000-0000-0000-0000-000000000003',
    '51000000-0000-0000-0000-000000000001',
    '{
      "provisional_product": {
        "brand_name": "Duplicate Labs",
        "normalized_brand_name": "duplicate labs",
        "name": "Duplicate Can",
        "normalized_name": "duplicate can",
        "barcode": "9002490100070",
        "barcode_format": "EAN-13",
        "source_kind": "user",
        "field_names": ["name"]
      },
      "collection_status": "tried"
    }'::jsonb,
    'confirm-conflict'
  );
  return false;
exception when unique_violation then
  return not exists (select 1 from public.products where name = 'Duplicate Can')
    and not exists (
      select 1 from public.scan_confirmations
      where scan_id = '52000000-0000-0000-0000-000000000003'
    );
end;
$$;

select ok(
  pg_temp.duplicate_barcode_rolls_back(),
  'duplicate barcode conflicts roll back product and confirmation writes'
);

create function pg_temp.regular_user_is_denied()
returns boolean
language plpgsql
as $$
begin
  perform public.correct_provisional_product(
    (select id from public.products where name = 'Night Charge'),
    '{"name":"Night Charge Corrected","verification_status":"verified"}'::jsonb,
    'regular-denied'
  );
  return false;
exception when insufficient_privilege then
  return true;
end;
$$;

select ok(pg_temp.regular_user_is_denied(), 'non-moderator correction is denied');

reset role;
insert into public.app_user_roles (user_id, role)
values ('51000000-0000-0000-0000-000000000001', 'moderator');
set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  format(
    'select public.correct_provisional_product(%L, %L::jsonb, %L)',
    (select id from public.products where name = 'Night Charge'),
    '{"name":"Night Charge Corrected","normalized_name":"night charge corrected","verification_status":"verified"}',
    'moderator-correction'
  ),
  'moderator can correct a provisional product'
);
select is(
  (select verification_status::text from public.products where name = 'Night Charge Corrected'),
  'verified',
  'moderator correction updates verification state'
);
select is(
  (select count(*) from public.audit_logs where correlation_id = 'moderator-correction'),
  1::bigint,
  'moderator correction writes an audit event'
);

select * from finish();
rollback;
