alter table public.order_items
  alter column product_id drop not null;

do $$
declare
  product_reference record;
begin
  for product_reference in
    select constraint_info.conname
    from pg_constraint as constraint_info
    join pg_attribute as column_info
      on column_info.attrelid = constraint_info.conrelid
      and column_info.attnum = any(constraint_info.conkey)
    where constraint_info.conrelid = 'public.order_items'::regclass
      and constraint_info.contype = 'f'
      and column_info.attname = 'product_id'
  loop
    execute format(
      'alter table public.order_items drop constraint %I',
      product_reference.conname
    );
  end loop;
end
$$;

alter table public.order_items
  add constraint order_items_product_id_fkey
  foreign key (product_id)
  references public.products (id)
  on delete set null;
