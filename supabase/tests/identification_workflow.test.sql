begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (
  instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  is_anonymous, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '65000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'workflow@example.test', '{}', '{}',
  true, now(), now()
);

create temporary table first_claim as
select public.claim_identification(
  '65000000-0000-0000-0000-000000000001',
  'image',
  'workflow-key',
  null,
  'workflow-fingerprint',
  '66000000-0000-0000-0000-000000000001'
) as result;

select is(
  (select result ->> 'state' from first_claim),
  'claimed',
  'the first request claims identification work'
);
select is(
  (
    select status::text from public.scans
    where id = '66000000-0000-0000-0000-000000000001'
  ),
  'pending',
  'a claim persists a pending scan before provider work'
);
select is(
  public.claim_identification(
    '65000000-0000-0000-0000-000000000001',
    'image',
    'workflow-key',
    null,
    'workflow-fingerprint',
    '66000000-0000-0000-0000-000000000002'
  ) ->> 'state',
  'in_progress',
  'a concurrent idempotency retry does not claim duplicate provider work'
);

create function pg_temp.invalid_completion_rolls_back()
returns boolean
language plpgsql
as $$
begin
  perform public.complete_identification(
    '66000000-0000-0000-0000-000000000001',
    '65000000-0000-0000-0000-000000000001',
    '{"scanId":"66000000-0000-0000-0000-000000000001","source":"vision","confidence":"medium","candidates":[],"externalProduct":null,"requiresCorrection":false}'::jsonb,
    '{"brand":"Test","productName":"Test","visibleText":[]}'::jsonb,
    '[{"product_id":"99999999-9999-9999-9999-999999999999","position":1,"score":0.7,"confidence":"medium","hypothesis":{}}]'::jsonb
  );
  return false;
exception when foreign_key_violation then
  return (
    select status = 'pending'
    from public.scans where id = '66000000-0000-0000-0000-000000000001'
  ) and not exists (
    select 1 from public.scan_candidates
    where scan_id = '66000000-0000-0000-0000-000000000001'
  );
end;
$$;

select ok(
  pg_temp.invalid_completion_rolls_back(),
  'scan and candidate completion roll back together on candidate failure'
);

select public.complete_identification(
  '66000000-0000-0000-0000-000000000001',
  '65000000-0000-0000-0000-000000000001',
  '{"scanId":"66000000-0000-0000-0000-000000000001","source":"vision","confidence":"high","candidates":[],"externalProduct":null,"requiresCorrection":false}'::jsonb,
  '{"brand":"Red Bull","productName":"Energy Drink","visibleText":[]}'::jsonb,
  '[{"product_id":"30000000-0000-0000-0000-000000000001","position":1,"score":1,"confidence":"high","hypothesis":{}}]'::jsonb
);

select is(
  (
    select status::text from public.scans
    where id = '66000000-0000-0000-0000-000000000001'
  ),
  'identified',
  'successful atomic completion marks the scan identified'
);
select is(
  (
    select count(*) from public.scan_candidates
    where scan_id = '66000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'successful atomic completion persists candidates'
);
select is(
  public.claim_identification(
    '65000000-0000-0000-0000-000000000001',
    'image',
    'workflow-key',
    null,
    'workflow-fingerprint',
    '66000000-0000-0000-0000-000000000003'
  ) ->> 'state',
  'existing',
  'a completed idempotency retry returns the stored result'
);

select ok(
  public.consume_rate_limit(
    '65000000-0000-0000-0000-000000000001', 'identify', 2, 3600000
  ),
  'the first atomic rate-limit slot is consumed'
);
select ok(
  public.consume_rate_limit(
    '65000000-0000-0000-0000-000000000001', 'identify', 2, 3600000
  ),
  'the second atomic rate-limit slot is consumed'
);
select isnt(
  public.consume_rate_limit(
    '65000000-0000-0000-0000-000000000001', 'identify', 2, 3600000
  ),
  true,
  'the atomic rate limiter rejects work beyond the quota'
);
select is(
  (
    select count(*) from public.rate_limit_events
    where user_id = '65000000-0000-0000-0000-000000000001'
      and action = 'identify'
  ),
  2::bigint,
  'rejected work does not create an extra rate event'
);

select * from finish();
rollback;
