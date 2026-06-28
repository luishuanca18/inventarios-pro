update public.usuarios
set
  nombre = upper(
    trim(
      regexp_replace(
        split_part(lower(coalesce(correo, '')), '@', 1),
        '[._-]+',
        ' ',
        'g'
      )
    )
  ),
  nombres = upper(
    trim(
      regexp_replace(
        split_part(lower(coalesce(correo, '')), '@', 1),
        '[._-]+',
        ' ',
        'g'
      )
    )
  ),
  fechaactualizacion = timezone('utc', now())
where
  (
    coalesce(trim(nombre), '') = ''
    or upper(coalesce(trim(nombre), '')) = 'GENERICO'
    or coalesce(trim(nombres), '') = ''
    or upper(coalesce(trim(nombres), '')) = 'GENERICO'
  )
  and coalesce(trim(correo), '') <> '';
