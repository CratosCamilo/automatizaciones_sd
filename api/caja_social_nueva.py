import json, base64, math
from io import BytesIO
from http.server import BaseHTTPRequestHandler
from collections import Counter

import openpyxl
from openpyxl.styles import PatternFill, Font, Border, Side

# ── Constants ─────────────────────────────────────────────────────────────────
GRAVAMEN = "GRAVAMEN MOVS FINANCIEROS"
DCTOS    = "DCTOS DE NOMINA"
ESPECIALES = {GRAVAMEN, DCTOS}

C_GREEN  = "FFE8F5E9"
C_YELLOW = "FFFFFCCC"
C_RED    = "FFFFEBEE"

_side  = Side(style="thin", color="FF000000")
BORDER = Border(left=_side, right=_side, top=_side, bottom=_side)


def _fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)


def _font(bold=False):
    return Font(name="Trebuchet MS", bold=bold, size=10)


# ── Amount parsing ────────────────────────────────────────────────────────────
def parse_monto(s):
    """Parse Colombian-format string '1.234.567,00' or numeric value to int."""
    if s is None or s == "":
        return 0
    if isinstance(s, (int, float)):
        try:
            v = float(s)
            return 0 if math.isnan(v) else int(v)
        except Exception:
            return 0
    cleaned = str(s).strip().replace(".", "").replace(",", ".")
    try:
        return int(float(cleaned))
    except Exception:
        return 0


# ── Bank parsing ──────────────────────────────────────────────────────────────
def leer_banco(data_b64):
    """Return (debito_rows, credito_rows) from CS Nueva Página XLSX.
    Each row tuple: (fecha, desc, doc, amount, info)
    """
    wb = openpyxl.load_workbook(BytesIO(base64.b64decode(data_b64)), data_only=True)
    ws = wb.active

    header_found = False
    fecha_i = desc_i = doc_i = deb_i = cred_i = info_i = None

    debito_rows  = []
    credito_rows = []

    for row in ws.iter_rows(values_only=True):
        if not header_found:
            vals = [str(c).lower() if c else "" for c in row]
            if any("fecha" in v for v in vals) and any("bito" in v for v in vals):
                header_found = True
                for i, v in enumerate(vals):
                    if "fecha" in v and fecha_i is None:
                        fecha_i = i
                    elif "escripci" in v and desc_i is None:
                        desc_i = i
                    elif "ocumento" in v and doc_i is None:
                        doc_i = i
                    elif "bito" in v and "cr" not in v and deb_i is None:
                        deb_i = i
                    elif "r" in v and "dito" in v and cred_i is None:
                        cred_i = i
                    elif "nformaci" in v and info_i is None:
                        info_i = i
            continue

        if fecha_i is None:
            continue

        fecha    = row[fecha_i]  if fecha_i  is not None else None
        desc     = row[desc_i]   if desc_i   is not None else None
        doc      = row[doc_i]    if doc_i    is not None else None
        deb_raw  = row[deb_i]    if deb_i    is not None else None
        cred_raw = row[cred_i]   if cred_i   is not None else None
        info     = row[info_i]   if info_i   is not None else None

        if fecha is None and desc is None:
            continue

        deb_amt  = parse_monto(deb_raw)
        cred_amt = parse_monto(cred_raw)

        fecha_s = str(fecha) if fecha else ""
        desc_s  = str(desc)  if desc  else ""
        doc_s   = str(doc)   if doc   else ""
        info_s  = str(info)  if info  else ""

        if deb_amt > 0:
            debito_rows.append((fecha_s, desc_s, doc_s, deb_amt, info_s))
        elif cred_amt > 0:
            credito_rows.append((fecha_s, desc_s, doc_s, cred_amt, info_s))

    return debito_rows, credito_rows


# ── Siigo parsing ─────────────────────────────────────────────────────────────
def leer_siigo(data_b64):
    """Return (siigo_credito, siigo_debito) as lists of (comp, fecha, ident, amount).
    siigo_credito → cross-matches CS Débito
    siigo_debito  → cross-matches CS Crédito
    """
    wb = openpyxl.load_workbook(BytesIO(base64.b64decode(data_b64)), data_only=True)
    ws = wb.active

    header_found  = False
    siigo_credito = []
    siigo_debito  = []

    for row in ws.iter_rows(values_only=True):
        if not header_found:
            if row[2] is not None and str(row[2]).strip() == "Comprobante":
                header_found = True
            continue

        comp = row[2]
        if not comp:
            continue
        comp_s = str(comp).strip()
        if not comp_s:
            continue

        fecha     = row[4]
        ident     = row[5]
        deb_amt   = parse_monto(row[12])
        cred_amt  = parse_monto(row[13])

        fecha_s = str(fecha) if fecha else ""
        ident_s = str(ident) if ident else ""

        if deb_amt > 0:
            siigo_debito.append((comp_s, fecha_s, ident_s, deb_amt))
        if cred_amt > 0:
            siigo_credito.append((comp_s, fecha_s, ident_s, cred_amt))

    return siigo_credito, siigo_debito


# ── Matching ──────────────────────────────────────────────────────────────────
def match_multiset(bank_rows, siigo_entries):
    """Multiset match by amount.
    Returns bank_matched (set of indices) and siigo_only (list of siigo entries).
    """
    siigo_counter = Counter(e[3] for e in siigo_entries)

    bank_matched = set()
    for i, row in enumerate(bank_rows):
        amt = row[3]
        if siigo_counter.get(amt, 0) > 0:
            siigo_counter[amt] -= 1
            bank_matched.add(i)

    remaining = dict(siigo_counter)
    siigo_only = []
    for entry in siigo_entries:
        amt = entry[3]
        if remaining.get(amt, 0) > 0:
            remaining[amt] -= 1
            siigo_only.append(entry)

    return bank_matched, siigo_only


# ── Excel generation ──────────────────────────────────────────────────────────
def _write_data_row(ws, row_idx, values, fill_color, hidden=False):
    fill = _fill(fill_color)
    for col_idx, val in enumerate(values, 1):
        cell = ws.cell(row=row_idx, column=col_idx, value=val)
        cell.font   = _font()
        cell.border = BORDER
        cell.fill   = fill
        if col_idx == 4 and isinstance(val, (int, float)):
            cell.number_format = "#,##0"
    if hidden:
        ws.row_dimensions[row_idx].hidden = True


def _write_header(ws, headers, col_count):
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=h)
        cell.font   = Font(name="Trebuchet MS", bold=True, color="FFFFFFFF", size=10)
        cell.fill   = PatternFill("solid", fgColor="FF4472C4")
        cell.border = BORDER
    col_letter = chr(ord("A") + col_count - 1)
    ws.auto_filter.ref = f"A1:{col_letter}1"


def _set_col_widths(ws, widths):
    for letter, w in widths.items():
        ws.column_dimensions[letter].width = w


def generar_excel(debito_rows, credito_rows, siigo_credito, siigo_debito):
    deb_matched,  siigo_cred_only = match_multiset(debito_rows,  siigo_credito)
    cred_matched, siigo_deb_only  = match_multiset(credito_rows, siigo_debito)

    wb = openpyxl.Workbook()

    # ── DEBITO sheet ──────────────────────────────────────────────────────────
    ws_deb = wb.active
    ws_deb.title = "DEBITO"
    _set_col_widths(ws_deb, {"A": 14, "B": 35, "C": 15, "D": 18, "E": 45})
    _write_header(ws_deb,
                  ["Fecha", "Descripción", "Documento", "-Débito", "Información Adicional"],
                  5)

    total_gravamen = 0
    total_dctos    = 0
    row_idx = 2

    # Sort all CS Débito rows descending by amount (special rows hidden wherever they fall)
    for orig_i, (fecha, desc, doc, amt, info) in sorted(enumerate(debito_rows), key=lambda x: -x[1][3]):
        is_especial = desc in ESPECIALES
        is_matched  = orig_i in deb_matched

        if is_especial:
            color  = C_RED
            hidden = True
            if desc == GRAVAMEN:
                total_gravamen += amt
            else:
                total_dctos += amt
        elif is_matched:
            color  = C_GREEN
            hidden = False
        else:
            color  = C_RED
            hidden = False

        _write_data_row(ws_deb, row_idx, [fecha, desc, doc, amt, info], color, hidden)
        row_idx += 1

    # Siigo-only rows (yellow, appended)
    for comp, fecha, ident, amt in siigo_cred_only:
        _write_data_row(ws_deb, row_idx, [fecha, comp, ident, amt, ""], C_YELLOW)
        row_idx += 1

    # Blank separator
    row_idx += 1

    # Total rows for special concepts
    for label, total in [(GRAVAMEN, total_gravamen), (DCTOS, total_dctos)]:
        for col_idx, val in [(2, label), (4, total)]:
            cell = ws_deb.cell(row=row_idx, column=col_idx, value=val)
            cell.font   = _font(bold=True)
            cell.border = BORDER
            if col_idx == 4:
                cell.number_format = "#,##0"
        row_idx += 1

    # ── CREDITO sheet ─────────────────────────────────────────────────────────
    ws_cred = wb.create_sheet("CREDITO")
    _set_col_widths(ws_cred, {"A": 14, "B": 35, "C": 15, "D": 18, "E": 45})
    _write_header(ws_cred,
                  ["Fecha", "Descripción", "Documento", "+Crédito", "Información Adicional"],
                  5)

    row_idx_c = 2
    for orig_i, (fecha, desc, doc, amt, info) in sorted(enumerate(credito_rows), key=lambda x: -x[1][3]):
        color = C_GREEN if orig_i in cred_matched else C_RED
        _write_data_row(ws_cred, row_idx_c, [fecha, desc, doc, amt, info], color)
        row_idx_c += 1

    # Siigo-only rows (yellow)
    for comp, fecha, ident, amt in siigo_deb_only:
        _write_data_row(ws_cred, row_idx_c, [fecha, comp, ident, amt, ""], C_YELLOW)
        row_idx_c += 1

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Totals ────────────────────────────────────────────────────────────────────
def calcular_totales(debito_rows, credito_rows, siigo_credito, siigo_debito):
    total_cs_deb   = sum(r[3] for r in debito_rows)
    total_sii_cred = sum(e[3] for e in siigo_credito)
    total_cs_cred  = sum(r[3] for r in credito_rows)
    total_sii_deb  = sum(e[3] for e in siigo_debito)

    return {
        "salida": {
            "banco":      total_cs_deb,
            "siigo":      total_sii_cred,
            "diferencia": total_cs_deb - total_sii_cred,
        },
        "entrada": {
            "banco":      total_cs_cred,
            "siigo":      total_sii_deb,
            "diferencia": total_cs_cred - total_sii_deb,
        },
        "conciliado": (total_cs_deb == total_sii_cred and total_cs_cred == total_sii_deb),
    }


# ── HTTP Handler ──────────────────────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body   = json.loads(self.rfile.read(length))

        try:
            debito_rows, credito_rows = leer_banco(body["banco"])
            siigo_credito, siigo_debito = leer_siigo(body["siigo"])

            excel_bytes = generar_excel(debito_rows, credito_rows, siigo_credito, siigo_debito)
            totales     = calcular_totales(debito_rows, credito_rows, siigo_credito, siigo_debito)

            payload = {"excel": base64.b64encode(excel_bytes).decode(), **totales}
            self._respond(200, payload)

        except Exception as exc:
            import traceback
            self._respond(500, {"error": str(exc), "detail": traceback.format_exc()})

    def _respond(self, status, data):
        resp = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(resp)))
        self.end_headers()
        self.wfile.write(resp)

    def log_message(self, *args):
        pass
