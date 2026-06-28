# Estructura de imagenes y comprobantes

Este documento deja preparada la base para guardar fotos reales en el sistema
sin mezclar archivos con las tablas operativas.

## Buckets de Storage

- `comprobantes-compra`
  - Guarda fotos o PDF de comprobantes de compra, vouchers y guias.
- `modelos-visuales`
  - Guarda fotos del modelo: frente, espalda, costado y detalle.
- `trazos-corte`
  - Guarda fotos del orden de trazo para reutilizarlo luego.

## Tablas nuevas

### `compras_materia_prima`

Cabecera contable y operativa de una compra.

Campos principales:

- `codigo_compra`
- `fecha_compra`
- `proveedor_id`
- `proveedor_nombre`
- `tipo_comprobante`
- `serie_comprobante`
- `numero_comprobante`
- `moneda`
- `subtotal`
- `igv`
- `total`
- `usuario_registro`
- `observacion`
- `payload`

### `adjuntos_compras_materia_prima`

Permite que una compra tenga uno o varios archivos.

Campos principales:

- `compra_id`
- `tipo_adjunto`
- `nombre_archivo`
- `ruta_storage`
- `url_publica`
- `tipo_mime`
- `tamanio_bytes`
- `orden_visual`
- `usuario_subida`
- `observacion`

Usos esperados:

- foto de factura
- foto de boleta
- voucher de deposito
- guia de remision
- varias hojas de un mismo comprobante

### `fotos_trazos_corte`

Guarda las fotos de referencia del trazo asociado a un corte.

Campos principales:

- `corte_id`
- `codigo_corte`
- `modelo`
- `tipo_foto`
- `nombre_archivo`
- `ruta_storage`
- `url_publica`
- `orden_visual`
- `usuario_subida`
- `observacion`

Usos esperados:

- foto general del trazo
- acercamiento del orden de tallas
- referencia de acomodo de paños
- detalle especial de multiaguja, bolsillo o vena

## Lo que ya existia y se reutiliza

La tabla `modelos_visuales` ya cubre:

- `foto_frontal`
- `foto_espalda`
- `foto_costado`
- `foto_detalle`

Por eso no se crea una tabla nueva para modelos. Lo correcto sera
guardar esos archivos en el bucket `modelos-visuales` y luego registrar
sus URLs en la tabla ya existente.

## Flujo recomendado a futuro

### Compras

1. Crear cabecera de compra
2. Subir uno o varios archivos al bucket `comprobantes-compra`
3. Registrar cada archivo en `adjuntos_compras_materia_prima`
4. Mostrar las miniaturas o enlaces en Contabilidad y Compras

### Modelos visuales

1. Subir fotos al bucket `modelos-visuales`
2. Guardar sus URLs en `modelos_visuales`
3. Mostrar esas fotos en Produccion, Taller y configuracion visual

### Trazos de corte

1. Confirmar corte
2. Subir una o varias fotos al bucket `trazos-corte`
3. Registrar cada foto en `fotos_trazos_corte`
4. Mostrar esas referencias cuando se vuelva a producir el modelo

## Recomendacion de peso por archivo

Para que los 100 GB del plan Pro rindan bien:

- comprobantes: `300 KB` a `1 MB`
- modelos visuales: `500 KB` a `2 MB`
- trazo de corte: `500 KB` a `2 MB`

Evitar subir fotos del celular de `6 MB`, `8 MB` o mas sin compresion.

## Etapas sugeridas

1. Conectar `modelos_visuales` a Storage
2. Agregar comprobantes a compras
3. Agregar fotos de trazo
4. Luego conectar captura directa desde celular o app Android
