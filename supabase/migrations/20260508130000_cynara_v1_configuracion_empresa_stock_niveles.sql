begin;

alter table public.configuracion_empresa
add column if not exists stock_medio_alerta integer not null default 10;

alter table public.configuracion_empresa
add column if not exists stock_optimo_alerta integer not null default 15;

update public.configuracion_empresa
set
  stock_minimo_alerta = greatest(1, coalesce(stock_minimo_alerta, 5)),
  stock_medio_alerta = greatest(greatest(1, coalesce(stock_minimo_alerta, 5)), coalesce(stock_medio_alerta, 10)),
  stock_optimo_alerta = greatest(
    greatest(greatest(1, coalesce(stock_minimo_alerta, 5)), coalesce(stock_medio_alerta, 10)),
    coalesce(stock_optimo_alerta, 15)
  );

commit;
