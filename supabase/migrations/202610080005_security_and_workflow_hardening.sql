-- Identification writes are server-owned. Authenticated users may read only
-- their own persisted results and must confirm them through guarded RPCs.
drop policy if exists scans_insert_own on public.scans;
drop policy if exists scans_update_own on public.scans;
drop policy if exists scans_delete_own on public.scans;
revoke insert, update, delete on public.scans from authenticated;
revoke insert, update, delete on public.scan_candidates from authenticated;
revoke insert, update, delete on public.rate_limit_events from authenticated;

-- PostgreSQL treats nulls as distinct in ordinary unique constraints. A can
-- with unknown size still needs one canonical identity.
alter table public.products
  drop constraint if exists products_brand_id_normalized_name_size_ml_key;
create unique index products_canonical_identity_idx
  on public.products (brand_id, normalized_name, size_ml) nulls not distinct;

create or replace function public.confirm_scan(
  p_scan_id uuid,
  p_user_id uuid,
  p_confirmation jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scan public.scans%rowtype;
  v_existing jsonb;
  v_product_id uuid;
  v_brand_id uuid;
  v_collection_id uuid;
  v_tasting_id uuid;
  v_review_id uuid;
  v_product jsonb;
  v_external jsonb;
  v_result jsonb;
  v_rating numeric;
  v_is_provisional boolean := false;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'scan confirmation requires the authenticated owner'
      using errcode = '42501';
  end if;

  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'confirmation idempotency key is required'
      using errcode = '22023';
  end if;

  select result into v_existing
  from public.scan_confirmations
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;

  select * into v_scan
  from public.scans
  where id = p_scan_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'scan not found or not owned by user' using errcode = 'P0002';
  end if;
  if v_scan.status <> 'identified' then
    raise exception 'only an identified scan can be confirmed' using errcode = '42501';
  end if;

  select result into v_existing
  from public.scan_confirmations
  where scan_id = p_scan_id;
  if found then return v_existing; end if;

  if p_confirmation ? 'product_id' then
    v_product_id := (p_confirmation ->> 'product_id')::uuid;
    if v_scan.matched_product_id is distinct from v_product_id
      and not exists (
        select 1 from public.scan_candidates
        where scan_id = p_scan_id and product_id = v_product_id
      ) then
      raise exception 'selected product was not identified for this scan'
        using errcode = '42501';
    end if;
    perform 1 from public.products where id = v_product_id and archived_at is null;
    if not found then
      raise exception 'selected product not found' using errcode = 'P0002';
    end if;
  else
    v_external := v_scan.provider_usage #> '{result,externalProduct}';
    if v_external is not null and v_external <> 'null'::jsonb then
      v_product := jsonb_build_object(
        'brand_name', coalesce(nullif(v_external ->> 'brand', ''), 'Unknown brand'),
        'name', v_external ->> 'name',
        'size_ml', v_external -> 'sizeMl',
        'barcode', v_external #>> '{barcode,value}',
        'barcode_format', v_external #>> '{barcode,format}',
        'source_kind', 'open_food_facts',
        'source_url', v_external #>> '{source,url}',
        'provider_record_id', v_external #>> '{source,recordId}',
        'license', v_external #>> '{source,license}',
        'field_names', jsonb_build_array(
          'barcode', 'brand', 'name', 'size_ml', 'image', 'ingredients', 'nutrition'
        ),
        'confidence', 1,
        'image_url', v_external ->> 'imageUrl',
        'ingredients', v_external ->> 'ingredients',
        'caffeine_mg_per_100ml', v_external -> 'caffeineMgPer100Ml',
        'sugar_g_per_100ml', v_external -> 'sugarGPer100Ml',
        'calories_per_100ml', v_external -> 'caloriesPer100Ml'
      );
    else
      if not coalesce(
        (v_scan.provider_usage #>> '{result,requiresCorrection}')::boolean,
        false
      ) then
        raise exception 'this scan does not permit a provisional correction'
          using errcode = '42501';
      end if;
      v_product := p_confirmation -> 'provisional_product';
      if v_product is null then
        raise exception 'a product selection or provisional product is required'
          using errcode = '22023';
      end if;
      v_product := v_product || jsonb_build_object(
        'source_kind', 'user',
        'source_url', null,
        'provider_record_id', null,
        'license', null,
        'field_names', jsonb_build_array('brand', 'name')
      );
    end if;

    if nullif(trim(v_product ->> 'brand_name'), '') is null
      or nullif(trim(v_product ->> 'name'), '') is null then
      raise exception 'brand and product name are required' using errcode = '22023';
    end if;

    v_product := v_product || jsonb_build_object(
      'normalized_brand_name', lower(regexp_replace(trim(v_product ->> 'brand_name'), '[[:space:]]+', ' ', 'g')),
      'normalized_name', lower(regexp_replace(trim(v_product ->> 'name'), '[[:space:]]+', ' ', 'g'))
    );

    insert into public.brands (name, normalized_name, slug)
    values (
      v_product ->> 'brand_name',
      v_product ->> 'normalized_brand_name',
      regexp_replace(v_product ->> 'normalized_brand_name', '[^a-z0-9]+', '-', 'g')
        || '-' || substr(md5(v_product ->> 'normalized_brand_name'), 1, 6)
    )
    on conflict (normalized_name) do nothing;

    select id into v_brand_id from public.brands
    where normalized_name = v_product ->> 'normalized_brand_name';

    insert into public.products (
      brand_id, created_by, name, normalized_name, flavor, variant, size_ml,
      ingredients, caffeine_mg_per_100ml, sugar_g_per_100ml,
      calories_per_100ml, verification_status
    ) values (
      v_brand_id,
      p_user_id,
      v_product ->> 'name',
      v_product ->> 'normalized_name',
      nullif(v_product ->> 'flavor', ''),
      nullif(v_product ->> 'variant', ''),
      nullif(v_product ->> 'size_ml', '')::integer,
      nullif(v_product ->> 'ingredients', ''),
      nullif(v_product ->> 'caffeine_mg_per_100ml', '')::numeric,
      nullif(v_product ->> 'sugar_g_per_100ml', '')::numeric,
      nullif(v_product ->> 'calories_per_100ml', '')::numeric,
      'provisional'
    )
    on conflict (brand_id, normalized_name, size_ml) do update
      set updated_at = public.products.updated_at
    returning id into v_product_id;

    insert into public.product_sources (
      product_id, source_kind, source_url, provider_record_id, field_names,
      license, confidence, raw_metadata
    ) values (
      v_product_id,
      (v_product ->> 'source_kind')::public.source_kind,
      nullif(v_product ->> 'source_url', ''),
      nullif(v_product ->> 'provider_record_id', ''),
      array(select jsonb_array_elements_text(coalesce(v_product -> 'field_names', '[]'::jsonb))),
      nullif(v_product ->> 'license', ''),
      nullif(v_product ->> 'confidence', '')::numeric,
      '{}'::jsonb
    );

    if nullif(v_product ->> 'barcode', '') is not null then
      insert into public.product_barcodes (product_id, barcode, format)
      values (
        v_product_id,
        v_product ->> 'barcode',
        v_product ->> 'barcode_format'
      );
    end if;

    if nullif(v_product ->> 'image_url', '') is not null
      and not exists (
        select 1 from public.product_images
        where product_id = v_product_id
          and external_url = v_product ->> 'image_url'
      ) then
      insert into public.product_images (
        product_id, source_kind, external_url, source_url, license, alt_text,
        is_primary, is_verified, created_by
      ) values (
        v_product_id,
        (v_product ->> 'source_kind')::public.source_kind,
        v_product ->> 'image_url',
        nullif(v_product ->> 'source_url', ''),
        nullif(v_product ->> 'license', ''),
        v_product ->> 'name',
        not exists (
          select 1 from public.product_images where product_id = v_product_id
        ),
        false,
        p_user_id
      );
    end if;
    v_is_provisional := true;
  end if;

  if nullif(p_confirmation ->> 'collection_status', '') is not null then
    insert into public.user_collections (user_id, product_id, status)
    values (
      p_user_id,
      v_product_id,
      (p_confirmation ->> 'collection_status')::public.collection_status
    )
    on conflict (user_id, product_id) do update
      set status = excluded.status, updated_at = timezone('utc', now())
    returning id into v_collection_id;
  end if;

  v_rating := nullif(p_confirmation ->> 'rating', '')::numeric;
  if coalesce((p_confirmation ->> 'record_tasting')::boolean, false) or v_rating is not null then
    insert into public.tasting_sessions (user_id, product_id, notes)
    values (p_user_id, v_product_id, nullif(p_confirmation ->> 'tasting_notes', ''))
    returning id into v_tasting_id;
  end if;

  if v_rating is not null then
    insert into public.reviews (
      user_id, product_id, tasting_session_id, rating, body
    ) values (
      p_user_id,
      v_product_id,
      v_tasting_id,
      v_rating,
      nullif(p_confirmation ->> 'review_body', '')
    )
    on conflict (user_id, product_id) do update set
      tasting_session_id = excluded.tasting_session_id,
      rating = excluded.rating,
      body = excluded.body,
      updated_at = timezone('utc', now())
    returning id into v_review_id;
  end if;

  update public.scans
  set status = 'confirmed', matched_product_id = v_product_id,
      updated_at = timezone('utc', now())
  where id = p_scan_id;

  v_result := jsonb_build_object(
    'scanId', p_scan_id,
    'productId', v_product_id,
    'collectionId', v_collection_id,
    'tastingSessionId', v_tasting_id,
    'reviewId', v_review_id,
    'provisional', v_is_provisional
  );

  insert into public.scan_confirmations (
    scan_id, user_id, idempotency_key, result
  ) values (p_scan_id, p_user_id, p_idempotency_key, v_result);

  return v_result;
end;
$$;

revoke all on function public.confirm_scan(uuid, uuid, jsonb, text) from public;
grant execute on function public.confirm_scan(uuid, uuid, jsonb, text) to authenticated;

-- Tasting history and the current review are one idempotent transaction. The
-- composite FK prevents a review from pointing at another user/product tasting.
alter table public.tasting_sessions
  add constraint tasting_sessions_identity_key unique (id, user_id, product_id);
alter table public.reviews
  drop constraint if exists reviews_tasting_session_id_fkey;
alter table public.reviews
  add constraint reviews_tasting_owner_product_fkey
  foreign key (tasting_session_id, user_id, product_id)
  references public.tasting_sessions (id, user_id, product_id)
  on delete restrict;

drop policy if exists tasting_sessions_insert_own on public.tasting_sessions;
drop policy if exists tasting_sessions_update_own on public.tasting_sessions;
drop policy if exists tasting_sessions_delete_own on public.tasting_sessions;
drop policy if exists reviews_insert_own on public.reviews;
drop policy if exists reviews_update_own on public.reviews;
drop policy if exists reviews_delete_own on public.reviews;
revoke insert, update, delete on public.tasting_sessions from authenticated;
revoke insert, update, delete on public.reviews from authenticated;

create table public.rating_mutations (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  result jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, idempotency_key)
);
alter table public.rating_mutations enable row level security;
create policy rating_mutations_select_own on public.rating_mutations
  for select to authenticated using (user_id = auth.uid());
grant select on public.rating_mutations to authenticated;
grant all on public.rating_mutations to service_role;

create or replace function public.save_rating(
  p_user_id uuid,
  p_input jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_product_id uuid;
  v_tasting_id uuid;
  v_review_id uuid;
  v_rating numeric;
  v_result jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'rating save requires the authenticated owner'
      using errcode = '42501';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'rating idempotency key is required' using errcode = '22023';
  end if;

  select result into v_existing
  from public.rating_mutations
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;

  v_product_id := (p_input ->> 'product_id')::uuid;
  v_rating := (p_input ->> 'rating')::numeric;
  if v_rating < 0.5 or v_rating > 10 or mod(v_rating * 2, 1) <> 0 then
    raise exception 'rating must be a half point from 0.5 through 10'
      using errcode = '22023';
  end if;

  perform 1 from public.products
  where id = v_product_id
    and archived_at is null
    and (verification_status <> 'provisional' or created_by = p_user_id);
  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  if coalesce((p_input ->> 'record_tasting')::boolean, false) then
    insert into public.tasting_sessions (
      user_id, product_id, tasted_at, location, price, currency, store, notes
    ) values (
      p_user_id,
      v_product_id,
      coalesce(nullif(p_input ->> 'tasted_at', '')::timestamptz, timezone('utc', now())),
      nullif(p_input ->> 'location', ''),
      nullif(p_input ->> 'price', '')::numeric,
      nullif(p_input ->> 'currency', ''),
      nullif(p_input ->> 'store', ''),
      nullif(p_input ->> 'notes', '')
    ) returning id into v_tasting_id;
  end if;

  insert into public.reviews (
    user_id, product_id, tasting_session_id, rating, body, tags
  ) values (
    p_user_id,
    v_product_id,
    v_tasting_id,
    v_rating,
    nullif(p_input ->> 'body', ''),
    array(select jsonb_array_elements_text(coalesce(p_input -> 'tags', '[]'::jsonb)))
  )
  on conflict (user_id, product_id) do update set
    tasting_session_id = excluded.tasting_session_id,
    rating = excluded.rating,
    body = excluded.body,
    tags = excluded.tags,
    updated_at = timezone('utc', now())
  returning id into v_review_id;

  v_result := jsonb_build_object(
    'reviewId', v_review_id,
    'tastingSessionId', v_tasting_id,
    'rating', v_rating
  );
  insert into public.rating_mutations (user_id, idempotency_key, result)
  values (p_user_id, p_idempotency_key, v_result);
  return v_result;
end;
$$;

revoke all on function public.save_rating(uuid, jsonb, text) from public;
grant execute on function public.save_rating(uuid, jsonb, text) to authenticated;
