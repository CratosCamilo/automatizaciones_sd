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

## Módulo 2 — Bancos Semanal

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

---

## Módulo 4 — Cta Ahorros Caja Social

**Ruta web**: `/cta-ahorros`  
**Función backend**: `api/cta_ahorros.py`  
**Estado**: ✅ Activo

### ¿Para qué sirve?
Concilia la cuenta de ahorros de Caja Social con Siigo. Genera tres hojas:
- **Hoja1**: extracto bancario limpio con todos los movimientos del período.
- **DEBITO**: compara los débitos de Siigo contra los totales diarios del banco.
- **CREDITO**: cruza los créditos de Siigo (abonos) contra los ingresos del banco por valor, detectando los que cuadran y los que sobran.

---

### Inputs

| Archivo | Formato | Origen |
|---------|---------|--------|
| Extracto Caja Social | `.xls` | Descargado del portal Banco Caja Social. **Formato interno SYLK PWXL** (no es XLS real). |
| Reporte Siigo | `.xlsx` | Exportado desde Siigo. Encabezado dinámico (primera fila con "Código contable" en col C). |
| Fecha inicio | parámetro | Inclusive. |
| Fecha fin | parámetro | Inclusive. |

---

### Lógica de procesamiento

#### Banco (SYLK PWXL)
1. El archivo `.xls` tiene cabecera `ID;PWXL;N;E` — se parsea manualmente línea a línea.
2. Las líneas `C;` definen valores de celda; las líneas `F;` actualizan el puntero de columna (cur_col) sin escribir valor.
3. **Columnas usadas**: col 2 = Fecha Transacción, col 3 = Descripción, col 4 = Valor, col 7 = Tipo Transacción.
4. Se descartan filas con descripción `SALDO INICIAL` o `SALDO FINAL`.
5. Se filtra por rango de fechas.
6. Filas positivas (Valor > 0) → `positivos_banco`.
7. Filas negativas (Valor < 0) → `negativos_banco`, excluyendo los **tipos impuesto**:
   - N005 (RETEFUENTE), N328 (RETEICA), N023 (ND COMISION ADQUIRENCIA), N467 (DESC COMISION T-DEB), N001 (GRAVAMEN MOVS FINANCIEROS).

#### Siigo (XLSX)
1. Detectar dinámicamente la fila de encabezado: primera fila donde col C == `"Comprobante"`.
2. Datos desde la fila siguiente.
3. Se omiten filas con comprobante vacío, que comiencen por `"Total"` o `"Cuenta contable"` (son subtotales y metadatos).
4. **Débitos** (`Débito > 0`): comprobantes CC-13-xxx, TD-xxx, RC-xxx, etc. → `siigo_debitos`.
5. **Créditos** (`Crédito > 0`): comprobantes RP-xxx, CC-10-xx, etc. → `siigo_creditos`.
   - Los CC-10-xx son "notas de ajuste" y reciben tratamiento especial (ver CREDITO).

#### Match CREDITO (cruce por valor)
1. Se construye un pool de entradas bancarias negativas (valores absolutos).
2. Los créditos Siigo se ordenan por monto descendente.
3. Para cada crédito Siigo, se busca un banco con el mismo valor absoluto:
   - Si hay match: genera fila en CREDITO (con datos del banco a la izquierda, Siigo a la derecha).
   - Si **no hay match y es CC-10**: se **descarta silenciosamente** (su contrapartida bancaria fue excluida como impuesto).
   - Si no hay match y es otro comprobante: genera fila solo-Siigo (sin banco).
4. Los bancos sin match (banco_only) se insertan por valor en la lista final (merge-sort descendente).

---

### Output: `CTA AHORROS {MES} {AÑO}.xlsx`

Ejemplo: `CTA AHORROS MARZO 2026.xlsx`

#### Hoja 1: `Hoja1` — Extracto bancario

| Columna | Contenido |
|---------|-----------|
| A | Fecha Transacción |
| B | Descripción |
| C | Valor |
| D | Tipo Transacción |

Filas ordenadas por fecha ascendente, luego por valor absoluto descendente.

#### Hoja 2: `DEBITO` — Comparación Siigo débitos vs banco

| Bloque | Columnas | Contenido |
|--------|----------|-----------|
| Siigo | A–C | Comprobante, Fecha elaboración, Monto Siigo |
| Banco | E–H | Fecha, Total banco día, Total Siigo día, Diferencia (banco - siigo) |

- Columnas E–H agrupan movimientos por día: el banco suma todos los negativos del día (excluyendo impuestos), Siigo suma los débitos del mismo día.
- La diferencia indica si hay movimientos bancarios no registrados en Siigo o viceversa.

#### Hoja 3: `CREDITO` — Cruce de créditos por valor

| Columna | Contenido |
|---------|-----------|
| A | Fecha Transacción (banco) |
| B | Descripción (banco) |
| C | Valor banco (negativo) |
| D | Diferencia (= C + E) — vacía si solo banco o solo Siigo |
| E | Crédito Siigo |
| F | Comprobante Siigo |
| G | Fecha Siigo |

- Filas CC-10 con match: fondo **amarillo** (`FFFF00`).
- Filas banco_only (sin Siigo): solo columnas A–C.
- Filas siigo_only (sin banco): solo columnas E–G.
- Orden: merge-sort por valor descendente entre siigo_rows y banco_only.

#### Formato general
- Fuente: Trebuchet MS, tamaño 12.
- Números: formato `#,##0.00`.
- Encabezados: negrilla.

#### Resumen devuelto al frontend
```
banco_positivos:  N entradas positivas del banco
banco_negativos:  N entradas negativas (excl. impuestos)
siigo_debitos:    N débitos Siigo
siigo_creditos:   N créditos Siigo (excl. CC-10 sin match)
```

---

### Notas y excepciones conocidas
- El archivo `.xls` de Caja Social no es XLS real — es formato SYLK PWXL. Se parsea manualmente.
- Las líneas `F;` en SYLK también actualizan el puntero de columna; ignorarlas causaría que los valores queden en la columna equivocada.
- Los tipos de impuesto (N005, N328, N023, N467, N001) se excluyen de los negativos y por eso sus CC-10 correspondientes en Siigo tampoco aparecen en CREDITO.
- Si un CC-10 de Siigo no tiene contrapartida bancaria con el mismo valor, se descarta (no se muestra en ninguna hoja del output).

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

---

## Módulo 5 — Caja Social Nueva

**Ruta web**: `/caja-social-nueva`  
**Función backend**: `api/caja_social_nueva.py`  
**Estado**: ✅ Activo

### ¿Para qué sirve?
Concilia el extracto XLSX de la **nueva página web** de Caja Social con Siigo.  
A diferencia del módulo 4 (que usaba el formato SYLK de la página vieja), este módulo recibe un `.xlsx` con columnas en un layout diferente y montos en formato colombiano ('1.234.567,00').

La lógica de cruce es invertida respecto al módulo 4:
- **CS Débito** (salidas del banco) ↔ **Siigo Crédito** (asiento contable que reduce el activo bancario)
- **CS Crédito** (entradas al banco) ↔ **Siigo Débito** (asiento contable que aumenta el activo bancario)

---

### Inputs

| Archivo | Formato | Origen |
|---------|---------|--------|
| Extracto Caja Social | `.xlsx` | Descargado desde la nueva página de Caja Social (sheet: AccountMovementsExtended) |
| Siigo | `.xlsx` | Exportado desde Siigo → Movimiento auxiliar por cuenta contable (cuenta 11200501) |

---

### Lógica de procesamiento

1. **Lectura del banco**: se detecta la fila de encabezado buscando la fila que contenga tanto 'Fecha' como 'Débito'. Se leen cols Fecha, Descripción, Documento, -Débito, +Crédito, Información Adicional. Los montos ('1.234.567,00') se parsean a entero.

2. **Separación**: filas con Débito > 0 → grupo Débito. Filas con Crédito > 0 → grupo Crédito.

3. **Lectura de Siigo**: se detecta el encabezado buscando la fila donde col C == 'Comprobante'. Se toman col 12 (Débito) y col 13 (Crédito). Se omiten filas de totales/vacías.

4. **Cruce por valor (multiset)**: cada valor de CS Débito se busca en Siigo Crédito. Cada valor de CS Crédito se busca en Siigo Débito. La coincidencia es por monto exacto.

5. **Output Excel** (dos hojas):

#### Hoja 1: `DEBITO`
Columnas: Fecha, Descripción, Documento, -Débito, Información Adicional  
- Ordenada descendente por -Débito.  
- **Verde**: CS Débito que coincide con un Siigo Crédito.  
- **Rojo**: CS Débito sin match en Siigo (incluyendo GRAVAMEN MOVS FINANCIEROS y DCTOS DE NOMINA).  
- **Amarillo**: Siigo Crédito sin match en banco (filas appended al final).  
- GRAVAMEN MOVS FINANCIEROS y DCTOS DE NOMINA: rojos + **ocultos** por filtro.  
- Al final: fila en blanco + dos filas de total (una por concepto especial), valor en col D.

#### Hoja 2: `CREDITO`
Columnas: Fecha, Descripción, Documento, +Crédito, Información Adicional  
- Ordenada descendente por +Crédito.  
- **Verde**: CS Crédito que coincide con un Siigo Débito.  
- **Rojo**: CS Crédito sin match.  
- **Amarillo**: Siigo Débito sin match en banco (filas appended al final).  
- Filtro activo en encabezado.

#### Respuesta JSON al frontend
```
excel:      base64 del archivo .xlsx
salida.banco:      sum CS Débito
salida.siigo:      sum Siigo Crédito
salida.diferencia: banco - siigo
entrada.banco:     sum CS Crédito
entrada.siigo:     sum Siigo Débito
entrada.diferencia: banco - siigo
conciliado:        true si ambas diferencias == 0
```

---

### Notas y excepciones conocidas
- Los montos en el extracto bancario vienen como strings con formato colombiano ('1.234.567,00'); se parsean eliminando puntos y reemplazando la coma por punto decimal.
- La detección del encabezado es robusta: busca la fila que contenga simultáneamente 'fecha' y 'bito' (de Débito) para no confundir con la fila 'Fecha del reporte'.
- Los conceptos especiales (GRAVAMEN, DCTOS DE NOMINA) se ocultan independientemente de si cuadran con Siigo o no.
- El Siigo puede tener más meses que el banco; los valores que no coincidan quedan como 'Siigo only' (amarillo).
