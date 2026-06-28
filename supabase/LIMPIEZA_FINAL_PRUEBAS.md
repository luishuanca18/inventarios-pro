# Limpieza Final Antes de Produccion

Este archivo deja amarradas las tareas que debemos ejecutar cuando el sistema
ya termine su etapa de pruebas fuertes y antes de dejarlo como operacion real.

## 1. Retirar herramientas temporales de prueba

Eliminar o restringir estas acciones temporales:

- Boton `Reiniciar OP` en `Salida a taller`
  - Archivo:
    - `C:\Users\LuisHuanca\Documents\proyectos en react\inventarios-pro\src\pages\produccion\SalidasTaller.jsx`
  - Motivo:
    - hoy sirve para limpiar flujos viejos o mal sembrados durante pruebas
    - no debe quedar disponible para operacion diaria normal

Opciones al cierre:

- quitarlo por completo
- o dejarlo solo para un rol tecnico muy restringido

## 2. Limpiar tablas operativas de prueba

Al cierre debemos vaciar solo datos operativos sembrados por pruebas.

### Tablas / modulos a limpiar

- `pedidos_produccion`
- `ordenes_produccion`
- `salidas_taller`
- `recepciones_taller`
- `solicitudes_procesos_externos`
- `descuentos_taller`
- `ajustes_recepcion_produccion`
- `acondicionado_producto_terminado`
- `remates_producto_terminado`
- `productos_terminados_stock`
- `movimientos_productos_terminados`
- `lotes_productos_terminados`
- tablas operativas de materia prima
- tablas operativas de stock
- tablas operativas de ventas, tienda, cambios y movimientos

### LocalStorage a limpiar

- historiales operativos del flujo
- cache de stock
- registros de recepcion
- registros de taller
- registros de tercerizacion
- movimientos y lotes de producto terminado

## 3. No limpiar configuracion maestra

No se deben borrar estas configuraciones, salvo decision expresa:

- empresa
- documentos y correlativos
- fichas de talleres
- personal y seguridad
- catalogos de personal
- catalogos de produccion
- catalogo de productos
- costos y finanzas
- precios
- sueldos
- modelos visuales
- elasticos por modelo

## 4. Antes de ejecutar la limpieza final

Hacer estas validaciones:

- confirmar que los flujos ya fueron probados de punta a punta
- confirmar que correlativos ya quedaron correctos
- confirmar que permisos y accesos ya quedaron listos
- confirmar que stock y recepciones ya no tienen datos basura
- hacer respaldo si el usuario quiere conservar evidencia de pruebas

## 5. Orden recomendado de cierre

1. congelar cambios funcionales
2. quitar herramientas temporales de prueba
3. limpiar tablas operativas
4. resincronizar desde Supabase
5. validar sistema limpio
6. recien despues iniciar uso real

## 6. Consolidacion final para uso en PC, tablet y celular

Antes de salida real debemos cerrar esta fase obligatoria:

- revisar que ningun flujo critico quede dependiendo solo de `localStorage`
- mover a Supabase toda la informacion compartida entre equipos
- confirmar que cada modulo operativo lea y escriba desde la fuente remota final
- dejar `localStorage` solo para apoyo temporal, cache o contingencia controlada

### Flujos que deben quedar compartidos en Supabase

- salida a taller
- recepciones de taller
- tercerizaciones y procesos externos
- pagos, ajustes y descuentos
- stock de productos terminados
- stock y movimientos de materia prima
- pedidos, OP y sus estados

### Pruebas finales multi-dispositivo

Validar el mismo flujo desde:

- PC
- tablet
- celular

Y confirmar estos casos:

- una operacion creada en un equipo aparece en los otros
- una aprobacion o cambio de estado se refleja en todos
- pagos, descuentos y ajustes se ven igual en todos los equipos
- stock y recepciones no dependen de datos locales de una sola maquina

### Regla final de salida a produccion

No considerar el sistema listo para trabajo real hasta cumplir esta fase de:

- consolidacion final a Supabase
- limpieza de dependencias locales peligrosas
- y pruebas reales multi-equipo
