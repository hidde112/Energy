create table public.scan_confirmations (
  id uuid primary key default extensions.gen_random_uuid(),
  scan_id uuid not null unique references public.scans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  result jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, idempotency_key)
);

alter table public.scan_confirmations enable row level security;

create policy scan_confirmations_select_own on public.scan_confirmations
  for select to authenticated using (user_id = auth.uid());

grant select on public.scan_confirmations to authenticated;
grant all on public.scan_confirmations to service_role;

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
  v_result jsonb;
  v_rating numeric;
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

  select result into v_existing
  from public.scan_confirmations
  where scan_id = p_scan_id;
  if found then return v_existing; end if;

  if p_confirmation ? 'product_id' then
    v_product_id := (p_confirmation ->> 'product_id')::uuid;
    perform 1 from public.products where id = v_product_id and archived_at is null;
    if not found then
      raise exception 'selected product not found' using errcode = 'P0002';
    end if;
  else
    v_product := p_confirmation -> 'provisional_product';
    if v_product is null then
      raise exception 'a product selection or provisional product is required'
        using errcode = '22023';
    end if;

    insert into public.brands (name, normalized_name, slug)
    values (
      v_product ->> 'brand_name',
      v_product ->> 'normalized_brand_name',
      regexp_replace(v_product ->> 'normalized_brand_name', '[^a-z0-9]+', '-', 'g')
        || '-' || substr(md5(v_product ->> 'normalized_brand_name'), 1, 6)
    )
    on conflict (normalized_name) do update set name = excluded.name
    returning id into v_brand_id;

    insert into public.products (
      brand_id, created_by, name, normalized_name, flavor, variant, size_ml,
      verification_status
    ) values (
      v_brand_id,
      p_user_id,
      v_product ->> 'name',
      v_product ->> 'normalized_name',
      nullif(v_product ->> 'flavor', ''),
      nullif(v_product ->> 'variant', ''),
      nullif(v_product ->> 'size_ml', '')::integer,
      'provisional'
    ) returning id into v_product_id;

    insert into public.product_sources (
      product_id, source_kind, source_url, provider_record_id, field_names,
      confidence, raw_metadata
    ) values (
      v_product_id,
      (v_product ->> 'source_kind')::public.source_kind,
      nullif(v_product ->> 'source_url', ''),
      nullif(v_product ->> 'provider_record_id', ''),
      array(select jsonb_array_elements_text(coalesce(v_product -> 'field_names', '[]'::jsonb))),
      nullif(v_product ->> 'confidence', '')::numeric,
      coalesce(v_product -> 'raw_metadata', '{}'::jsonb)
    );

    if nullif(v_product ->> 'barcode', '') is not null then
      insert into public.product_barcodes (product_id, barcode, format)
      values (
        v_product_id,
        v_product ->> 'barcode',
        v_product ->> 'barcode_format'
      );
    end if;
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
    'provisional', v_product is not null
  );

  insert into public.scan_confirmations (
    scan_id, user_id, idempotency_key, result
  ) values (p_scan_id, p_user_id, p_idempotency_key, v_result);

  return v_result;
end;
$$;

create or replace function public.correct_provisional_product(
  p_product_id uuid,
  p_correction jsonb,
  p_correlation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_moderator() then
    raise exception 'moderator role required' using errcode = '42501';
  end if;

  select to_jsonb(products.*) into v_before
  from public.products
  where id = p_product_id and verification_status <> 'rejected'
  for update;
  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  update public.products
  set
    name = coalesce(nullif(p_correction ->> 'name', ''), name),
    normalized_name = coalesce(nullif(p_correction ->> 'normalized_name', ''), normalized_name),
    flavor = case when p_correction ? 'flavor' then nullif(p_correction ->> 'flavor', '') else flavor end,
    variant = case when p_correction ? 'variant' then nullif(p_correction ->> 'variant', '') else variant end,
    size_ml = case when p_correction ? 'size_ml' then nullif(p_correction ->> 'size_ml', '')::integer else size_ml end,
    verification_status = coalesce(
      nullif(p_correction ->> 'verification_status', '')::public.product_verification_status,
      verification_status
    ),
    verified_at = case
      when p_correction ->> 'verification_status' = 'verified' then timezone('utc', now())
      else verified_at
    end,
    updated_at = timezone('utc', now())
  where id = p_product_id
  returning to_jsonb(products.*) into v_after;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data, correlation_id
  ) values (
    auth.uid(), 'product.corrected', 'product', p_product_id,
    v_before, v_after, p_correlation_id
  );

  return v_after;
end;
$$;

revoke all on function public.confirm_scan(uuid, uuid, jsonb, text) from public;
grant execute on function public.confirm_scan(uuid, uuid, jsonb, text) to authenticated;
revoke all on function public.correct_provisional_product(uuid, jsonb, text) from public;
grant execute on function public.correct_provisional_product(uuid, jsonb, text) to authenticated;
