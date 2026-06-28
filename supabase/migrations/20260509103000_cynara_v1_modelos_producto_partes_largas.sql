update public.modelos_producto
set
  categoria = upper(split_part(coalesce(nombre_modelo, ''), ' ', 1)),
  modelo_catalogo = upper(split_part(coalesce(nombre_modelo, ''), ' ', 2)),
  tela_nombre = upper(
    trim(
      regexp_replace(
        coalesce(nombre_modelo, ''),
        '^\S+\s+\S+\s*',
        '',
        'g'
      )
    )
  )
where
  coalesce(trim(categoria), '') = ''
  or coalesce(trim(modelo_catalogo), '') = ''
  or coalesce(trim(tela_nombre), '') = '';
