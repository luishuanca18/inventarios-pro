begin;

alter table public.configuracion_empresa
add column if not exists stock_minimo_alerta integer not null default 5;

update public.configuracion_empresa
set stock_minimo_alerta = 5
where stock_minimo_alerta is null or stock_minimo_alerta <= 0;

commit;
