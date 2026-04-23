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

## Módulo 2 — Movimientos Bancarios

**Ruta web**: `/movimientos`  
**Función backend**: `api/movimientos.py`  
**Estado**: ✅ Activo

### ¿Para qué sirve?
Toma los archivos de movimientos de **Banco Caja Social** y **Bancolombia**, los filtra al rango de fechas indicado y genera un Excel organizado por día (de menor a mayor monto) con el total de cada día. Se usa para el reporte semanal de ingresos.

---

### Inputs

| Archivo | Formato | Origen |
|---------|---------|--------|
| Movimientos Caja Social | `.xlsx` | Descargado del portal Banco Caja Social. Hoja: `AccountMovementsExtended`. Incluye días fuera del rango solicitado. |
| Movimientos Bancolombia | `.xlsx` | Descargado de Tus Cuentas Bancolombia. Hoja: `Hoja 1`. Ya trae el rango exacto. |
| Fecha inicio | parámetro | Fecha desde (inclusive). Necesaria porque Caja Social bota más días de los pedidos. |
| Fecha fin | parámetro | Fecha hasta (inclusive). |

El sistema detecta automáticamente cuál archivo es de cada banco por el nombre de la hoja interna.

---

### Lógica de procesamiento

#### Caja Social
1. Detectar hoja `AccountMovementsExtended`
2. Saltar filas 1–9 (metadatos del reporte: titular, número de cuenta, etc.)
3. **Columnas a conservar**: Fecha (col B), Débito (col F), Crédito (col G)
4. **Columnas que se eliminan**: Descripción, Documento, Oficina, Información Adicional
5. Parsear los montos de string español (`'9.000,00'`) a entero (`9000`)
6. **Filtrar por fecha**: conservar solo filas dentro del rango indicado
7. Eliminar filas donde Débito == 0 y Crédito == 0

#### Bancolombia
1. Detectar hoja `Hoja 1`; encabezado en fila 1, datos desde fila 2
2. **Filas que se eliminan**:
   - `IMPTO GOBIERNO 4X1000` — impuesto automático del banco
   - `ABONO INTERESES AHORROS` — rendimientos de cuenta corriente
3. **Filtrar por fecha**: conservar solo filas dentro del rango indicado
4. Los montos ya vienen como números; se convierten a entero si no tienen decimales

#### Organización por día (ambos bancos)
1. Agrupar filas por fecha
2. Dentro de cada día:
   - **Caja Social**: ordenar ascendente por Crédito (menor a mayor)
   - **Bancolombia**: negativos (débitos) primero ordenados ascendente, luego positivos ordenados ascendente
3. Escribir las filas del día
4. Fila de total al final del día (SUM solo de filas positivas en Bancolombia)
5. Espacio vacío entre días: 4 filas tras el primero, 3 tras los demás, 0 al final

---

### Output: `SEMANA {D} AL {D} {MES} {AÑO}.xlsx`

Ejemplo: `SEMANA 13 AL 19 ABRIL 2026.xlsx`

#### Estructura — Hoja 1: Caja Social

| Columna | Contenido |
|---------|-----------|
| A | Fecha (`DD/MM/YYYY`) |
| B–D | Vacías (espaciado visual) |
| E | Débito (si aplica) |
| F | Crédito |

- Fila total: columna F, fórmula `=SUM(F_inicio:F_fin)`, negrita, tamaño 20
- Sin colores de fondo en filas de datos

#### Estructura — Hoja 2: Bancolombia

| Columna | Contenido |
|---------|-----------|
| A | Fecha (`mm-dd-yy`) |
| B | Descripción |
| C | Referencia |
| D | Valor (positivo = crédito, negativo = débito) |

- Encabezado: negrita, fondo `#F2F2F4`, alineación centrada
- Fila total: columna D, fórmula que **excluye las filas negativas** del SUM, negrita, tamaño 20
- Los débitos van antes de los positivos en cada día pero no se incluyen en el total

#### Formato general
- Fuente: Trebuchet MS, tamaño 12
- Totales: Trebuchet MS, tamaño 20, negrita
- Columnas monetarias: formato contable `_-* #,##0.00_-;...`

---

### Notas y excepciones conocidas
- Caja Social puede exportar rangos más amplios que los pedidos; la fecha de corte se aplica siempre.
- Si ambos archivos son detectados como el mismo banco, la función devuelve un error descriptivo.
- Las filas `DS-xxx` de Caja Social no aparecen en este reporte (son devoluciones de otros módulos).

---

---

## Módulo 3 — Davivienda + Redeban QR

**Ruta web**: `/davivienda`
**Función backend**: `api/davivienda.py`
**Estado**: ✅ Activo

### ¿Para qué sirve?
Arma la conciliación quincenal (1–15 o 16–último del mes) del banco Davivienda del papá de Slendy, por donde entran los pagos QR de los carros y algunos pagos de PAES.

Davivienda es incómodo porque:
1. No deja seleccionar rango de fecha al descargar (trae días de más).
2. No dice los nombres de las personas que consignan por QR (aparece solo como "Pago A Llave De Comercio").

El CSV de Redeban QR complementa el banco con los nombres (enmascarados, ej. `JUL*** ALE*** ROD***`). Este módulo cruza ambos archivos por fecha+valor y devuelve el Excel quincenal listo.

---

### Inputs

| Archivo | Formato | Origen |
|---------|---------|--------|
| Reporte Davivienda | `.xlsx` | Descargado del portal de Davivienda. Hoja única con 10 columnas. |
| Consulta Redeban | `.csv` | Exportado del portal Redeban QR. Delimitador `;`. |
| Fecha inicio | parámetro | Inclusive (normalmente día 1 o 16). |
| Fecha fin | parámetro | Inclusive (normalmente día 15 o último del mes). |

---

### Lógica de procesamiento

#### Davivienda
1. Leer la hoja activa (encabezado en fila 1).
2. **Columnas que se conservan**: `Fecha de Sistema`, `Descripción motivo`, `Transacción`, `Valor Total`.
3. **Columnas que se eliminan**: Documento, Oficina de Recaudo, ID Origen/Destino, Valor Cheque, Referencia 1, Referencia 2.
4. Parsear `Valor Total` desde string español (`"$ 1.807,00"` → `1807`); se deja como `int` si es entero o con 2 decimales si no.
5. **Filtrar por fecha**: conservar solo filas dentro del rango.
6. Filas con `Valor Total` vacío o 0 se descartan.

#### Redeban (CSV)
1. Delimitador `;`, codificación UTF-8 (fallback latin-1).
2. **Filtrar `Estado == ACEPTADA`** (las rechazadas se descartan).
3. **Columnas que se usan**: `Emisor`, `Valor`, `Fecha`.
4. `Fecha` viene como `"2026-04-15 16:56:00.0"` — se queda solo con los primeros 10 caracteres (YYYY-MM-DD).
5. `Valor` viene como float con punto decimal (`"300000.00"`); se normaliza igual que en Davivienda.
6. **Filtrar por fecha**: conservar solo filas dentro del rango.

#### Cruce
- **Clave**: `(fecha, valor)` expresada como `(date, int_centavos)`.
- Para cada fila de Davivienda cuya `Descripción motivo.strip() == "Pago A Llave De Comercio"`, se busca una entrada de Redeban que matchee la clave. Si hay match, la descripción se reemplaza por el `Emisor` del CSV.
- Si hay varias entradas de Redeban con la misma clave, se asignan en orden (stable).
- Las filas sin match conservan el texto original.

---

### Output: `SEMANA {D} AL {D} {MES} {AÑO}.xlsx`

Ejemplo: `SEMANA 1 AL 15 ABRIL 2026.xlsx`.

#### Hoja única: `Movimientos1`

| Columna | Contenido | Ancho |
|---------|-----------|-------|
| A | Fecha de Sistema (`DD/MM/YYYY` como texto) | 13.28 |
| B | Descripción motivo (ya con nombre cuando aplica) | 73.43 |
| C | Transacción (`Nota Débito` / `Nota Crédito`) | 15.57 |
| D | Valor Total | 20.14 |

#### Orden de filas
1. `Fecha` ascendente.
2. `Valor Total` ascendente dentro de cada día.
3. Desempate: `Descripción` descendente (Z→A), para que nombres (C***, U***) vayan antes que `Abono ACH…` cuando coinciden fecha y valor.

#### Formato
- Fuente: **Trebuchet MS**, tamaño 12.
- Encabezado fila 1: negrilla, fondo gris `#B2AEAE`.
- **Notas Débito** (salidas): toda la fila en rojo `#FF0000`. Notas Crédito en negro (default).
- Columna D con formato contable `_-* #,##0.00_-;...`.

---

### Headers devueltos al frontend
```
X-Total-Rows: total de filas escritas
X-Matched:    Pago A Llave matcheados con Redeban
X-Unmatched:  Pago A Llave sin match (debería ser 0)
X-Extras:     entradas de Redeban sin match en Davivienda (debería ser 0)
```

---

### Notas y excepciones conocidas
- Si `X-Unmatched > 0` o `X-Extras > 0`, hay un desfase entre banco y Redeban — el UI muestra una advertencia amarilla.
- Davivienda descarga rangos más amplios que los pedidos; el filtro de fecha siempre se aplica.
- Rechazadas en Redeban se descartan automáticamente (no se consideran ingresos).

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
