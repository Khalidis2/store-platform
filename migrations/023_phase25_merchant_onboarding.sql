alter table stores
  add column if not exists branding_configured boolean not null default false,
  add column if not exists shipping_configured boolean not null default false;

update stores
   set branding_configured = true
 where branding_configured = false
   and (logo_url is not null or tagline is not null or accent_color is not null);

update stores
   set shipping_configured = true
 where shipping_configured = false
   and (shipping_flat_cents > 0 or free_shipping_threshold_cents is not null);
