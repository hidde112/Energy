-- Private provisional records deduplicate within an owner boundary. Shared
-- catalog identity remains global only after moderation.
drop index if exists public.products_canonical_identity_idx;
create unique index products_shared_identity_idx
  on public.products (brand_id, normalized_name, size_ml) nulls not distinct
  where verification_status in ('community_confirmed', 'verified');
create unique index products_provisional_owner_identity_idx
  on public.products (created_by, brand_id, normalized_name, size_ml) nulls not distinct
  where verification_status = 'provisional';

-- A barcode is global for shared records and private per provisional owner.
-- This lets two people submit the same public-provider record without exposing
-- either person's private provisional product to the other.
alter table public.product_barcodes
  drop constraint if exists product_barcodes_barcode_key;
alter table public.product_barcodes
  add column owner_id uuid references auth.users(id) on delete cascade;

update public.product_barcodes barcodes
set owner_id = products.created_by
from public.products products
where products.id = barcodes.product_id
  and products.verification_status = 'provisional';

create unique index product_barcodes_owner_value_idx
  on public.product_barcodes (barcode, owner_id) nulls not distinct;

create or replace function public.assign_product_barcode_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.product_verification_status;
  v_owner uuid;
begin
  select verification_status, created_by into v_status, v_owner
  from public.products where id = new.product_id;
  if not found then
    raise exception 'barcode product not found' using errcode = '23503';
  end if;
  new.owner_id := case when v_status = 'provisional' then v_owner else null end;
  return new;
end;
$$;

create trigger product_barcodes_assign_owner
  before insert or update of product_id on public.product_barcodes
  for each row execute function public.assign_product_barcode_owner();

create or replace function public.sync_product_barcode_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.verification_status is distinct from old.verification_status
    or new.created_by is distinct from old.created_by then
    update public.product_barcodes
    set owner_id = case
      when new.verification_status = 'provisional' then new.created_by
      else null
    end
    where product_id = new.id;
  end if;
  return new;
end;
$$;

create trigger products_sync_barcode_ownership
  after update of verification_status, created_by on public.products
  for each row execute function public.sync_product_barcode_ownership();

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
      if p_confirmation -> 'provisional_product' is null then
        raise exception 'a product selection or provisional product is required'
          using errcode = '22023';
      end if;
      -- Corrections may supply only catalog identity fields. Provider, barcode,
      -- image, nutrition, and provenance are never accepted from this request.
      v_product := jsonb_build_object(
        'brand_name', p_confirmation #>> '{provisional_product,brand_name}',
        'name', p_confirmation #>> '{provisional_product,name}',
        'size_ml', p_confirmation #> '{provisional_product,size_ml}',
        'flavor', p_confirmation #>> '{provisional_product,flavor}',
        'variant', p_confirmation #>> '{provisional_product,variant}',
        'source_kind', 'user',
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

    -- An exact verified catalog identity can be collected, but an ordinary
    -- correction cannot attach any new global fields to it.
    select id into v_product_id
    from public.products
    where brand_id = v_brand_id
      and normalized_name = v_product ->> 'normalized_name'
      and size_ml is not distinct from nullif(v_product ->> 'size_ml', '')::integer
      and verification_status = 'verified'
      and archived_at is null
    limit 1;

    if not found then
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
      on conflict (created_by, brand_id, normalized_name, size_ml)
        where verification_status = 'provisional'
      do update set updated_at = public.products.updated_at
      returning id into v_product_id;

      insert into public.product_sources (
        product_id, source_kind, source_url, provider_record_id, field_names,
        license, confidence, raw_metadata
      )
      select
        v_product_id,
        (v_product ->> 'source_kind')::public.source_kind,
        nullif(v_product ->> 'source_url', ''),
        nullif(v_product ->> 'provider_record_id', ''),
        array(select jsonb_array_elements_text(coalesce(v_product -> 'field_names', '[]'::jsonb))),
        nullif(v_product ->> 'license', ''),
        nullif(v_product ->> 'confidence', '')::numeric,
        '{}'::jsonb
      where not exists (
        select 1 from public.product_sources sources
        where sources.product_id = v_product_id
          and sources.source_kind = (v_product ->> 'source_kind')::public.source_kind
          and coalesce(sources.provider_record_id, '') = coalesce(v_product ->> 'provider_record_id', '')
          and coalesce(sources.source_url, '') = coalesce(v_product ->> 'source_url', '')
      );

      if nullif(v_product ->> 'barcode', '') is not null then
        insert into public.product_barcodes (product_id, barcode, format)
        values (
          v_product_id,
          v_product ->> 'barcode',
          v_product ->> 'barcode_format'
        )
        on conflict do nothing;
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
          null,
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

-- Claim provider work before making external calls. Advisory locks serialize
-- identical keys/fingerprints across server instances; the persisted lease
-- prevents concurrent requests from duplicating paid work.
create or replace function public.claim_identification(
  p_user_id uuid,
  p_input_kind text,
  p_idempotency_key text,
  p_barcode text,
  p_fingerprint text,
  p_scan_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scan public.scans%rowtype;
  v_lock_key text;
begin
  if p_input_kind not in ('barcode', 'image', 'camera-frame')
    or nullif(trim(p_idempotency_key), '') is null then
    raise exception 'invalid identification claim' using errcode = '22023';
  end if;

  v_lock_key := p_user_id::text || ':' || coalesce(nullif(p_fingerprint, ''), p_idempotency_key);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_lock_key, 0));

  select * into v_scan
  from public.scans
  where user_id = p_user_id and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_scan.status in ('identified', 'confirmed')
      and v_scan.provider_usage ? 'result' then
      return jsonb_build_object(
        'state', 'existing',
        'scanId', v_scan.id,
        'result', v_scan.provider_usage -> 'result'
      );
    end if;
    if v_scan.status = 'pending'
      and v_scan.updated_at > timezone('utc', now()) - interval '60 seconds' then
      return jsonb_build_object('state', 'in_progress', 'scanId', v_scan.id);
    end if;

    update public.scans
    set status = 'pending', input_kind = p_input_kind,
        barcode = nullif(p_barcode, ''),
        image_fingerprint = nullif(p_fingerprint, ''), failure_code = null,
        updated_at = timezone('utc', now())
    where id = v_scan.id
    returning * into v_scan;
    return jsonb_build_object(
      'state', 'claimed',
      'scanId', v_scan.id,
      'hypothesis', v_scan.provider_usage -> 'visionHypothesis'
    );
  end if;

  if nullif(p_fingerprint, '') is not null then
    select * into v_scan
    from public.scans
    where user_id = p_user_id
      and image_fingerprint = p_fingerprint
      and status = 'pending'
      and updated_at > timezone('utc', now()) - interval '60 seconds'
    order by updated_at desc
    limit 1
    for update;
    if found then
      return jsonb_build_object('state', 'in_progress', 'scanId', v_scan.id);
    end if;
  end if;

  insert into public.scans (
    id, user_id, status, input_kind, barcode, image_fingerprint,
    idempotency_key, provider_usage
  ) values (
    p_scan_id, p_user_id, 'pending', p_input_kind, nullif(p_barcode, ''),
    nullif(p_fingerprint, ''),
    p_idempotency_key, '{}'::jsonb
  ) returning * into v_scan;

  return jsonb_build_object('state', 'claimed', 'scanId', v_scan.id);
end;
$$;

create or replace function public.save_identification_hypothesis(
  p_scan_id uuid,
  p_user_id uuid,
  p_fingerprint text,
  p_hypothesis jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.scans
  set image_fingerprint = p_fingerprint,
      provider_usage = provider_usage || jsonb_build_object(
        'visionHypothesis', p_hypothesis
      ),
      updated_at = timezone('utc', now())
  where id = p_scan_id and user_id = p_user_id and status = 'pending';
  if not found then
    raise exception 'pending identification claim not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.fail_identification(
  p_scan_id uuid,
  p_user_id uuid,
  p_failure_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.scans
  set status = 'failed', failure_code = left(coalesce(p_failure_code, 'UNEXPECTED'), 120),
      updated_at = timezone('utc', now())
  where id = p_scan_id and user_id = p_user_id and status = 'pending';
end;
$$;

create or replace function public.complete_identification(
  p_scan_id uuid,
  p_user_id uuid,
  p_result jsonb,
  p_hypothesis jsonb,
  p_candidates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scan public.scans%rowtype;
  v_first_product uuid;
begin
  select * into v_scan
  from public.scans
  where id = p_scan_id and user_id = p_user_id and status = 'pending'
  for update;
  if not found then
    raise exception 'pending identification claim not found' using errcode = 'P0002';
  end if;

  delete from public.scan_candidates where scan_id = p_scan_id;
  insert into public.scan_candidates (
    scan_id, product_id, position, score, confidence, hypothesis
  )
  select
    p_scan_id,
    candidate.product_id,
    candidate.position,
    candidate.score,
    candidate.confidence,
    coalesce(candidate.hypothesis, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_candidates, '[]'::jsonb)) as candidate(
    product_id uuid,
    position smallint,
    score numeric,
    confidence text,
    hypothesis jsonb
  );

  select product_id into v_first_product
  from public.scan_candidates
  where scan_id = p_scan_id and position = 1;

  update public.scans
  set status = 'identified', matched_product_id = v_first_product,
      provider_usage = jsonb_build_object(
        'source', p_result ->> 'source',
        'result', p_result,
        'visionHypothesis', p_hypothesis
      ),
      failure_code = null,
      updated_at = timezone('utc', now())
  where id = p_scan_id;

  return p_result;
end;
$$;

-- Counting and consuming occur while holding the same per-user/action lock,
-- so concurrent requests cannot all pass the quota boundary.
create or replace function public.consume_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window_ms bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count bigint;
begin
  if nullif(trim(p_action), '') is null or p_limit < 1 or p_window_ms < 1 then
    raise exception 'invalid rate-limit parameters' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_action, 0)
  );
  select count(*) into v_count
  from public.rate_limit_events
  where user_id = p_user_id
    and action = p_action
    and occurred_at >= timezone('utc', now()) - (p_window_ms * interval '1 millisecond');
  if v_count >= p_limit then return false; end if;

  insert into public.rate_limit_events (user_id, action)
  values (p_user_id, p_action);
  return true;
end;
$$;

revoke all on function public.claim_identification(uuid, text, text, text, text, uuid) from public;
revoke all on function public.save_identification_hypothesis(uuid, uuid, text, jsonb) from public;
revoke all on function public.fail_identification(uuid, uuid, text) from public;
revoke all on function public.complete_identification(uuid, uuid, jsonb, jsonb, jsonb) from public;
revoke all on function public.consume_rate_limit(uuid, text, integer, bigint) from public;
grant execute on function public.claim_identification(uuid, text, text, text, text, uuid) to service_role;
grant execute on function public.save_identification_hypothesis(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.fail_identification(uuid, uuid, text) to service_role;
grant execute on function public.complete_identification(uuid, uuid, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.consume_rate_limit(uuid, text, integer, bigint) to service_role;
