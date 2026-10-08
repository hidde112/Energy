begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (
  instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  is_anonymous, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '63000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'isolation-one@example.test', '{}', '{}',
    true, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '63000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'isolation-two@example.test', '{}', '{}',
    true, now(), now()
  );

insert into public.scans (
  id, user_id, status, input_kind, idempotency_key, provider_usage
) values
  (
    '64000000-0000-0000-0000-000000000001',
    '63000000-0000-0000-0000-000000000001',
    'identified', 'image', 'verified-shadow',
    '{"result":{"requiresCorrection":true}}'::jsonb
  ),
  (
    '64000000-0000-0000-0000-000000000002',
    '63000000-0000-0000-0000-000000000001',
    'identified', 'image', 'shared-correction-one',
    '{"result":{"requiresCorrection":true}}'::jsonb
  ),
  (
    '64000000-0000-0000-0000-000000000003',
    '63000000-0000-0000-0000-000000000002',
    'identified', 'image', 'shared-correction-two',
    '{"result":{"requiresCorrection":true}}'::jsonb
  ),
  (
    '64000000-0000-0000-0000-000000000004',
    '63000000-0000-0000-0000-000000000001',
    'identified', 'barcode', 'shared-off-one',
    '{
      "result": {
        "externalProduct": {
          "barcode": {"value":"23456784","format":"EAN-8"},
          "name": "Shared OFF Can",
          "brand": "Shared OFF Brand",
          "sizeMl": 330,
          "imageUrl": null,
          "ingredients": "Water",
          "caffeineMgPer100Ml": 32,
          "sugarGPer100Ml": 8,
          "caloriesPer100Ml": 34,
          "source": {
            "provider": "open_food_facts",
            "url": "https://world.openfoodfacts.org/product/23456784",
            "license": "ODbL 1.0",
            "recordId": "23456784"
          }
        }
      }
    }'::jsonb
  ),
  (
    '64000000-0000-0000-0000-000000000005',
    '63000000-0000-0000-0000-000000000002',
    'identified', 'barcode', 'shared-off-two',
    '{
      "result": {
        "externalProduct": {
          "barcode": {"value":"23456784","format":"EAN-8"},
          "name": "Shared OFF Can",
          "brand": "Shared OFF Brand",
          "sizeMl": 330,
          "imageUrl": null,
          "ingredients": "Water",
          "caffeineMgPer100Ml": 32,
          "sugarGPer100Ml": 8,
          "caloriesPer100Ml": 34,
          "source": {
            "provider": "open_food_facts",
            "url": "https://world.openfoodfacts.org/product/23456784",
            "license": "ODbL 1.0",
            "recordId": "23456784"
          }
        }
      }
    }'::jsonb
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '63000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"63000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select public.confirm_scan(
  '64000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000001',
  '{
    "provisional_product": {
      "brand_name": "Red Bull",
      "name": "Red Bull Energy Drink",
      "size_ml": 250,
      "barcode": "12345670",
      "barcode_format": "EAN-8",
      "source_kind": "user",
      "field_names": ["brand", "name"]
    },
    "collection_status": "tried"
  }'::jsonb,
  'verified-shadow-confirm'
);

select is(
  (select count(*) from public.product_barcodes where barcode = '12345670'),
  0::bigint,
  'a guest correction cannot attach a barcode to a verified product'
);
select is(
  (
    select count(*) from public.product_sources
    where product_id = '30000000-0000-0000-0000-000000000001'
      and source_kind = 'user'
  ),
  0::bigint,
  'a guest correction cannot attach provenance to a verified product'
);

create temporary table first_private as
select public.confirm_scan(
  '64000000-0000-0000-0000-000000000002',
  '63000000-0000-0000-0000-000000000001',
  '{
    "provisional_product": {
      "brand_name": "Private Brand",
      "name": "Private Can",
      "source_kind": "user",
      "field_names": ["brand", "name"]
    },
    "collection_status": "tried"
  }'::jsonb,
  'private-one-confirm'
) as result;

select public.confirm_scan(
  '64000000-0000-0000-0000-000000000004',
  '63000000-0000-0000-0000-000000000001',
  '{"provisional_product":{"brand_name":"ignored","name":"ignored","source_kind":"user","field_names":["name"]},"collection_status":"tried"}'::jsonb,
  'off-one-confirm'
);

select set_config('request.jwt.claim.sub', '63000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"63000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

create temporary table second_private as
select public.confirm_scan(
  '64000000-0000-0000-0000-000000000003',
  '63000000-0000-0000-0000-000000000002',
  '{
    "provisional_product": {
      "brand_name": "Private Brand",
      "name": "Private Can",
      "source_kind": "user",
      "field_names": ["brand", "name"]
    },
    "collection_status": "tried"
  }'::jsonb,
  'private-two-confirm'
) as result;

select isnt(
  (select result ->> 'productId' from first_private),
  (select result ->> 'productId' from second_private),
  'different owners receive distinct private provisional products'
);
select is(
  (
    select count(*)
    from public.user_collections collections
    join public.products products on products.id = collections.product_id
    where collections.user_id = '63000000-0000-0000-0000-000000000002'
      and products.normalized_name = 'private can'
  ),
  1::bigint,
  'the second owner can read their provisional collection entry'
);

select lives_ok(
  $$
    select public.confirm_scan(
      '64000000-0000-0000-0000-000000000005',
      '63000000-0000-0000-0000-000000000002',
      '{"provisional_product":{"brand_name":"ignored","name":"ignored","source_kind":"user","field_names":["name"]},"collection_status":"tried"}'::jsonb,
      'off-two-confirm'
    )
  $$,
  'two owners can independently confirm the same Open Food Facts barcode'
);

reset role;

select is(
  (
    select count(*) from public.products
    where normalized_name = 'private can' and verification_status = 'provisional'
  ),
  2::bigint,
  'private provisional identity is unique per owner'
);
select is(
  (
    select count(*) from public.products
    where normalized_name = 'shared off can' and verification_status = 'provisional'
  ),
  2::bigint,
  'Open Food Facts provisional products stay private per owner'
);
select is(
  (select count(*) from public.product_barcodes where barcode = '23456784'),
  2::bigint,
  'the same provisional barcode can be retained once per owner'
);
select is(
  (
    select count(distinct owner_id)
    from public.product_barcodes where barcode = '23456784'
  ),
  2::bigint,
  'provisional barcode associations record distinct owners'
);

select * from finish();
rollback;
