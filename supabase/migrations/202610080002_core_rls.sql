alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.app_user_roles enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.flavor_tags enable row level security;
alter table public.products enable row level security;
alter table public.product_aliases enable row level security;
alter table public.product_barcodes enable row level security;
alter table public.product_images enable row level security;
alter table public.product_sources enable row level security;
alter table public.product_flavors enable row level security;
alter table public.user_collections enable row level security;
alter table public.tasting_sessions enable row level security;
alter table public.reviews enable row level security;
alter table public.scans enable row level security;
alter table public.scan_candidates enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_settings_select_own on public.user_settings
  for select to authenticated using (user_id = auth.uid());
create policy user_settings_insert_own on public.user_settings
  for insert to authenticated with check (user_id = auth.uid());
create policy user_settings_update_own on public.user_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_settings_delete_own on public.user_settings
  for delete to authenticated using (user_id = auth.uid());

create policy app_user_roles_select_own on public.app_user_roles
  for select to authenticated using (user_id = auth.uid());

create policy brands_select_all on public.brands for select using (true);
create policy categories_select_all on public.categories for select using (true);
create policy flavor_tags_select_all on public.flavor_tags for select using (true);

create policy products_select_visible on public.products
  for select
  using (
    verification_status = 'verified'
    or created_by = auth.uid()
    or public.is_moderator()
  );
create policy products_insert_provisional on public.products
  for insert to authenticated
  with check (created_by = auth.uid() and verification_status = 'provisional');

create policy product_aliases_select_visible on public.product_aliases
  for select using (
    exists (select 1 from public.products where products.id = product_aliases.product_id)
  );
create policy product_barcodes_select_visible on public.product_barcodes
  for select using (
    exists (select 1 from public.products where products.id = product_barcodes.product_id)
  );
create policy product_images_select_visible on public.product_images
  for select using (
    exists (select 1 from public.products where products.id = product_images.product_id)
  );
create policy product_sources_select_visible on public.product_sources
  for select using (
    exists (select 1 from public.products where products.id = product_sources.product_id)
  );
create policy product_flavors_select_visible on public.product_flavors
  for select using (
    exists (select 1 from public.products where products.id = product_flavors.product_id)
  );

create policy collections_select_own on public.user_collections
  for select to authenticated using (user_id = auth.uid());
create policy collections_insert_own on public.user_collections
  for insert to authenticated with check (user_id = auth.uid());
create policy collections_update_own on public.user_collections
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy collections_delete_own on public.user_collections
  for delete to authenticated using (user_id = auth.uid());

create policy tasting_sessions_select_own on public.tasting_sessions
  for select to authenticated using (user_id = auth.uid());
create policy tasting_sessions_insert_own on public.tasting_sessions
  for insert to authenticated with check (user_id = auth.uid());
create policy tasting_sessions_update_own on public.tasting_sessions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tasting_sessions_delete_own on public.tasting_sessions
  for delete to authenticated using (user_id = auth.uid());

create policy reviews_select_own on public.reviews
  for select to authenticated using (user_id = auth.uid());
create policy reviews_insert_own on public.reviews
  for insert to authenticated with check (user_id = auth.uid());
create policy reviews_update_own on public.reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_delete_own on public.reviews
  for delete to authenticated using (user_id = auth.uid());

create policy scans_select_own on public.scans
  for select to authenticated using (user_id = auth.uid());
create policy scans_insert_own on public.scans
  for insert to authenticated with check (user_id = auth.uid());
create policy scans_update_own on public.scans
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy scans_delete_own on public.scans
  for delete to authenticated using (user_id = auth.uid());

create policy scan_candidates_select_own on public.scan_candidates
  for select to authenticated using (
    exists (
      select 1 from public.scans
      where scans.id = scan_candidates.scan_id and scans.user_id = auth.uid()
    )
  );

create policy rate_limit_events_select_own on public.rate_limit_events
  for select to authenticated using (user_id = auth.uid());

create policy audit_logs_select_moderator on public.audit_logs
  for select to authenticated using (public.is_moderator());

grant usage on schema public to anon, authenticated, service_role;
grant select on public.brands, public.categories, public.flavor_tags to anon, authenticated;
grant select on public.products, public.product_aliases, public.product_barcodes,
  public.product_images, public.product_sources, public.product_flavors to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
grant select on public.app_user_roles to authenticated;
grant insert on public.products to authenticated;
grant select, insert, update, delete on public.user_collections, public.tasting_sessions,
  public.reviews, public.scans to authenticated;
grant select on public.scan_candidates, public.rate_limit_events, public.audit_logs to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
