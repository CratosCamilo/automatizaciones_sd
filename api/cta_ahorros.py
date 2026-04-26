from http.server import BaseHTTPRequestHandler
import json, base64, io
from datetime import datetime, date
from collections import defaultdict

TIPOS_EXCLUIDOS = {"N005", "N328", "N023", "N467", "N001"}

# ── DETECCIÓN DE FORMATO ──────────────────────────────────────────────────────
def es_sylk(data: bytes) -> bool:
    return data[:20].startswith(b"ID;PWXL") or data[:4].startswith(b"ID;P")


def detectar_archivos(bytes_a: bytes, bytes_b: bytes):
    if es_sylk(bytes_a) and not es_sylk(bytes_b):
        return bytes_a, bytes_b
    if es_sylk(bytes_b) and not es_sylk(bytes_a):
        return bytes_b, bytes_a
    raise ValueError(
        "No se pudo identificar cuál archivo es el banco (SYLK) y cuál es Siigo (XLSX). "
        "Verifica que subiste el extracto del banco y el reporte de Siigo."
    )


# ── PARSER SYLK PWXL ─────────────────────────────────────────────────────────
def parse_sylk(data: bytes):
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
                if p.startswith("Y"):   cur_row = int(p[1:])
                elif p.startswith("X"): cur_col = int(p[1:])
                elif p.startswith("K"):
                    val = p[1:]
                    if val.startswith('"') and val.endswith('"'):
                        val = val[1:-1]
                    grid[(cur_row, cur_col)] = val
        elif line.startswith("F;"):
            for p in line[2:].split(";"):
                if p.startswith("X"): cur_col = int(p[1:])
    return grid


def parse_fecha(s):
    if not s: return None
    try:
        return datetime.strptime(s.strip(), "%d/%m/%Y").date()
    except Exception:
        return None


def to_num(s):
    if not s: return 0.0
    try:
        return float(str(s).strip().replace(",", "."))
    except Exception:
        return 0.0


def to_num_maybe(s):
    if s is None or s == "": return ""
    try:
        f = float(str(s).strip().replace(",", "."))
        return int(f) if f == int(f) else f
    except Exception:
        return s


# ── BANCO RAW (para Hoja1, sin filtro de fecha) ───────────────────────────────
def leer_banco_raw(data: bytes):
    grid = parse_sylk(data)
    if not grid: return [], []
    max_row = max(r for r, c in grid)
    headers = [grid.get((2, c), "") for c in range(2, 11)]
    rows = []
    for r in range(3, max_row + 1):
        row_raw = [grid.get((r, c), "") for c in range(2, 11)]
        row_out = list(row_raw)
        row_out[2] = to_num_maybe(row_raw[2])   # Valor
        row_out[3] = to_num_maybe(row_raw[3])   # Saldo
        rows.append(row_out)
    return headers, rows


# ── BANCO FILTRADO (para DEBITO / CREDITO) ────────────────────────────────────
def leer_banco(data: bytes, fecha_ini: date, fecha_fin: date):
    grid = parse_sylk(data)
    if not grid: return [], []
    max_row = max(r for r, c in grid)
    positivos, negativos = [], []
    for r in range(3, max_row + 1):
        fecha_str = grid.get((r, 2), "")
        desc      = grid.get((r, 3), "")
        valor_str = grid.get((r, 4), "")
        tipo      = grid.get((r, 7), "")
        if desc in ("SALDO INICIAL", "SALDO FINAL"): continue
        f = parse_fecha(fecha_str)
        if not f or f < fecha_ini or f > fecha_fin: continue
        valor = to_num(valor_str)
        if valor == 0: continue
        if valor > 0:
            positivos.append((fecha_str, desc, valor))
        elif tipo not in TIPOS_EXCLUIDOS:
            negativos.append((fecha_str, desc, abs(valor), tipo))
    return positivos, negativos


# ── SIIGO ─────────────────────────────────────────────────────────────────────
def leer_siigo(data: bytes):
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True)
    ws = wb.active

    header_row = None
    for r in range(1, ws.max_row + 1):
        val = ws.cell(r, 3).value
        if val and str(val).strip() == "Comprobante":
            header_row = r
            break
    if header_row is None:
        raise ValueError("No se encontró la cabecera del reporte Siigo (columna 'Comprobante' en col C)")

    debitos, creditos = [], []
    for r in range(header_row + 2, ws.max_row + 1):
        comp      = ws.cell(r, 3).value
        fecha_raw = ws.cell(r, 5).value
        deb_val   = ws.cell(r, 13).value
        cred_val  = ws.cell(r, 14).value

        if comp is None and deb_val is None and cred_val is None: continue
        comp_str = str(comp).strip() if comp else ""
        if not comp_str or comp_str.startswith("Total") or comp_str.startswith("Cuenta contable"):
            continue

        if fecha_raw is None:
            fecha_str = ""
        elif hasattr(fecha_raw, "strftime"):
            fecha_str = fecha_raw.strftime("%d/%m/%Y")
        else:
            fecha_str = str(fecha_raw).strip()

        deb  = float(deb_val)  if deb_val  else 0.0
        cred = float(cred_val) if cred_val else 0.0

        if deb  > 0: debitos.append((comp_str, fecha_str, deb))
        if cred > 0:
            es_cc10 = comp_str.upper().startswith("CC-10")
            creditos.append((comp_str, fecha_str, cred, es_cc10))

    return debitos, creditos


# ── GENERAR EXCEL ─────────────────────────────────────────────────────────────
def generar_excel(banco_raw_headers, banco_raw_rows,
                  positivos_banco, negativos_banco,
                  siigo_deb, siigo_cred,
                  fecha_ini: date, fecha_fin: date):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    FONT  = "Trebuchet MS"
    SZ    = 12
    FMT   = '#,##0.00'

    # Paleta igual que módulo DIAN vs Siigo
    C_GREEN   = "FFEBF1DE"; C_GREEN_B   = "FF538135"
    C_YELLOW  = "FFFFFF00"; C_YELLOW_B  = "FFBF8F00"
    C_RED     = "FFF2DCDB"; C_RED_B     = "FFC00000"
    C_HEADER  = "FF4472C4"
    C_GRAY    = "FFD3D3D3"

    def font(bold=False, color="FF000000"):
        return Font(name=FONT, size=SZ, bold=bold, color=color)

    def fill(hex6):
        return PatternFill("solid", fgColor=hex6)

    def border(hex6):
        s = Side(style="thin", color=hex6)
        return Border(left=s, right=s, top=s, bottom=s)

    def center():
        return Alignment(horizontal="center")

    wb = openpyxl.Workbook()

    # ══════════════════════════════════════════════════════════
    # HOJA 1  — extracto bancario completo (9 columnas, sin Fecha Saldo)
    # ══════════════════════════════════════════════════════════
    ws1 = wb.active
    ws1.title = "Hoja1"

    for c, h in enumerate(banco_raw_headers, 1):
        cell = ws1.cell(1, c, h)
        cell.font      = font(bold=True)
        cell.fill      = fill(C_GRAY)
        cell.alignment = center()

    ws1.auto_filter.ref = f"A1:{ws1.cell(1, len(banco_raw_headers)).column_letter}1"

    col_widths = [14, 38, 14, 16, 14, 14, 28, 20, 40]
    for i, w in enumerate(col_widths, 1):
        ws1.column_dimensions[ws1.cell(1, i).column_letter].width = w

    for r, row_data in enumerate(banco_raw_rows, 2):
        for c, val in enumerate(row_data, 1):
            cell = ws1.cell(r, c, val if val != "" else None)
            cell.font = font()
            if c == 3: cell.number_format = FMT
            if c == 4: cell.number_format = FMT

    # ══════════════════════════════════════════════════════════
    # DEBITO  — A‑C Siigo | D sep | E Fecha | F Banco | G Diferencia | H Siigo
    # ══════════════════════════════════════════════════════════
    ws2 = wb.create_sheet("DEBITO")

    for c, h in enumerate(["Comprobante", "Fecha elaboración", "Débito"], 1):
        cell = ws2.cell(1, c, h)
        cell.font = font(bold=True, color="FFFFFFFF")
        cell.fill = fill(C_HEADER)
        cell.alignment = center()

    for c, h in enumerate(["Fecha", "Banco (suma día)", "Diferencia", "Siigo (suma día)"], 5):
        cell = ws2.cell(1, c, h)
        cell.font = font(bold=True, color="FFFFFFFF")
        cell.fill = fill(C_HEADER)
        cell.alignment = center()

    for col, w in {"A":16,"B":18,"C":16,"D":8,"E":14,"F":18,"G":16,"H":18}.items():
        ws2.column_dimensions[col].width = w

    siigo_deb_sorted = sorted(siigo_deb, key=lambda x: parse_fecha(x[1]) or date.min)
    for r, (comp, fecha_str, monto) in enumerate(siigo_deb_sorted, 2):
        ws2.cell(r, 1, comp).font = font()
        ws2.cell(r, 2, fecha_str).font = font()
        c3 = ws2.cell(r, 3, monto)
        c3.font = font()
        c3.number_format = FMT

    banco_por_fecha  = defaultdict(float)
    for fs, _, val in positivos_banco:
        f = parse_fecha(fs)
        if f: banco_por_fecha[f] += val

    siigo_por_fecha = defaultdict(float)
    for _, fs, monto in siigo_deb:
        f = parse_fecha(fs)
        if f: siigo_por_fecha[f] += monto

    all_dates = sorted(set(list(banco_por_fecha) + list(siigo_por_fecha)))
    for r, f in enumerate(all_dates, 2):
        banco_sum = banco_por_fecha.get(f, 0.0)
        siigo_sum = siigo_por_fecha.get(f, 0.0)
        diff      = banco_sum - siigo_sum

        ws2.cell(r, 5, f.strftime("%d/%m/%Y")).font = font()

        c6 = ws2.cell(r, 6, banco_sum); c6.font = font(); c6.number_format = FMT

        diff_val   = diff if abs(diff) > 0.01 else 0.0
        diff_color = "FFFF0000" if abs(diff) > 0.01 else "FF000000"
        c7 = ws2.cell(r, 7, diff_val); c7.font = font(color=diff_color); c7.number_format = FMT

        c8 = ws2.cell(r, 8, siigo_sum); c8.font = font(); c8.number_format = FMT

    # Total fila al final de columna G (Diferencia)
    if all_dates:
        last_data_row = len(all_dates) + 1
        total_row     = last_data_row + 1
        total_diff    = round(sum(banco_por_fecha.get(f,0)-siigo_por_fecha.get(f,0) for f in all_dates), 2)
        ct = ws2.cell(total_row, 7, total_diff)
        ct.font = font(bold=True)
        ct.number_format = FMT

    # ══════════════════════════════════════════════════════════
    # CREDITO  — orden: VERDE → AMARILLO → ROJO, luego por valor desc
    # Bordes del mismo color de la celda pero más oscuro
    # ══════════════════════════════════════════════════════════
    ws3 = wb.create_sheet("CREDITO")

    for c, h in enumerate(["Fecha Transacción","Descripción","Valor",
                            "Diferencia","Crédito Siigo","Comprobante","Fecha Siigo"], 1):
        cell = ws3.cell(1, c, h)
        cell.font = font(bold=True, color="FFFFFFFF")
        cell.fill = fill(C_HEADER)
        cell.alignment = center()

    for col, w in {"A":18,"B":38,"C":16,"D":16,"E":16,"F":16,"G":18}.items():
        ws3.column_dimensions[col].width = w

    # Construir pool de negativos banco
    banco_pool = defaultdict(list)
    for fecha_str, desc, val_abs, tipo in negativos_banco:
        banco_pool[round(val_abs, 2)].append((fecha_str, desc))

    # Clasificar créditos Siigo
    siigo_all = sorted(siigo_cred, key=lambda x: -x[2])
    verde_rows, amarillo_rows = [], []

    for comp, siigo_fecha, siigo_val, es_cc10 in siigo_all:
        key = round(siigo_val, 2)
        if banco_pool.get(key):
            banco_fecha, banco_desc = banco_pool[key].pop(0)
            rd = dict(sort_val=siigo_val, tipo="cc10_match" if es_cc10 else "match",
                      banco_fecha=banco_fecha, banco_desc=banco_desc,
                      banco_val=-siigo_val, siigo_val=siigo_val,
                      comp=comp, siigo_fecha=siigo_fecha)
            if es_cc10:
                amarillo_rows.append(rd)
            else:
                verde_rows.append(rd)
        else:
            # Sin match (incluyendo CC-10 sin match) → amarillo
            amarillo_rows.append(dict(sort_val=siigo_val, tipo="siigo_only",
                                      banco_fecha="", banco_desc="",
                                      banco_val=0, siigo_val=siigo_val,
                                      comp=comp, siigo_fecha=siigo_fecha))

    # Banco sin match → rojo
    rojo_rows = []
    for key, entries in banco_pool.items():
        for fecha_str, desc in entries:
            rojo_rows.append(dict(sort_val=key, tipo="banco_only",
                                  banco_fecha=fecha_str, banco_desc=desc))

    # Ordenar cada grupo por valor desc
    verde_rows.sort(key=lambda x: -x["sort_val"])
    amarillo_rows.sort(key=lambda x: -x["sort_val"])
    rojo_rows.sort(key=lambda x: -x["sort_val"])

    all_cred_rows = (
        [("siigo", r) for r in verde_rows] +
        [("siigo", r) for r in amarillo_rows] +
        [("banco", r) for r in rojo_rows]
    )

    for row_num, (row_type, rd) in enumerate(all_cred_rows, 2):
        tipo = rd["tipo"]

        if tipo == "match":
            fc, bc = C_GREEN, C_GREEN_B
        elif tipo in ("cc10_match", "siigo_only"):
            fc, bc = C_YELLOW, C_YELLOW_B
        else:
            fc, bc = C_RED, C_RED_B

        fl = fill(fc)
        br = border(bc)

        def wc(col, val, fmt=None):
            cell = ws3.cell(row_num, col, val)
            cell.font   = font()
            cell.fill   = fl
            cell.border = br
            if fmt: cell.number_format = fmt
            return cell

        if tipo in ("match", "cc10_match"):
            wc(1, rd["banco_fecha"])
            wc(2, rd["banco_desc"])
            wc(3, rd["banco_val"], FMT)
            diff = rd["banco_val"] + rd["siigo_val"]
            wc(4, diff if abs(diff) > 0.01 else None, FMT)
            wc(5, rd["siigo_val"], FMT)
            wc(6, rd["comp"])
            wc(7, rd["siigo_fecha"])

        elif tipo == "siigo_only":
            for c in range(1, 5):
                cell = ws3.cell(row_num, c)
                cell.fill = fl; cell.border = br
            wc(5, rd["siigo_val"], FMT)
            wc(6, rd["comp"])
            wc(7, rd["siigo_fecha"])

        else:  # banco_only
            wc(1, rd["banco_fecha"])
            wc(2, rd["banco_desc"])
            wc(3, -rd["sort_val"], FMT)
            for c in range(4, 8):
                cell = ws3.cell(row_num, c)
                cell.fill = fl; cell.border = br

    # ── Nombre de archivo ─────────────────────────────────────────────────────
    meses = {1:"ENERO",2:"FEBRERO",3:"MARZO",4:"ABRIL",5:"MAYO",6:"JUNIO",
             7:"JULIO",8:"AGOSTO",9:"SEPTIEMBRE",10:"OCTUBRE",11:"NOVIEMBRE",12:"DICIEMBRE"}
    filename = f"CTA AHORROS {meses.get(fecha_ini.month, str(fecha_ini.month))} {fecha_ini.year}.xlsx"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue(), filename


# ── HANDLER VERCEL ────────────────────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body   = json.loads(self.rfile.read(length))

            f1 = body.get("banco_b64", "") or body.get("file1_b64", "")
            f2 = body.get("siigo_b64", "") or body.get("file2_b64", "")
            if not f1 or not f2:
                raise ValueError("Faltan archivos requeridos")

            banco_bytes, siigo_bytes = detectar_archivos(
                base64.b64decode(f1), base64.b64decode(f2)
            )

            fecha_ini = datetime.strptime(body["fecha_inicio"], "%Y-%m-%d").date()
            fecha_fin = datetime.strptime(body["fecha_fin"],    "%Y-%m-%d").date()

            banco_raw_headers, banco_raw_rows = leer_banco_raw(banco_bytes)
            positivos, negativos              = leer_banco(banco_bytes, fecha_ini, fecha_fin)
            siigo_deb, siigo_cred             = leer_siigo(siigo_bytes)

            excel_bytes, filename = generar_excel(
                banco_raw_headers, banco_raw_rows,
                positivos, negativos,
                siigo_deb, siigo_cred,
                fecha_ini, fecha_fin
            )

            # Totales para el resumen del frontend
            total_deb_banco  = round(sum(r[2] for r in banco_raw_rows if isinstance(r[2], (int,float)) and r[2] > 0), 2)
            total_cred_banco = round(sum(abs(r[2]) for r in banco_raw_rows if isinstance(r[2], (int,float)) and r[2] < 0), 2)
            total_deb_siigo  = round(sum(m for _,_,m in siigo_deb), 2)
            total_cred_siigo = round(sum(m for _,_,m,_ in siigo_cred), 2)
            diff_deb         = round(total_deb_banco  - total_deb_siigo,  2)
            diff_cred        = round(total_cred_banco - total_cred_siigo, 2)

            response = {
                "archivo_b64": base64.b64encode(excel_bytes).decode(),
                "nombre":      filename,
                "resumen": {
                    "banco_positivos":   len(positivos),
                    "banco_negativos":   len(negativos),
                    "siigo_debitos":     len(siigo_deb),
                    "siigo_creditos":    len(siigo_cred),
                    "total_deb_banco":   total_deb_banco,
                    "total_deb_siigo":   total_deb_siigo,
                    "diff_deb":          diff_deb,
                    "total_cred_banco":  total_cred_banco,
                    "total_cred_siigo":  total_cred_siigo,
                    "diff_cred":         diff_cred,
                    "conciliado":        abs(diff_deb) < 1 and abs(diff_cred) < 1,
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
