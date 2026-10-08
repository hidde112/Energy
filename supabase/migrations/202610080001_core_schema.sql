create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.app_role as enum ('user', 'moderator', 'admin');
create type public.collection_status as enum (
  'tried',
  'want_to_try',
  'favorite',
  'disliked',
  'collected_physical',
  'want_to_buy',
  'archived'
);
create type public.product_verification_status as enum (
  'provisional',
  'community_confirmed',
  'verified',
  'rejected'
);
create type public.scan_status as enum ('pending', 'identified', 'confirmed', 'failed');
create type public.source_kind as enum (
  'internal',
  'open_food_facts',
  'manufacturer',
  'user',
  'openai'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username extensions.citext unique,
  display_name text,
  avatar_path text,
  bio text,
  preferred_locale text not null default 'en' check (preferred_locale in ('en', 'nl')),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (
    username is null or username::text ~ '^[a-z0-9][a-z0-9_]{2,29}$'
  )
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  profile_visibility text not null default 'private' check (
    profile_visibility in ('public', 'friends', 'private')
  ),
  notifications jsonb not null default '{}'::jsonb,
  app_lock_timeout_minutes integer check (app_lock_timeout_minutes between 1 and 1440),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.app_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, role)
);

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_user_roles
    where user_id = auth.uid()
      and role in ('moderator', 'admin')
  );
$$;

create table public.brands (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  slug text not null unique,
  country_code text,
  website_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.flavor_tags (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  normalized_name text not null,
  flavor text,
  product_line text,
  variant text,
  size_ml integer check (size_ml is null or size_ml > 0),
  is_sugar_free boolean,
  caffeine_mg_per_100ml numeric(7, 2) check (
    caffeine_mg_per_100ml is null or caffeine_mg_per_100ml >= 0
  ),
  sugar_g_per_100ml numeric(7, 2) check (sugar_g_per_100ml is null or sugar_g_per_100ml >= 0),
  calories_per_100ml numeric(7, 2) check (
    calories_per_100ml is null or calories_per_100ml >= 0
  ),
  sweeteners text[],
  ingredients text,
  description text,
  country_code text,
  regional_availability text[],
  is_limited_edition boolean,
  is_discontinued boolean,
  introduced_year integer check (
    introduced_year is null or introduced_year between 1900 and 2100
  ),
  verification_status public.product_verification_status not null default 'provisional',
  verified_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (brand_id, normalized_name, size_ml)
);

create index products_search_idx on public.products using gin (
  (normalized_name || ' ' || coalesce(flavor, '') || ' ' || coalesce(product_line, '')) extensions.gin_trgm_ops
);
create index products_brand_idx on public.products (brand_id, verification_status);

create table public.product_aliases (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  locale text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (product_id, normalized_alias)
);
create index product_aliases_lookup_idx on public.product_aliases (normalized_alias);

create table public.product_barcodes (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  barcode text not null unique,
  format text not null check (format in ('EAN-8', 'EAN-13', 'UPC-A')),
  country_code text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint product_barcodes_digits check (barcode ~ '^[0-9]{8}$|^[0-9]{12,13}$')
);

create table public.product_images (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  source_kind public.source_kind not null,
  storage_path text,
  external_url text,
  source_url text,
  license text,
  alt_text text,
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint product_images_location check (
    (storage_path is not null)::integer + (external_url is not null)::integer = 1
  )
);
create unique index product_images_one_primary_idx
  on public.product_images (product_id)
  where is_primary;

create table public.product_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  source_kind public.source_kind not null,
  source_url text,
  provider_record_id text,
  field_names text[] not null default '{}',
  license text,
  confidence numeric(4, 3) check (confidence is null or confidence between 0 and 1),
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.require_provisional_product_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.products
    where id = new.id and verification_status = 'provisional'
  ) and not exists (
    select 1
    from public.product_sources
    where product_id = new.id
  ) then
    raise exception 'provisional product % requires source provenance', new.id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create constraint trigger products_require_source
  after insert or update of verification_status on public.products
  deferrable initially deferred
  for each row execute function public.require_provisional_product_source();

create table public.product_flavors (
  product_id uuid not null references public.products(id) on delete cascade,
  flavor_tag_id uuid not null references public.flavor_tags(id) on delete cascade,
  primary key (product_id, flavor_tag_id)
);

create table public.user_collections (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  status public.collection_status not null,
  note text,
  added_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, product_id)
);
create index user_collections_user_status_idx on public.user_collections (user_id, status);

create table public.tasting_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  tasted_at timestamptz not null default timezone('utc', now()),
  location text,
  price numeric(10, 2) check (price is null or price >= 0),
  currency text,
  store text,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);
create index tasting_sessions_user_product_idx
  on public.tasting_sessions (user_id, product_id, tasted_at desc);

create table public.reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  tasting_session_id uuid references public.tasting_sessions(id) on delete set null,
  rating numeric(3, 1) not null,
  taste_rating numeric(3, 1),
  sweetness_rating numeric(3, 1),
  freshness_rating numeric(3, 1),
  aftertaste_rating numeric(3, 1),
  design_rating numeric(3, 1),
  value_rating numeric(3, 1),
  body text,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, product_id),
  constraint reviews_rating_valid check (
    rating between 0.5 and 10.0 and mod(rating * 2, 1) = 0
  ),
  constraint reviews_dimensions_valid check (
    (taste_rating is null or taste_rating between 0.5 and 10.0)
    and (sweetness_rating is null or sweetness_rating between 0.5 and 10.0)
    and (freshness_rating is null or freshness_rating between 0.5 and 10.0)
    and (aftertaste_rating is null or aftertaste_rating between 0.5 and 10.0)
    and (design_rating is null or design_rating between 0.5 and 10.0)
    and (value_rating is null or value_rating between 0.5 and 10.0)
  )
);

create table public.scans (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.scan_status not null default 'pending',
  input_kind text not null check (input_kind in ('barcode', 'image', 'camera-frame')),
  barcode text,
  image_path text,
  image_fingerprint text,
  matched_product_id uuid references public.products(id) on delete set null,
  idempotency_key text not null,
  provider_usage jsonb not null default '{}'::jsonb,
  failure_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, idempotency_key)
);
create index scans_user_created_idx on public.scans (user_id, created_at desc);
create index scans_fingerprint_idx on public.scans (image_fingerprint) where image_fingerprint is not null;

create table public.scan_candidates (
  id uuid primary key default extensions.gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  position smallint not null check (position between 1 and 3),
  score numeric(5, 4) not null check (score between 0 and 1),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  hypothesis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (scan_id, position)
);

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  action text not null,
  occurred_at timestamptz not null default timezone('utc', now())
);
create index rate_limit_events_lookup_idx on public.rate_limit_events (user_id, action, occurred_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  correlation_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (user_id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.app_user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();
create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();
create trigger collections_set_updated_at
  before update on public.user_collections
  for each row execute function public.set_updated_at();
create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();
create trigger scans_set_updated_at
  before update on public.scans
  for each row execute function public.set_updated_at();
