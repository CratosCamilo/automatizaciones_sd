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


# ──────────────────────────────────────────────
# LEER BANCO (SYLK)
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

    for r in range(2, max_row + 1):           # fila 1 = título, fila 2 = cabecera
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
        raise ValueError("No se encontró la cabecera del reporte Siigo")

    debitos, creditos = [], []

    for r in range(header_row + 2, ws.max_row + 1):  # +2 para saltar la fila de grupo
        comp = ws.cell(r, 3).value
        fecha_raw = ws.cell(r, 5).value
        deb_val = ws.cell(r, 13).value
        cred_val = ws.cell(r, 14).value

        if comp is None and deb_val is None and cred_val is None:
            continue
        comp_str = str(comp).strip() if comp else ""
        # Saltar filas de totales o sin comprobante
        if not comp_str or comp_str.startswith("Total") or comp_str.startswith("Cuenta contable"):
            continue

        # Normalizar fecha
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
def generar_excel(positivos_banco, negativos_banco, siigo_deb, siigo_cred,
                  fecha_ini: date, fecha_fin: date):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, numbers

    FONT_NAME = "Trebuchet MS"
    FONT_SIZE = 12
    YELLOW = "FFFFFF00"
    HEADER_FILL = "FFD3D3D3"
    NUM_FMT = '#,##0.00'

    def header_font():
        return Font(name=FONT_NAME, size=FONT_SIZE, bold=True)

    def body_font(bold=False):
        return Font(name=FONT_NAME, size=FONT_SIZE, bold=bold)

    wb = openpyxl.Workbook()

    # ── HOJA 1: datos completos del banco ──────────────────────────────────
    ws1 = wb.active
    ws1.title = "Hoja1"

    # Encabezado
    headers1 = ["Fecha Transacción", "Descripción", "Valor"]
    for c, h in enumerate(headers1, 1):
        cell = ws1.cell(1, c, h)
        cell.font = header_font()
        cell.fill = PatternFill("solid", fgColor=HEADER_FILL)
        cell.alignment = Alignment(horizontal="center")

    ws1.column_dimensions["A"].width = 18
    ws1.column_dimensions["B"].width = 40
    ws1.column_dimensions["C"].width = 18

    # Combinar positivos y negativos para Hoja1 (todos, sin filtrar tipos)
    # Usamos los datos crudos del banco ya filtrados por fecha
    all_bank = []
    for fecha_str, desc, val in positivos_banco:
        all_bank.append((fecha_str, desc, val))
    for fecha_str, desc, val_abs, tipo in negativos_banco:
        all_bank.append((fecha_str, desc, -val_abs))
    # también añadir los excluidos de CREDITO (impuestos) — son datos reales del banco
    # (no los tenemos separados aquí, pero los negativos incluidos ya son suficientes)

    # Ordenar por fecha, luego por valor desc
    def sort_key(item):
        f = parse_fecha(item[0])
        return (f or date.min, -abs(item[2]))

    all_bank.sort(key=sort_key)

    for r, (fecha_str, desc, val) in enumerate(all_bank, 2):
        ws1.cell(r, 1, fecha_str).font = body_font()
        ws1.cell(r, 2, desc).font = body_font()
        c3 = ws1.cell(r, 3, val)
        c3.font = body_font()
        c3.number_format = NUM_FMT

    # ── HOJA DEBITO ────────────────────────────────────────────────────────
    ws2 = wb.create_sheet("DEBITO")

    # Cabecera izquierda (Siigo)
    deb_left_headers = ["Comprobante", "Fecha elaboración", "Débito"]
    for c, h in enumerate(deb_left_headers, 1):
        cell = ws2.cell(1, c, h)
        cell.font = header_font()
        cell.fill = PatternFill("solid", fgColor=HEADER_FILL)
        cell.alignment = Alignment(horizontal="center")

    # Cabecera derecha (comparación por fecha)
    for c, h in enumerate(["Fecha", "Banco (suma día)", "Siigo (suma día)", "Diferencia"], 5):
        cell = ws2.cell(1, c, h)
        cell.font = header_font()
        cell.fill = PatternFill("solid", fgColor=HEADER_FILL)
        cell.alignment = Alignment(horizontal="center")

    ws2.column_dimensions["A"].width = 16
    ws2.column_dimensions["B"].width = 18
    ws2.column_dimensions["C"].width = 16
    ws2.column_dimensions["D"].width = 4
    ws2.column_dimensions["E"].width = 14
    ws2.column_dimensions["F"].width = 18
    ws2.column_dimensions["G"].width = 18
    ws2.column_dimensions["H"].width = 16

    # Siigo debitos ordenados por fecha
    siigo_deb_sorted = sorted(siigo_deb, key=lambda x: parse_fecha(x[1]) or date.min)

    for r, (comp, fecha_str, monto) in enumerate(siigo_deb_sorted, 2):
        ws2.cell(r, 1, comp).font = body_font()
        ws2.cell(r, 2, fecha_str).font = body_font()
        c3 = ws2.cell(r, 3, monto)
        c3.font = body_font()
        c3.number_format = NUM_FMT

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

    # Todas las fechas del período
    all_dates = sorted(set(list(banco_por_fecha.keys()) + list(siigo_por_fecha.keys())))

    for r, f in enumerate(all_dates, 2):
        fecha_str = f.strftime("%d/%m/%Y")
        banco_sum = banco_por_fecha.get(f, 0.0)
        siigo_sum = siigo_por_fecha.get(f, 0.0)
        diff = banco_sum - siigo_sum

        ws2.cell(r, 5, fecha_str).font = body_font()
        for c, val in [(6, banco_sum), (7, siigo_sum), (8, diff)]:
            cell = ws2.cell(r, c, val)
            cell.font = body_font()
            cell.number_format = NUM_FMT

    # ── HOJA CREDITO ───────────────────────────────────────────────────────
    ws3 = wb.create_sheet("CREDITO")

    cred_headers = ["Fecha Transacción", "Descripción", "Valor",
                    "Diferencia", "Crédito Siigo", "Comprobante", "Fecha Siigo"]
    for c, h in enumerate(cred_headers, 1):
        cell = ws3.cell(1, c, h)
        cell.font = header_font()
        cell.fill = PatternFill("solid", fgColor=HEADER_FILL)
        cell.alignment = Alignment(horizontal="center")

    ws3.column_dimensions["A"].width = 18
    ws3.column_dimensions["B"].width = 38
    ws3.column_dimensions["C"].width = 18
    ws3.column_dimensions["D"].width = 16
    ws3.column_dimensions["E"].width = 18
    ws3.column_dimensions["F"].width = 16
    ws3.column_dimensions["G"].width = 18

    # Pool de negativos banco indexados por valor_abs
    banco_pool = defaultdict(list)
    for fecha_str, desc, val_abs, tipo in negativos_banco:
        key = round(val_abs, 2)
        banco_pool[key].append((fecha_str, desc))

    # Siigo créditos todos juntos ordenados por valor desc
    # Las CC-10 se resaltan en amarillo pero van en su posición natural por valor
    siigo_all = sorted(siigo_cred, key=lambda x: -x[2])

    # Filas procesadas del lado Siigo
    siigo_rows = []   # (sort_val, is_matched, banco_fecha, banco_desc, banco_val, siigo_val, comp, siigo_fecha, es_cc10)
    for comp, siigo_fecha, siigo_val, es_cc10 in siigo_all:
        key = round(siigo_val, 2)
        if banco_pool.get(key):
            banco_fecha, banco_desc = banco_pool[key].pop(0)
            siigo_rows.append((siigo_val, True,
                               banco_fecha, banco_desc, -siigo_val,
                               siigo_val, comp, siigo_fecha, es_cc10))
        elif not es_cc10:
            # Crédito Siigo sin match en banco (excluir las CC-10 sin match)
            siigo_rows.append((siigo_val, False,
                               "", "", 0,
                               siigo_val, comp, siigo_fecha, es_cc10))
        # Si es CC-10 sin match → se omite ("sacar las CC-10 sin match")

    # Filas banco sin match
    banco_rows = []
    for key, entries in banco_pool.items():
        for fecha_str, desc in entries:
            banco_rows.append((key, fecha_str, desc))
    banco_rows.sort(key=lambda x: -x[0])

    # Merge de dos listas ordenadas por valor desc
    all_rows = []
    si, bi = 0, 0
    while si < len(siigo_rows) or bi < len(banco_rows):
        sv = siigo_rows[si][0] if si < len(siigo_rows) else -1
        bv = banco_rows[bi][0] if bi < len(banco_rows) else -1
        if sv >= bv:
            r = siigo_rows[si]; si += 1
            all_rows.append(("siigo", r))
        else:
            r = banco_rows[bi]; bi += 1
            all_rows.append(("banco", r))

    # Escribir filas en CREDITO
    for row_num, (row_type, row_data) in enumerate(all_rows, 2):
        yellow_fill = PatternFill("solid", fgColor=YELLOW)

        if row_type == "siigo":
            (sort_val, is_matched,
             banco_fecha, banco_desc, banco_val,
             siigo_val, comp, siigo_fecha, es_cc10) = row_data

            ws3.cell(row_num, 1, banco_fecha).font = body_font()
            ws3.cell(row_num, 2, banco_desc).font = body_font()
            c3 = ws3.cell(row_num, 3, banco_val if banco_val != 0 else "")
            c3.font = body_font()
            if banco_val != 0:
                c3.number_format = NUM_FMT

            diff = banco_val + siigo_val
            c4 = ws3.cell(row_num, 4, diff)
            c4.font = body_font()
            c4.number_format = NUM_FMT

            c5 = ws3.cell(row_num, 5, siigo_val)
            c5.font = body_font()
            c5.number_format = NUM_FMT

            ws3.cell(row_num, 6, comp).font = body_font()
            ws3.cell(row_num, 7, siigo_fecha).font = body_font()

            if es_cc10:
                for c in range(1, 8):
                    ws3.cell(row_num, c).fill = yellow_fill

        else:  # banco_only
            (sort_val, banco_fecha, banco_desc) = row_data
            ws3.cell(row_num, 1, banco_fecha).font = body_font()
            ws3.cell(row_num, 2, banco_desc).font = body_font()
            c3 = ws3.cell(row_num, 3, -sort_val)
            c3.font = body_font()
            c3.number_format = NUM_FMT
            c4 = ws3.cell(row_num, 4, -sort_val)
            c4.font = body_font()
            c4.number_format = NUM_FMT

    # Nombre del archivo de salida
    meses_es = {1:"ENERO",2:"FEBRERO",3:"MARZO",4:"ABRIL",5:"MAYO",
                6:"JUNIO",7:"JULIO",8:"AGOSTO",9:"SEPTIEMBRE",
                10:"OCTUBRE",11:"NOVIEMBRE",12:"DICIEMBRE"}
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

            banco_b64 = body.get("banco_b64", "")
            siigo_b64 = body.get("siigo_b64", "")
            fecha_ini_str = body.get("fecha_inicio", "")
            fecha_fin_str = body.get("fecha_fin", "")

            if not banco_b64 or not siigo_b64:
                raise ValueError("Faltan archivos requeridos")

            banco_bytes = base64.b64decode(banco_b64)
            siigo_bytes = base64.b64decode(siigo_b64)

            fecha_ini = datetime.strptime(fecha_ini_str, "%Y-%m-%d").date()
            fecha_fin = datetime.strptime(fecha_fin_str, "%Y-%m-%d").date()

            positivos, negativos = leer_banco(banco_bytes, fecha_ini, fecha_fin)
            siigo_deb, siigo_cred = leer_siigo(siigo_bytes)

            excel_bytes, filename = generar_excel(
                positivos, negativos, siigo_deb, siigo_cred,
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
