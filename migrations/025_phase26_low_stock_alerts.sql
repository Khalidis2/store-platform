alter table products
  add column if not exists low_stock_alerted_at timestamptz;

update products
   set low_stock_alerted_at = coalesce(low_stock_alerted_at, now())
 where inventory <= 5;
