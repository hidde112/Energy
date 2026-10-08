insert into public.categories (id, name, slug)
values ('10000000-0000-0000-0000-000000000001', 'Energy drink', 'energy-drink')
on conflict (id) do nothing;

insert into public.brands (id, name, normalized_name, slug, country_code, website_url)
values
  (
    '20000000-0000-0000-0000-000000000001',
    'Red Bull',
    'red bull',
    'red-bull',
    'AT',
    'https://www.redbull.com/'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'Monster Energy',
    'monster energy',
    'monster-energy',
    'US',
    'https://www.monsterenergy.com/'
  )
on conflict (id) do nothing;

insert into public.products (
  id,
  brand_id,
  category_id,
  name,
  normalized_name,
  variant,
  size_ml,
  verification_status,
  verified_at
)
values (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Red Bull Energy Drink',
  'red bull energy drink',
  'Original',
  250,
  'verified',
  timezone('utc', now())
)
on conflict (id) do nothing;

insert into public.product_barcodes (product_id, barcode, format, country_code)
values (
  '30000000-0000-0000-0000-000000000001',
  '9002490100070',
  'EAN-13',
  'AT'
)
on conflict do nothing;

insert into public.product_sources (
  product_id,
  source_kind,
  source_url,
  field_names,
  license
)
values (
  '30000000-0000-0000-0000-000000000001',
  'manufacturer',
  'https://www.redbull.com/',
  array['brand', 'name', 'variant', 'size_ml'],
  'Source metadata only; image reuse not implied.'
);
