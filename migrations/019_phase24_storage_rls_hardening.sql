drop policy if exists "store-images: authenticated insert" on storage.objects;
drop policy if exists "store-images: authenticated select" on storage.objects;
drop policy if exists "store-images: authenticated update" on storage.objects;
drop policy if exists "store-images: authenticated delete" on storage.objects;
drop policy if exists "store-images: owner insert" on storage.objects;
drop policy if exists "store-images: owner select" on storage.objects;
drop policy if exists "store-images: owner update" on storage.objects;
drop policy if exists "store-images: owner delete" on storage.objects;

create policy "store-images: owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'store-images'
    and exists (
      select 1
      from public.stores
      where stores.id::text = (storage.foldername(name))[1]
        and stores.owner_user_id = auth.uid()
    )
  );

create policy "store-images: owner select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'store-images'
    and exists (
      select 1
      from public.stores
      where stores.id::text = (storage.foldername(name))[1]
        and stores.owner_user_id = auth.uid()
    )
  );

create policy "store-images: owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'store-images'
    and exists (
      select 1
      from public.stores
      where stores.id::text = (storage.foldername(name))[1]
        and stores.owner_user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'store-images'
    and exists (
      select 1
      from public.stores
      where stores.id::text = (storage.foldername(name))[1]
        and stores.owner_user_id = auth.uid()
    )
  );

create policy "store-images: owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'store-images'
    and exists (
      select 1
      from public.stores
      where stores.id::text = (storage.foldername(name))[1]
        and stores.owner_user_id = auth.uid()
    )
  );