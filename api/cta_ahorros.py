from http.server import BaseHTTPRequestHandler
import json, base64, io
from datetime import datetime, date
from collections import defaultdict

# ──────────────────────────────────────────────
# TIPOS DE TRANSACCIÓN EXCLUIDOS DEL CRÉDITO
# (impuestos y comisiones automáticas del banco)
# ──────────────────────────────────────────────
TIPOS_EXCLUIDOS = {"N005", "N328", "N023", "N467", "N001"}


# ──────────────────────────────────────────────
# DETECCIÓN DE FORMATO POR CONTENIDO
# ──────────────────────────────────────────────
def es_sylk(data: bytes) -> bool:
    """Devuelve True si el archivo es formato SYLK PWXL (banco Caja Social)."""
    head = data[:20]
    return head.startswith(b"ID;PWXL") or head.startswith(b"ID;P")


def detectar_archivos(bytes_a: bytes, bytes_b: bytes):
    """
    Recibe dos archivos en cualquier orden y devuelve (banco, siigo).
    Identifica el banco por la cabecera SYLK; el otro es el Siigo XLSX.
    """
    if es_sylk(bytes_a) and not es_sylk(bytes_b):
        return bytes_a, bytes_b
    if es_sylk(bytes_b) and not es_sylk(bytes_a):
        return bytes_b, bytes_a
    raise ValueError(
        "No se pudo identificar cuál archivo es el banco (SYLK) y cuál es Siigo (XLSX). "
        "Verifica que subiste el extracto del banco y el reporte de Siigo correctamente."
    )


# ──────────────────────────────────────────────
# PARSER DEL FORMATO SYLK (PWXL) DE CAJA SOCIAL
# ──────────────────────────────────────────────
def parse_sylk(data: bytes):
    """Devuelve dict {(row, col): value_str} a partir de un archivo SYLK PWXL."""
    try:
        content = data.decode("latin-1")
    except Exception:
        content = data.decode("utf-8", errors="replace")

    grid = {}
    cur_row, cur_col = 1, 1

    for raw_line in content.split("\n"):
        line = raw_line.strip()
        if line.startswith("C;"):
            parts = line[2:].split(";")
            for p in parts:
                if p.startswith("Y"):
                    cur_row = int(p[1:])
                elif p.startswith("X"):
                    cur_col = int(p[1:])
                elif p.startswith("K"):
                    val = p[1:]
                    if val.startswith('"') and val.endswith('"'):
                        val = val[1:-1]
                    grid[(cur_row, cur_col)] = val
        elif line.startswith("F;"):
            parts = line[2:].split(";")
            for p in parts:
                if p.startswith("X"):
                    cur_col = int(p[1:])

    return grid


def parse_fecha(s):
    """Parsea una fecha en formato DD/MM/YYYY."""
    if not s:
        return None
    try:
        return datetime.strptime(s.strip(), "%d/%m/%Y").date()
    except Exception:
        return None


def to_num(s):
    """Convierte string numérico del banco (puede tener puntos/comas) a float."""
    if not s:
        return 0.0
    s = str(s).strip().replace(",", ".")
    try:
        return float(s)
    except Exception:
        return 0.0


def to_num_maybe(s):
    """Convierte a número si es posible, sino devuelve el string original."""
    if s is None or s == "":
        return ""
    try:
        f = float(str(s).strip().replace(",", "."))
        return int(f) if f == int(f) else f
    except Exception:
        return s


# ──────────────────────────────────────────────
# LEER BANCO (SYLK) — datos crudos para Hoja1
# ──────────────────────────────────────────────
def leer_banco_raw(data: bytes):
    """
    Retorna (headers, rows) con TODAS las filas del banco para Hoja1.
    Columnas: Fecha Transacción (col2) ... Detalles Adicionales (col10).
    Se omite col1 (Fecha Saldo) y la fila de título (row1).
    """
    grid = parse_sylk(data)
    if not grid:
        return [], []

    max_row = max(r for r, c in grid)
    # Row 1 = título "Consulta de Saldos y Movimientos" → se omite
    # Row 2 = cabeceras (cols 2-10)
    headers = [grid.get((2, c), "") for c in range(2, 11)]

    rows = []
    for r in range(3, max_row + 1):
        row_raw = [grid.get((r, c), "") for c in range(2, 11)]
        # Convertir Valor (índice 2) y Saldo (índice 3) a número si es posible
        row_out = list(row_raw)
        row_out[2] = to_num_maybe(row_raw[2])  # Valor
        row_out[3] = to_num_maybe(row_raw[3])  # Saldo
        rows.append(row_out)

    return headers, rows


# ──────────────────────────────────────────────
# LEER BANCO (SYLK) — datos filtrados para DEBITO/CREDITO
# ──────────────────────────────────────────────
def leer_banco(data: bytes, fecha_ini: date, fecha_fin: date):
    """
    Retorna (positivos, negativos_incluidos)
    positivos:  [(fecha_str, desc, valor_abs)]  — entradas ABONO (dinero que entra)
    negativos:  [(fecha_str, desc, valor_abs, tipo)]  — salidas NO impuesto
    """
    grid = parse_sylk(data)
    if not grid:
        return [], []

    max_row = max(r for r, c in grid)
    positivos, negativos = [], []

    for r in range(3, max_row + 1):           # fila 2 = cabecera, datos desde fila 3
        fecha_str = grid.get((r, 2), "")      # col 2 = Fecha Transacción
        desc = grid.get((r, 3), "")           # col 3 = Descripción
        valor_str = grid.get((r, 4), "")      # col 4 = Valor
        tipo = grid.get((r, 7), "")           # col 7 = Tipo Transacción

        if desc in ("SALDO INICIAL", "SALDO FINAL"):
            continue

        fecha = parse_fecha(fecha_str)
        if not fecha:
            continue
        if fecha < fecha_ini or fecha > fecha_fin:
            continue

        valor = to_num(valor_str)
        if valor == 0:
            continue

        if valor > 0:
            positivos.append((fecha_str, desc, valor))
        else:
            if tipo not in TIPOS_EXCLUIDOS:
                negativos.append((fecha_str, desc, abs(valor), tipo))

    return positivos, negativos


# ──────────────────────────────────────────────
# LEER SIIGO (XLSX)
# ──────────────────────────────────────────────
def leer_siigo(data: bytes):
    """
    Retorna (debitos, creditos)
    debitos:  [(comprobante, fecha_str, monto)]
    creditos: [(comprobante, fecha_str, monto, es_cc10)]
    """
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True)
    ws = wb.active

    # Encontrar fila de cabecera (primera con "Comprobante" en col C)
    header_row = None
    for r in range(1, ws.max_row + 1):
        val = ws.cell(r, 3).value
        if val and str(val).strip() == "Comprobante":
            header_row = r
            break

    if header_row is None:
        raise ValueError("No se encontró la cabecera del reporte Siigo (columna 'Comprobante' en col C)")

    debitos, creditos = [], []

    for r in range(header_row + 2, ws.max_row + 1):  # +2 para saltar la fila de grupo
        comp = ws.cell(r, 3).value
        fecha_raw = ws.cell(r, 5).value
        deb_val = ws.cell(r, 13).value
        cred_val = ws.cell(r, 14).value

        if comp is None and deb_val is None and cred_val is None:
            continue
        comp_str = str(comp).strip() if comp else ""
        if not comp_str or comp_str.startswith("Total") or comp_str.startswith("Cuenta contable"):
            continue

        if fecha_raw is None:
            fecha_str = ""
        elif hasattr(fecha_raw, "strftime"):
            fecha_str = fecha_raw.strftime("%d/%m/%Y")
        else:
            fecha_str = str(fecha_raw).strip()

        deb = float(deb_val) if deb_val else 0.0
        cred = float(cred_val) if cred_val else 0.0

        if deb > 0:
            debitos.append((comp_str, fecha_str, deb))
        if cred > 0:
            es_cc10 = comp_str.upper().startswith("CC-10")
            creditos.append((comp_str, fecha_str, cred, es_cc10))

    return debitos, creditos


# ──────────────────────────────────────────────
# GENERAR EXCEL DE SALIDA
# ──────────────────────────────────────────────
def generar_excel(banco_raw_headers, banco_raw_rows,
                  positivos_banco, negativos_banco,
                  siigo_deb, siigo_cred,
                  fecha_ini: date, fecha_fin: date):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment

    FONT_NAME = "Trebuchet MS"
    FONT_SIZE = 12
    NUM_FMT = '#,##0.00'

    # Colores mismos que módulo DIAN vs Siigo
    COLOR_GREEN  = "FFEBF1DE"   # matcheados
    COLOR_RED    = "FFF2DCDB"   # banco sí, siigo no
    COLOR_YELLOW = "FFFFFF00"   # siigo sí banco no / CC-10
    COLOR_HEADER = "FF4472C4"   # azul encabezado (igual que DIAN)
    COLOR_GRAY   = "FFD3D3D3"   # encabezado Hoja1

    def make_font(bold=False, color="FF000000"):
        return Font(name=FONT_NAME, size=FONT_SIZE, bold=bold, color=color)

    def make_fill(hex_color):
        return PatternFill("solid", fgColor=hex_color)

    def center():
        return Alignment(horizontal="center")

    wb = openpyxl.Workbook()

    # ═══════════════════════════════════════════════════════════
    # HOJA 1: extracto bancario completo (9 cols, sin Fecha Saldo)
    # ═══════════════════════════════════════════════════════════
    ws1 = wb.active
    ws1.title = "Hoja1"

    # Cabecera
    for c, h in enumerate(banco_raw_headers, 1):
        cell = ws1.cell(1, c, h)
        cell.font = make_font(bold=True)
        cell.fill = make_fill(COLOR_GRAY)
        cell.alignment = center()

    col_widths_h1 = [14, 38, 14, 16, 14, 14, 28, 20, 40]
    for i, w in enumerate(col_widths_h1, 1):
        ws1.column_dimensions[ws1.cell(1, i).column_letter].width = w

    for r, row_data in enumerate(banco_raw_rows, 2):
        for c, val in enumerate(row_data, 1):
            cell = ws1.cell(r, c, val if val != "" else None)
            cell.font = make_font()
            if c == 3:   # Valor
                cell.number_format = NUM_FMT
            if c == 4:   # Saldo
                cell.number_format = NUM_FMT

    # ═══════════════════════════════════════════════════════════
    # HOJA DEBITO
    # Col: A=Comprobante | B=Fecha elab | C=Débito Siigo | D=(sep) |
    #      E=Fecha | F=Banco(suma día) | G=Diferencia | H=Siigo(suma día)
    # ═══════════════════════════════════════════════════════════
    ws2 = wb.create_sheet("DEBITO")

    left_headers = ["Comprobante", "Fecha elaboración", "Débito"]
    for c, h in enumerate(left_headers, 1):
        cell = ws2.cell(1, c, h)
        cell.font = make_font(bold=True, color="FFFFFFFF")
        cell.fill = make_fill(COLOR_HEADER)
        cell.alignment = center()

    right_headers = ["Fecha", "Banco (suma día)", "Diferencia", "Siigo (suma día)"]
    for c, h in enumerate(right_headers, 5):
        cell = ws2.cell(1, c, h)
        cell.font = make_font(bold=True, color="FFFFFFFF")
        cell.fill = make_fill(COLOR_HEADER)
        cell.alignment = center()

    col_widths_deb = {"A": 16, "B": 18, "C": 16, "D": 8, "E": 14, "F": 18, "G": 16, "H": 18}
    for col, w in col_widths_deb.items():
        ws2.column_dimensions[col].width = w

    siigo_deb_sorted = sorted(siigo_deb, key=lambda x: parse_fecha(x[1]) or date.min)
    for r, (comp, fecha_str, monto) in enumerate(siigo_deb_sorted, 2):
        ws2.cell(r, 1, comp).font = make_font()
        ws2.cell(r, 2, fecha_str).font = make_font()
        cell = ws2.cell(r, 3, monto)
        cell.font = make_font()
        cell.number_format = NUM_FMT

    # Sumas por fecha — banco positivos
    banco_por_fecha = defaultdict(float)
    for fecha_str, desc, val in positivos_banco:
        f = parse_fecha(fecha_str)
        if f:
            banco_por_fecha[f] += val

    # Sumas por fecha — siigo débitos
    siigo_por_fecha = defaultdict(float)
    for comp, fecha_str, monto in siigo_deb:
        f = parse_fecha(fecha_str)
        if f:
            siigo_por_fecha[f] += monto

    all_dates = sorted(set(list(banco_por_fecha.keys()) + list(siigo_por_fecha.keys())))
    for r, f in enumerate(all_dates, 2):
        fecha_str = f.strftime("%d/%m/%Y")
        banco_sum = banco_por_fecha.get(f, 0.0)
        siigo_sum = siigo_por_fecha.get(f, 0.0)
        diff = banco_sum - siigo_sum

        ws2.cell(r, 5, fecha_str).font = make_font()

        cell_banco = ws2.cell(r, 6, banco_sum)
        cell_banco.font = make_font()
        cell_banco.number_format = NUM_FMT

        # Diferencia en rojo si ≠ 0
        diff_color = "FFFF0000" if abs(diff) > 0.01 else "FF000000"
        cell_diff = ws2.cell(r, 7, diff if abs(diff) > 0.01 else 0)
        cell_diff.font = make_font(color=diff_color)
        cell_diff.number_format = NUM_FMT

        cell_siigo = ws2.cell(r, 8, siigo_sum)
        cell_siigo.font = make_font()
        cell_siigo.number_format = NUM_FMT

    # ═══════════════════════════════════════════════════════════
    # HOJA CREDITO
    # 4 casos de color:
    #   Verde  (#EBF1DE): banco+siigo matcheados, no CC-10
    #   Rojo   (#F2DCDB): banco sí, siigo no
    #   Amarillo (FFFF00): siigo sí, banco no (cualquier comp) O CC-10 con match
    # ═══════════════════════════════════════════════════════════
    ws3 = wb.create_sheet("CREDITO")

    cred_headers = ["Fecha Transacción", "Descripción", "Valor",
                    "Diferencia", "Crédito Siigo", "Comprobante", "Fecha Siigo"]
    for c, h in enumerate(cred_headers, 1):
        cell = ws3.cell(1, c, h)
        cell.font = make_font(bold=True, color="FFFFFFFF")
        cell.fill = make_fill(COLOR_HEADER)
        cell.alignment = center()

    col_widths_cred = {"A": 18, "B": 38, "C": 16, "D": 16, "E": 16, "F": 16, "G": 18}
    for col, w in col_widths_cred.items():
        ws3.column_dimensions[col].width = w

    # Pool de negativos banco indexados por valor_abs
    banco_pool = defaultdict(list)
    for fecha_str, desc, val_abs, tipo in negativos_banco:
        key = round(val_abs, 2)
        banco_pool[key].append((fecha_str, desc))

    # Todos los créditos Siigo ordenados por valor desc
    siigo_all = sorted(siigo_cred, key=lambda x: -x[2])

    siigo_rows = []
    for comp, siigo_fecha, siigo_val, es_cc10 in siigo_all:
        key = round(siigo_val, 2)
        if banco_pool.get(key):
            banco_fecha, banco_desc = banco_pool[key].pop(0)
            # Matcheado: verde si no CC-10, amarillo si CC-10
            siigo_rows.append({
                "sort_val": siigo_val,
                "tipo": "cc10_match" if es_cc10 else "match",
                "banco_fecha": banco_fecha,
                "banco_desc": banco_desc,
                "banco_val": -siigo_val,
                "siigo_val": siigo_val,
                "comp": comp,
                "siigo_fecha": siigo_fecha,
            })
        else:
            # Sin match en banco → amarillo (incluye CC-10 sin match)
            siigo_rows.append({
                "sort_val": siigo_val,
                "tipo": "siigo_only",
                "banco_fecha": "",
                "banco_desc": "",
                "banco_val": 0,
                "siigo_val": siigo_val,
                "comp": comp,
                "siigo_fecha": siigo_fecha,
            })

    # Filas banco sin match → rojo
    banco_rows = []
    for key, entries in banco_pool.items():
        for fecha_str, desc in entries:
            banco_rows.append({"sort_val": key, "tipo": "banco_only",
                               "banco_fecha": fecha_str, "banco_desc": desc})
    banco_rows.sort(key=lambda x: -x["sort_val"])

    # Merge-sort por valor desc
    all_rows = []
    si, bi = 0, 0
    while si < len(siigo_rows) or bi < len(banco_rows):
        sv = siigo_rows[si]["sort_val"] if si < len(siigo_rows) else -1
        bv = banco_rows[bi]["sort_val"] if bi < len(banco_rows) else -1
        if sv >= bv:
            all_rows.append(siigo_rows[si]); si += 1
        else:
            all_rows.append(banco_rows[bi]); bi += 1

    for row_num, rd in enumerate(all_rows, 2):
        tipo = rd["tipo"]

        if tipo == "match":
            fill = make_fill(COLOR_GREEN)
        elif tipo in ("cc10_match", "siigo_only"):
            fill = make_fill(COLOR_YELLOW)
        else:  # banco_only
            fill = make_fill(COLOR_RED)

        def wc(col, val, fmt=None):
            cell = ws3.cell(row_num, col, val if val != 0 or col not in (3, 4) else None)
            cell.font = make_font()
            cell.fill = fill
            if fmt:
                cell.number_format = fmt
            return cell

        if tipo in ("match", "cc10_match"):
            wc(1, rd["banco_fecha"])
            wc(2, rd["banco_desc"])
            wc(3, rd["banco_val"], NUM_FMT)
            diff = rd["banco_val"] + rd["siigo_val"]
            wc(4, diff if abs(diff) > 0.01 else None, NUM_FMT)
            wc(5, rd["siigo_val"], NUM_FMT)
            wc(6, rd["comp"])
            wc(7, rd["siigo_fecha"])

        elif tipo == "siigo_only":
            # Solo Siigo — cols 5-7
            for c in range(1, 5):
                ws3.cell(row_num, c).fill = fill
            wc(5, rd["siigo_val"], NUM_FMT)
            wc(6, rd["comp"])
            wc(7, rd["siigo_fecha"])

        else:  # banco_only
            wc(1, rd["banco_fecha"])
            wc(2, rd["banco_desc"])
            wc(3, -rd["sort_val"], NUM_FMT)
            for c in range(4, 8):
                ws3.cell(row_num, c).fill = fill

    # Nombre del archivo de salida
    meses_es = {1: "ENERO", 2: "FEBRERO", 3: "MARZO", 4: "ABRIL", 5: "MAYO",
                6: "JUNIO", 7: "JULIO", 8: "AGOSTO", 9: "SEPTIEMBRE",
                10: "OCTUBRE", 11: "NOVIEMBRE", 12: "DICIEMBRE"}
    mes_nombre = meses_es.get(fecha_ini.month, str(fecha_ini.month))
    filename = f"CTA AHORROS {mes_nombre} {fecha_ini.year}.xlsx"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue(), filename


# ──────────────────────────────────────────────
# HANDLER VERCEL
# ──────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))

            file1_b64 = body.get("banco_b64", "") or body.get("file1_b64", "")
            file2_b64 = body.get("siigo_b64", "") or body.get("file2_b64", "")
            fecha_ini_str = body.get("fecha_inicio", "")
            fecha_fin_str = body.get("fecha_fin", "")

            if not file1_b64 or not file2_b64:
                raise ValueError("Faltan archivos requeridos")

            bytes_a = base64.b64decode(file1_b64)
            bytes_b = base64.b64decode(file2_b64)

            # Auto-detectar cuál es banco y cuál es Siigo por contenido
            banco_bytes, siigo_bytes = detectar_archivos(bytes_a, bytes_b)

            fecha_ini = datetime.strptime(fecha_ini_str, "%Y-%m-%d").date()
            fecha_fin = datetime.strptime(fecha_fin_str, "%Y-%m-%d").date()

            # Datos para Hoja1 (todos los registros del banco, sin filtro de fecha)
            banco_raw_headers, banco_raw_rows = leer_banco_raw(banco_bytes)

            # Datos filtrados para DEBITO y CREDITO
            positivos, negativos = leer_banco(banco_bytes, fecha_ini, fecha_fin)
            siigo_deb, siigo_cred = leer_siigo(siigo_bytes)

            excel_bytes, filename = generar_excel(
                banco_raw_headers, banco_raw_rows,
                positivos, negativos,
                siigo_deb, siigo_cred,
                fecha_ini, fecha_fin
            )

            result_b64 = base64.b64encode(excel_bytes).decode()
            response = {
                "archivo_b64": result_b64,
                "nombre": filename,
                "resumen": {
                    "banco_positivos": len(positivos),
                    "banco_negativos": len(negativos),
                    "siigo_debitos": len(siigo_deb),
                    "siigo_creditos": len(siigo_cred),
                }
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
