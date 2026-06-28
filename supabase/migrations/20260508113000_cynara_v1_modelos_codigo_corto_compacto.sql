begin;

update public.modelos_producto
set codigo_corto = upper(regexp_replace(coalesce(codigo_corto, ''), '[^A-Z0-9]+', '', 'g'))
where coalesce(codigo_corto, '') <> '';

update public.modelos_producto_variantes
set codigo_corto = upper(regexp_replace(coalesce(codigo_corto, ''), '[^A-Z0-9]+', '', 'g'))
where coalesce(codigo_corto, '') <> '';

commit;
