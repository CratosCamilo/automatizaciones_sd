# Módulos — Slendy Automatizaciones

Cada módulo es una automatización independiente. Este archivo documenta qué hace cada uno, sus inputs, su lógica y su output. Actualizar cada vez que se añada o modifique un módulo.

---

## Módulo 1 — Conciliación DIAN vs Siigo

**Ruta web**: `/conciliacion`  
**Función backend**: `api/conciliacion.py`  
**Estado**: ✅ Activo

### ¿Para qué sirve?
Compara las facturas electrónicas que reporta la DIAN (fuente de verdad) contra las que están registradas en Siigo, para identificar:
- Facturas que la DIAN registra pero **faltan** en Siigo (hay que registrarlas)
- Facturas que están en Siigo pero **no aparecen** en la DIAN (posible error de prefijo/folio)
- Facturas que están en **ambos sistemas** correctamente

Sirve para la conciliación bancaria mensual.

---

### Inputs

| Archivo | Formato | Origen |
|---------|---------|--------|
| Reporte DIAN | `.zip` | Descargado directamente del portal de la DIAN. El ZIP contiene un `.xlsx` interno. |
| Reporte Siigo | `.xlsx` | Exportado desde Siigo → "Libro oficial de compras" |

El orden de subida no importa. La app detecta automáticamente cuál es cuál por extensión.

---

### Lógica de procesamiento

#### DIAN
1. Extraer el `.xlsx` del interior del `.zip`
2. Leer la hoja activa
3. **Columnas a conservar** (izquierda del IVA, siempre fijas):
   - Tipo de documento, CUFE/CUDE, Folio, Prefijo, Fecha Emisión, NIT Emisor, Nombre Emisor
4. **Columnas dinámicas** (de IVA hacia la derecha hasta Total):
   - `IVA` y `Total` siempre se conservan
   - Columnas intermedias (ICA, IC, INC, ICUI, Rete IVA, etc.) se conservan **solo si tienen algún valor ≠ 0** en cualquier fila
5. **Columnas que siempre se descartan**: todo lo que venga después de `Total` (Estado, Grupo, etc.), y antes de IVA: Divisa, Forma de Pago, Medio de Pago, Fecha Recepción, NIT Receptor, Nombre Receptor
6. Eliminar filas donde `Total == 0`
7. No ordenar todavía (el orden final lo determina el match)

#### Siigo
1. Detectar dinámicamente la fila de encabezados (primera fila cuya celda A sea `"Comprobante"`) — las filas anteriores son metadatos del reporte
2. **Columnas que siempre se eliminan**: Sucursal, Base gravada, Base exenta
3. **Columnas que se conservan**: Comprobante, Fecha elaboración, Identificación, Nombre tercero, Factura proveedor, IVA, Total
4. Eliminar filas donde `Nombre tercero` sea vacío (fila "Total general", pie de página, etc.)
5. Eliminar filas donde el Comprobante empiece por `DS` (devoluciones/salidas, no son facturas de compra)
6. Eliminar filas donde `Total == 0`

#### Match (cruce entre sistemas)
**Clave de cruce**: `Prefijo + "-" + Folio` del DIAN == `Factura proveedor` del Siigo

Ejemplos:
- DIAN Prefijo=`FEIP`, Folio=`88017` → clave `FEIP-88017` == Siigo Factura proveedor `FEIP-88017` ✅
- DIAN Prefijo=`FE20`, Folio=`143443` → clave `FE20-143443` == Siigo Factura proveedor `FE20-143443` ✅

Este parámetro es **el único criterio de match**. Fecha y monto no se usan (pueden diferir en notas crédito o ajustes).

---

### Output: `CONCILIACION_FACTURAS.xlsx`

#### Estructura de columnas

| Bloque | Columnas | Contenido |
|--------|----------|-----------|
| DIAN limpio | A → J (dinámico) | Columnas del DIAN después del filtro |
| Diferencia IVA | siguiente | Fórmula `= IVA_DIAN - IVA_Siigo` (solo en filas matcheadas) |
| Siigo limpio | siguientes | Total primero, luego: Comprobante, Fecha elaboración, Identificación, Nombre tercero, Factura proveedor, IVA |

#### Orden de filas y colores

| Grupo | Color fondo | Descripción |
|-------|-------------|-------------|
| 🔴 Grupo 1 | `#F2DCDB` | En DIAN, **no están** en Siigo → hay que registrarlas. Ordenadas por Total descendente. |
| 🟠 Grupo 2 | `#FDE9D9` | En Siigo, **no están** en la DIAN → posible error de prefijo/folio. Ordenadas por Total descendente. |
| 🟢 Grupo 3 | `#EBF1DE` | **Matcheadas** en ambos sistemas. Ordenadas por Total descendente. |

- Todo el texto en negro (`#000000`)
- Encabezados: fondo azul (`#4472C4`), texto blanco, negrilla
- Fuente: Trebuchet MS
- Columnas monetarias con separador de miles (`.` miles, `,` decimales — locale español)
- Ancho de columnas automático (CUFE/CUDE limitado a 18 por su longitud)

#### Resumen devuelto al usuario
```
🔴 Faltan en Siigo : N facturas
🟠 Extras en Siigo : N facturas
🟢 Matcheadas      : N facturas
```

---

### Notas y excepciones conocidas
- El ZIP de la DIAN contiene exactamente un `.xlsx`. Si esto cambia, el procesamiento falla limpiamente con un mensaje de error.
- Los comprobantes `DS-xxx` en Siigo son devoluciones y se excluyen intencionalmente.
- Si una factura tiene prefijo o folio mal digitado en Siigo, aparecerá en el Grupo 2 (extras en Siigo) en lugar de estar matcheada.

---

---

## Cómo añadir un módulo nuevo

1. Añadir una sección a este archivo con la misma estructura:
   - Ruta web, función backend, estado
   - Descripción del propósito
   - Tabla de inputs
   - Lógica de procesamiento paso a paso
   - Descripción del output (formato, columnas, colores si aplica)
   - Notas y casos especiales

2. Crear los archivos del módulo según las convenciones en `CLAUDE.md`

3. Añadir la tarjeta al dashboard (`pages/index.js`)
