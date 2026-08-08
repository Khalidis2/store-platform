alter table stores
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists shipping_policy text,
  add column if not exists returns_policy text,
  add column if not exists privacy_policy text,
  add column if not exists terms_policy text;
