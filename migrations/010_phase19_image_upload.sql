-- Run this once per Supabase project (not idempotent the same way the
-- public-schema migrations are — storage.buckets/storage.objects are
-- Supabase-managed tables, not ours). Sets up the bucket store logo and
-- product image uploads go into.
insert into storage.buckets (id, name, public)
values ('store-images', 'store-images', true)
on conflict (id) do nothing;

-- Public bucket only makes reads public (via the /storage/v1/object/public/
-- URL) — writes still need their own policy, or every insert gets rejected
-- by RLS regardless of the bucket's public flag.
drop policy if exists "store-images: authenticated insert" on storage.objects;
create policy "store-images: authenticated insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'store-images');

drop policy if exists "store-images: authenticated select" on storage.objects;
create policy "store-images: authenticated select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'store-images');

drop policy if exists "store-images: authenticated update" on storage.objects;
create policy "store-images: authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'store-images');

drop policy if exists "store-images: authenticated delete" on storage.objects;
create policy "store-images: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'store-images');

-- Not scoped per-merchant at the RLS layer — any authenticated user (i.e.
-- any signed-up merchant) can write/overwrite any path in this bucket.
-- The real tenant boundary is enforced at the application layer: uploads
-- only happen from Server Actions that already call getOwnedStore() before
-- touching Storage, and object paths are prefixed with the store's id
-- (see lib/upload-image.ts). Tightening this to a path-based RLS policy
-- (storage.foldername(name) matches the caller's owned store ids) is a
-- reasonable next step if this ever needs defense-in-depth beyond the
-- application-layer check.
