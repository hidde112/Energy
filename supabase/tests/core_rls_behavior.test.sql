begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  is_anonymous,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '41000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'owner@example.test',
    '{}'::jsonb,
    '{}'::jsonb,
    true,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '41000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'other@example.test',
    '{}'::jsonb,
    '{}'::jsonb,
    true,
    now(),
    now()
  );

update public.profiles
set username = case
  when user_id = '41000000-0000-0000-0000-000000000001' then 'owner_user'
  else 'other_user'
end
where user_id in (
  '41000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000002'
);

insert into public.app_user_roles (user_id, role)
values ('41000000-0000-0000-0000-000000000002', 'moderator');

insert into public.products (
  id,
  brand_id,
  created_by,
  name,
  normalized_name,
  size_ml,
  verification_status
)
values
  (
    '42000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    'Owner provisional',
    'owner provisional',
    250,
    'provisional'
  ),
  (
    '42000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000002',
    'Other provisional',
    'other provisional',
    250,
    'provisional'
  );

insert into public.product_sources (product_id, source_kind, field_names)
values
  ('42000000-0000-0000-0000-000000000001', 'user', array['name']),
  ('42000000-0000-0000-0000-000000000002', 'user', array['name']);

insert into public.user_collections (user_id, product_id, status)
values
  (
    '41000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'tried'
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    'favorite'
  );

insert into public.audit_logs (actor_id, action, entity_type)
values ('41000000-0000-0000-0000-000000000002', 'product.corrected', 'product');

set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is((select count(*) from public.profiles), 1::bigint, 'owner sees only own profile');
select is(
  (select username::text from public.profiles limit 1),
  'owner_user',
  'unrelated profile is hidden'
);
select is(
  (select count(*) from public.user_collections),
  1::bigint,
  'owner sees only own collection rows'
);
select is(
  (select count(*) from public.products where verification_status = 'verified'),
  1::bigint,
  'verified catalog product is visible'
);
select is(
  (select count(*) from public.products where id = '42000000-0000-0000-0000-000000000001'),
  1::bigint,
  'owner sees own provisional product'
);
select is(
  (select count(*) from public.products where id = '42000000-0000-0000-0000-000000000002'),
  0::bigint,
  'owner cannot see another user provisional product'
);
select is((select count(*) from public.audit_logs), 0::bigint, 'regular user cannot read audit logs');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select is((select count(*) from public.audit_logs), 1::bigint, 'moderator can read audit logs');

select * from finish();
rollback;
