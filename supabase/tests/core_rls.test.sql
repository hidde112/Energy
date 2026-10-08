begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_settings'::regclass),
  'user_settings has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_collections'::regclass),
  'user_collections has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.tasting_sessions'::regclass),
  'tasting_sessions has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.reviews'::regclass),
  'reviews has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.scans'::regclass),
  'scans has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.products'::regclass),
  'products has RLS enabled'
);

select policies_are(
  'public',
  'profiles',
  array['profiles_select_own', 'profiles_update_own'],
  'profiles exposes only owner policies'
);
select policies_are(
  'public',
  'user_collections',
  array['collections_delete_own', 'collections_insert_own', 'collections_select_own', 'collections_update_own'],
  'collection policies are owner-scoped'
);
select policies_are(
  'public',
  'products',
  array['products_insert_provisional', 'products_select_visible'],
  'catalog policies expose verified products and owned provisional products'
);
select policies_are(
  'public',
  'audit_logs',
  array['audit_logs_select_moderator'],
  'audit logs are moderator-only'
);
select policies_are(
  'public',
  'product_barcodes',
  array['product_barcodes_select_visible'],
  'barcode reads follow visible products'
);

select * from finish();
rollback;
