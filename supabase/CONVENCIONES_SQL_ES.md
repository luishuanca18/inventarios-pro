# Convenciones SQL en Espanol

Desde este punto del proyecto, toda tabla, funcion, vista, politica o migracion nueva
debe crearse con nombres en espanol y con significado operativo claro.

## Regla general

- Lo ya existente no se renombra si puede romper el sistema.
- Lo nuevo se crea en espanol.
- Si un nombre tecnico de Supabase o PostgreSQL no puede cambiarse, se deja tal cual.
- Siempre que se cree algo nuevo, agregar `comment on` en espanol para explicar para que sirve.

## Tablas nuevas

Usar nombres en plural, claros y operativos.

Buenos ejemplos:

- `pedidos_produccion`
- `ordenes_corte`
- `salidas_taller`
- `recepciones_taller`
- `costos_terceros`
- `correlativos_sistema`
- `ajustes_materia_prima`

Evitar:

- `order_items`
- `prod_flow_data`
- `temp_registry`
- abreviaturas que solo entiende quien programo

## Funciones nuevas

Usar verbos en espanol que expliquen la accion.

Buenos ejemplos:

- `actualizar_fecha_modificacion`
- `registrar_movimiento_stock`
- `calcular_total_prendas`
- `crear_variante_si_no_existe`
- `obtener_correlativo_anual`

Evitar:

- `set_data`
- `do_sync`
- `fn_registry`
- `helper_x1`

## Vistas nuevas

Usar nombres que describan lo que muestran.

Buenos ejemplos:

- `vista_stock_productos`
- `vista_resumen_talleres`
- `vista_costos_por_modelo`

## Politicas RLS nuevas

Usar nombres legibles y consistentes.

Buenos ejemplos:

- `usuarios_todo_autenticados`
- `pedidos_produccion_todo_autenticados`
- `stock_productos_solo_lectura_autenticados`

## Campos nuevos

Tambien deben ir en espanol cuando sean creados por nosotros.

Buenos ejemplos:

- `fecha_creacion`
- `fecha_actualizacion`
- `codigo_modelo`
- `nombre_taller`
- `motivo_ajuste`
- `origen_material`
- `color_nuevo`

Evitar mezclar sin necesidad:

- `created_at` con `fecha_salida` en una tabla nueva
- `workshop_name` con `nombre_taller`

Nota:
- si una tabla vieja ya usa `created_at` o `updated_at`, se puede respetar por compatibilidad
- en tablas nuevas preferir espanol, salvo que una integracion externa exija otra cosa

## Nombres de migraciones

Las migraciones nuevas deben reflejar claramente el cambio.

Formato recomendado:

- `YYYYMMDDHHMMSS_cynara_v1_<descripcion_en_espanol>.sql`

Ejemplos:

- `20260519100000_cynara_v1_crear_tabla_ajustes_materia_prima.sql`
- `20260519101500_cynara_v1_agregar_campo_origen_material.sql`
- `20260519103000_cynara_v1_comentarios_sql_es.sql`

## Comentarios obligatorios

Cada tabla o funcion nueva debe incluir comentario en espanol.

Ejemplo:

```sql
create table if not exists public.ajustes_materia_prima (
  id uuid primary key default gen_random_uuid(),
  codigo_unidad text not null,
  kilos numeric(12,2) not null default 0,
  motivo_ajuste text not null default '',
  fecha_creacion timestamptz not null default now()
);

comment on table public.ajustes_materia_prima is
  'Registra ajustes manuales de kilos o datos del stock de materia prima.';
```

## Excepcion valida

Se puede dejar algo en ingles solo si:

- Supabase lo crea automaticamente
- PostgreSQL lo exige o lo usa por defecto
- una libreria externa lo espera con ese nombre exacto
- cambiarlo romperia compatibilidad con el sistema ya desplegado

## Decision operativa

Desde ahora:

- tablas nuevas: en espanol
- funciones nuevas: en espanol
- vistas nuevas: en espanol
- politicas nuevas: en espanol
- comentarios SQL: en espanol

Lo viejo:

- se mantiene estable
- y se documenta mejor en espanol cuando haga falta
