alter table stores
  add column status text not null default 'draft';

update stores
set status = case when is_live then 'active' else 'draft' end;

alter table stores
  add constraint stores_status_check
  check (status in ('draft', 'active', 'suspended', 'closed'));

alter table products
  add column status text not null default 'draft';

update products
set status = 'active';

alter table products
  add constraint products_status_check
  check (status in ('draft', 'active', 'archived'));

create index idx_stores_status on stores(status);
create index idx_products_store_status on products(store_id, status);
