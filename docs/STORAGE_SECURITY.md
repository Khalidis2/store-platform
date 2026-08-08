# Storage security

Store logos and product images are stored in the public-read Supabase Storage bucket `store-images`.

Object paths must begin with the owning store UUID. Existing upload call sites use paths such as:

```text
{store_id}/logo-...
{store_id}/products-...
```

`migrations/019_phase24_storage_rls_hardening.sql` replaces the original bucket-wide authenticated policies with tenant-scoped policies. For insert, update, and delete, and for authenticated object selection, Supabase Storage checks that:

1. `bucket_id = 'store-images'`.
2. The first folder in `storage.objects.name` matches a row in `public.stores`.
3. That store row has `owner_user_id = auth.uid()`.

The application-layer `getOwnedStore()` authorization remains required. Storage RLS is defense in depth: even if a merchant bypasses the normal Server Action and calls Supabase Storage directly, they cannot write to another store's object path.

The bucket remains public-read so storefront image URLs continue to work for unauthenticated customers. Public readability is intentional; cross-tenant write access is not.

When adding a new upload call site, always place the store UUID in the first path segment and authenticate the merchant before calling `uploadImage()`.