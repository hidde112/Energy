begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select has_function(
  'public', 'save_rating', array['uuid', 'jsonb', 'text'],
  'atomic rating workflow exists'
);

insert into auth.users (
  instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  is_anonymous, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '71000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'rating@example.test', '{}', '{}',
  true, now(), now()
);

insert into public.products (
  id, brand_id, name, normalized_name, size_ml, verification_status, verified_at
) values (
  '30000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  'Monster Energy Original', 'monster energy original', 500, 'verified', now()
);

insert into public.tasting_sessions (id, user_id, product_id)
values (
  '72000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001'
);

create function pg_temp.mismatched_tasting_is_denied()
returns boolean language plpgsql as $$
begin
  insert into public.reviews (
    user_id, product_id, tasting_session_id, rating
  ) values (
    '71000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    '72000000-0000-0000-0000-000000000001',
    7
  );
  return false;
exception when foreign_key_violation then return true;
end;
$$;

select ok(
  pg_temp.mismatched_tasting_is_denied(),
  'a review cannot reference another product tasting'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

create function pg_temp.direct_tasting_write_is_denied()
returns boolean language plpgsql as $$
begin
  insert into public.tasting_sessions (user_id, product_id)
  values (
    '71000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001'
  );
  return false;
exception when insufficient_privilege then return true;
end;
$$;

select ok(pg_temp.direct_tasting_write_is_denied(), 'tasting history is RPC-only');

create function pg_temp.direct_review_write_is_denied()
returns boolean language plpgsql as $$
begin
  insert into public.reviews (user_id, product_id, rating)
  values (
    '71000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', 5
  );
  return false;
exception when insufficient_privilege then return true;
end;
$$;

select ok(pg_temp.direct_review_write_is_denied(), 'current reviews are RPC-only');

create temporary table first_rating as
select public.save_rating(
  '71000000-0000-0000-0000-000000000001',
  '{
    "product_id":"30000000-0000-0000-0000-000000000001",
    "rating":8.5,
    "record_tasting":true,
    "body":"Crisp"
  }'::jsonb,
  'rating-idempotency-key'
) as result;

select isnt(
  (select result ->> 'tastingSessionId' from first_rating),
  null,
  'atomic save returns a tasting session'
);
select is(
  (select count(*) from public.tasting_sessions where id <> '72000000-0000-0000-0000-000000000001'),
  1::bigint,
  'atomic save records one tasting'
);
select is(
  (select rating from public.reviews where product_id = '30000000-0000-0000-0000-000000000001'),
  8.5::numeric,
  'atomic save upserts the current rating'
);
select is(
  public.save_rating(
    '71000000-0000-0000-0000-000000000001',
    '{"product_id":"30000000-0000-0000-0000-000000000001","rating":1,"record_tasting":true}'::jsonb,
    'rating-idempotency-key'
  ),
  (select result from first_rating),
  'retry returns the original atomic result'
);
select is(
  (select count(*) from public.tasting_sessions where id <> '72000000-0000-0000-0000-000000000001'),
  1::bigint,
  'retry does not duplicate tasting history'
);

select * from finish();
rollback;
