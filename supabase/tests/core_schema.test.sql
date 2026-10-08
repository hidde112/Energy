begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'user_settings', 'user_settings exists');
select has_table('public', 'brands', 'brands exists');
select has_table('public', 'products', 'products exists');
select has_table('public', 'product_aliases', 'product_aliases exists');
select has_table('public', 'product_barcodes', 'product_barcodes exists');
select has_table('public', 'product_images', 'product_images exists');
select has_table('public', 'product_sources', 'product_sources exists');
select has_table('public', 'categories', 'categories exists');
select has_table('public', 'flavor_tags', 'flavor_tags exists');
select has_table('public', 'product_flavors', 'product_flavors exists');
select has_table('public', 'user_collections', 'user_collections exists');
select has_table('public', 'tasting_sessions', 'tasting_sessions exists');
select has_table('public', 'reviews', 'reviews exists');
select has_table('public', 'scans', 'scans exists');
select has_table('public', 'scan_candidates', 'scan_candidates exists');
select has_table('public', 'scan_confirmations', 'scan confirmations exist');
select has_table('public', 'audit_logs', 'audit_logs exists');
select has_table('public', 'app_user_roles', 'app_user_roles exists');

select has_pk('public', 'profiles', 'profiles has a primary key');
select has_pk('public', 'products', 'products has a primary key');
select col_is_unique('public', 'profiles', 'username', 'usernames are unique');
select index_is_unique(
  'public',
  'product_barcodes',
  'product_barcodes_owner_value_idx',
  'barcodes are unique globally or per private provisional owner'
);
select col_is_unique(
  'public',
  'user_collections',
  array['user_id', 'product_id'],
  'collection rows are unique per user and product'
);
select col_is_unique(
  'public',
  'reviews',
  array['user_id', 'product_id'],
  'current reviews are unique per user and product'
);
select col_has_check(
  'public',
  'reviews',
  'rating',
  'reviews validates rating range and increments'
);
select col_has_check(
  'public',
  'product_barcodes',
  'barcode',
  'barcodes validate normalized digits'
);
select has_function('public', 'handle_new_user', array[]::text[], 'new users receive a profile');
select has_function('public', 'is_moderator', array[]::text[], 'moderator helper exists');
select has_function(
  'public',
  'confirm_scan',
  array['uuid', 'uuid', 'jsonb', 'text'],
  'atomic scan confirmation function exists'
);
select has_trigger(
  'public',
  'products',
  'products_require_source',
  'provisional products require source provenance before commit'
);

select * from finish();
rollback;
