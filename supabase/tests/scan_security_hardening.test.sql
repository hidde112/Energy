begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (
  instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  is_anonymous, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '61000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'hardening@example.test', '{}', '{}',
  true, now(), now()
);

insert into public.products (
  id, brand_id, name, normalized_name, size_ml, verification_status, verified_at
) values (
  '30000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  'Monster Energy Original', 'monster energy original', 500, 'verified', now()
);

insert into public.scans (
  id, user_id, status, input_kind, idempotency_key, matched_product_id,
  provider_usage
) values
  (
    '62000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001',
    'pending', 'image', 'pending-scan', null, '{}'::jsonb
  ),
  (
    '62000000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000001',
    'identified', 'barcode', 'unlisted-product',
    '30000000-0000-0000-0000-000000000001', '{}'::jsonb
  ),
  (
    '62000000-0000-0000-0000-000000000003',
    '61000000-0000-0000-0000-000000000001',
    'identified', 'image', 'spoofed-source', null,
    '{"result":{"requiresCorrection":true}}'::jsonb
  ),
  (
    '62000000-0000-0000-0000-000000000004',
    '61000000-0000-0000-0000-000000000001',
    'identified', 'image', 'dedupe-one', null,
    '{"result":{"requiresCorrection":true}}'::jsonb
  ),
  (
    '62000000-0000-0000-0000-000000000005',
    '61000000-0000-0000-0000-000000000001',
    'identified', 'image', 'dedupe-two', null,
    '{"result":{"requiresCorrection":true}}'::jsonb
  ),
  (
    '62000000-0000-0000-0000-000000000006',
    '61000000-0000-0000-0000-000000000001',
    'identified', 'barcode', 'external-product', null,
    '{
      "result": {
        "requiresCorrection": false,
        "externalProduct": {
          "barcode": {"value":"12345670","format":"EAN-8"},
          "name": "Night Charge External",
          "brand": "Pulse External",
          "sizeMl": 330,
          "imageUrl": "https://images.openfoodfacts.org/night-charge.jpg",
          "ingredients": "Water, caffeine",
          "caffeineMgPer100Ml": 32,
          "sugarGPer100Ml": 10,
          "caloriesPer100Ml": 42,
          "source": {
            "provider": "open_food_facts",
            "url": "https://world.openfoodfacts.org/product/12345670",
            "license": "ODbL 1.0",
            "recordId": "12345670"
          }
        }
      }
    }'::jsonb
  );

insert into public.scan_candidates (scan_id, product_id, position, score, confidence)
values (
  '62000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001', 1, 1, 'high'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

create function pg_temp.direct_scan_write_is_denied()
returns boolean language plpgsql as $$
begin
  insert into public.scans (user_id, input_kind, idempotency_key)
  values ('61000000-0000-0000-0000-000000000001', 'barcode', 'forged');
  return false;
exception when insufficient_privilege then return true;
end;
$$;

select ok(pg_temp.direct_scan_write_is_denied(), 'guests cannot forge scan rows');

create function pg_temp.pending_confirmation_is_denied()
returns boolean language plpgsql as $$
begin
  perform public.confirm_scan(
    '62000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001',
    '{"product_id":"30000000-0000-0000-0000-000000000001"}'::jsonb,
    'pending-confirm'
  );
  return false;
exception when insufficient_privilege then return true;
end;
$$;

select ok(pg_temp.pending_confirmation_is_denied(), 'pending scans cannot be confirmed');

create function pg_temp.unlisted_product_is_denied()
returns boolean language plpgsql as $$
begin
  perform public.confirm_scan(
    '62000000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000001',
    '{"product_id":"30000000-0000-0000-0000-000000000002"}'::jsonb,
    'unlisted-confirm'
  );
  return false;
exception when insufficient_privilege then return true;
end;
$$;

select ok(pg_temp.unlisted_product_is_denied(), 'confirmation is limited to persisted matches');

select lives_ok(
  $$
    select public.confirm_scan(
      '62000000-0000-0000-0000-000000000003',
      '61000000-0000-0000-0000-000000000001',
      '{
        "provisional_product": {
          "brand_name": "Renamed by guest",
          "normalized_brand_name": "red bull",
          "name": "Guest Correction",
          "normalized_name": "guest correction",
          "source_kind": "manufacturer",
          "source_url": "https://attacker.invalid",
          "field_names": ["brand", "name"]
        }
      }'::jsonb,
      'spoofed-confirm'
    )
  $$,
  'a permitted low-confidence correction can be confirmed'
);

select is(
  (select name from public.brands where normalized_name = 'red bull'),
  'Red Bull',
  'guest correction cannot rename an existing global brand'
);
select is(
  (
    select source_kind::text from public.product_sources ps
    join public.products p on p.id = ps.product_id
    where p.name = 'Guest Correction'
  ),
  'user',
  'client-supplied provider provenance is replaced with user provenance'
);

select public.confirm_scan(
  '62000000-0000-0000-0000-000000000004',
  '61000000-0000-0000-0000-000000000001',
  '{"provisional_product":{"brand_name":"Null Size","normalized_brand_name":"null size","name":"Same Can","normalized_name":"same can","source_kind":"user","field_names":["brand","name"]}}'::jsonb,
  'dedupe-confirm-one'
);
select public.confirm_scan(
  '62000000-0000-0000-0000-000000000005',
  '61000000-0000-0000-0000-000000000001',
  '{"provisional_product":{"brand_name":"Null Size","normalized_brand_name":"null size","name":"Same Can","normalized_name":"same can","source_kind":"user","field_names":["brand","name"]}}'::jsonb,
  'dedupe-confirm-two'
);

select is(
  (select count(*) from public.products where normalized_name = 'same can'),
  1::bigint,
  'null-sized provisional products are deduplicated canonically'
);

select lives_ok(
  $$
    select public.confirm_scan(
      '62000000-0000-0000-0000-000000000006',
      '61000000-0000-0000-0000-000000000001',
      '{"provisional_product":{"brand_name":"Spoofed","name":"Spoofed","source_kind":"user","field_names":["name"]}}'::jsonb,
      'external-confirm'
    )
  $$,
  'persisted external provider data can be confirmed'
);
select is(
  (
    select ps.source_kind::text from public.product_sources ps
    join public.products p on p.id = ps.product_id
    where p.name = 'Night Charge External'
  ),
  'open_food_facts',
  'external provenance is derived from the persisted scan'
);
select is(
  (
    select pb.barcode from public.product_barcodes pb
    join public.products p on p.id = pb.product_id
    where p.name = 'Night Charge External'
  ),
  '12345670',
  'external barcode metadata is retained'
);

select is(
  (select count(*) from public.scan_confirmations where user_id = '61000000-0000-0000-0000-000000000001'),
  4::bigint,
  'only authorized confirmations are persisted'
);

select * from finish();
rollback;
