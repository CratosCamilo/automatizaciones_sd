"""
Vercel Python serverless function — Configuración editable de listas.

Endpoints:
  GET  /api/config?name=proveedores  → lista actual desde Blob (o defaults si vacío)
  GET  /api/config?name=alias        → dict actual desde Blob (o defaults si vacío)
  POST /api/config?name=proveedores  → sobrescribe la lista en Blob
  POST /api/config?name=alias        → sobrescribe el dict en Blob

Storage: Vercel Blob (público). Base URL derivada del token BLOB_READ_WRITE_TOKEN.

Formato en Blob (JSON):
  proveedores.json: [{"nit": "...", "nombre": "..."}, ...]
  alias.json:       [{"clave": "...", "alias": "..."}, ...]

Ambos como arrays de objetos para tener orden estable + simpleza en el editor.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.parse
import urllib.request


# ─────────────────────────────────────────────────────────────────────────────
# DEFAULTS (usados como seed inicial + fallback si Blob no responde)
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_PROVEEDORES = [
    {'nit': '900039901',  'nombre': 'ENERTOTAL S.A. E.S.P.'},
    {'nit': '39028745',   'nombre': 'ACEVEDO DE PINILLA LEONOR'},
    {'nit': '830055643',  'nombre': 'CINEMARK COLOMBIA S.A.S.'},
    {'nit': '901300741',  'nombre': 'COESCO COLOMBIA SAS'},
    {'nit': '830122566',  'nombre': 'COLOMBIA TELECOMUNICACIONES S.A. E.S.P. BIC'},
    {'nit': '800153993',  'nombre': 'COMUNICACION CELULAR S A  COMCEL S A'},
    {'nit': '901419009',  'nombre': 'CR VET SAS'},
    {'nit': '890903858',  'nombre': 'INDUSTRIA NACIONAL DE GASEOSAS S.A.S.'},
    {'nit': '900280342',  'nombre': 'DISTRIBUCIONES HICAR SAS'},
    {'nit': '901893895',  'nombre': 'LA CERVECERIA EXPRESS BODEGA'},
    {'nit': '900648058',  'nombre': 'LONG HANG S.A.S.'},
    {'nit': '901137699',  'nombre': 'MINISO COLOMBIA S.A.S'},
    {'nit': '830037946',  'nombre': 'PANAMERICANA LIBRERÍA Y PAPELERÍA S.A.'},
    {'nit': '890903939',  'nombre': 'POSTOBON S.A.'},
    {'nit': '830112317',  'nombre': 'PROCAFECOL S.A.'},
    {'nit': '900843898',  'nombre': 'RAPPI S.A.S'},
    {'nit': '800242106',  'nombre': 'SODIMAC COLOMBIA S.A.'},
    {'nit': '900777063',  'nombre': 'SPORTY CITY S.A.S.'},
    {'nit': '890100577',  'nombre': 'AEROVIAS DEL CONTINENTE AMERICANO, S.A. AVIANCA - COLOMBIA'},
    {'nit': '800216499',  'nombre': 'AGOFER S.A.S.'},
    {'nit': '860027404',  'nombre': 'ALLIANZ SEGUROS DE VIDA S A'},
    {'nit': '901275662',  'nombre': 'ALMACEN Y TALLER TODO NISSAN A&T S.A.S.'},
    {'nit': '900366586',  'nombre': 'ASOCIACION UNION NACIONAL DE COMERCIANTES DE SANTA MARTA'},
    {'nit': '901724890',  'nombre': 'C&C INVERSIONES SURTIPROYECTOS S.A.S.'},
    {'nit': '901707429',  'nombre': 'CACHARRERIA Y PAPELERÍA CLAUDIA LA 14'},
    {'nit': '57270083',   'nombre': 'DIENITH MARIA OROZCO FONSECA'},
    {'nit': '890101691',  'nombre': 'GASES DEL CARIBE S A EMPRESA DE SERVICIOS PUBLICOS GASCARIBE S A E S P'},
    {'nit': '901132430',  'nombre': 'HIDRODINAMICA SM S.A.S'},
    {'nit': '800251569',  'nombre': 'INTER RAPIDISIMO S.A'},
    {'nit': '901510218',  'nombre': 'inversiones GA distribuciones sas'},
    {'nit': '891700842',  'nombre': 'JARDINES DE PAZ DE SANTA MARTA LTDA'},
    {'nit': '1081794799', 'nombre': 'JULYS ROCIO GUTIERREZ CABALLERO'},
    {'nit': '91002437',   'nombre': 'PEDRO AMESQUITA BENITEZ'},
    {'nit': '1193225562', 'nombre': 'MARIA  JOSE  OLARTE LACERA '},
    {'nit': '900167723',  'nombre': 'MULTIDESARROLLOS URBANOS S.A.S.'},
    {'nit': '900834997',  'nombre': 'PROQUIMAG SAS'},
    {'nit': '900031973',  'nombre': 'PUERTO DIESEL LTDA'},
    {'nit': '63506621',   'nombre': 'RUBIELA GOMEZ MORENO'},
    {'nit': '830512656',  'nombre': 'PRODUCTOS INDUSTRIALES Y ASESORIAS S.A.S. PROINAS S.A.S'},
    {'nit': '900724151',  'nombre': 'SOLAB SAS'},
    {'nit': '901433765',  'nombre': 'SOLO RODAMIENTOS Y RETENES SAS'},
    {'nit': '800027374',  'nombre': 'TECNOLOGIA ALIMENTARIA S.A.S. BIC'},
    {'nit': '57428408',   'nombre': 'TIANA ISABEL MARCUCCI BECERRA'},
    {'nit': '900092385',  'nombre': 'UNE EPM TELECOMUNICACIONES S.A'},
    {'nit': '891780160',  'nombre': 'CAMARA DE COMERCIO DE SANTA MARTA PARA EL MAGDALENA'},
    {'nit': '901916738',  'nombre': 'INDUSTRIAS WESCOLD OUTLET SAS'},
    {'nit': '900486370',  'nombre': 'YOYO S.A.S.'},
    {'nit': '901798108',  'nombre': 'COMERCIALIZADORA INTEGRAL DE TECNOLOGIA S.A.S.'},
    {'nit': '890200928',  'nombre': 'COOPERATIVA SANTANDEREANA DE TRANSPORTADORES LIMITADA'},
    {'nit': '819001879',  'nombre': 'BASCULAS Y BALANZAS DE LA COSTA LTDA'},
    {'nit': '92517327',   'nombre': 'ALIRIO DANILO OLIVERA CORREA'},
    {'nit': '890900943',  'nombre': 'COLOMBIANA DE COMERCIO S.A.'},
    {'nit': '901229027',  'nombre': 'ECOLPLAGAS S.A.S'},
    {'nit': '860008424',  'nombre': 'HANSEATICA SAS'},
    {'nit': '860037013',  'nombre': 'COMPAÑIA MUNDIAL DE SEGUROS S.A.'},
    {'nit': '900375008',  'nombre': 'PROVINAS SAS'},
    {'nit': '901214287',  'nombre': 'SOINGTEL'},
    {'nit': '900543551',  'nombre': 'CORREAS GUAYAS Y ENSAMBLES S.A.S.'},
    {'nit': '800144352',  'nombre': 'HIDROANDINA Y COMPAÑIA LIMITADA'},
    {'nit': '860009578',  'nombre': 'SEGUROS DEL ESTADO S.A.'},
    {'nit': '900430690',  'nombre': 'FIRENZECORP S.A.S'},
    {'nit': '1128191884', 'nombre': 'HERRAMIENTAS EXPRESS'},
    {'nit': '800185781',  'nombre': 'AEROREPUBLICA S.A.'},
    {'nit': '800242394',  'nombre': 'ALMACEN REFRIELECTRIC S.A.S'},
    {'nit': '890929497',  'nombre': 'MAPER S.A.S'},
    {'nit': '860003981',  'nombre': 'COLMAQUINAS S.A.'},
]

DEFAULT_ALIAS = [
    {'clave': 'CAR ALB PLA PIM',    'alias': 'POLLO'},
    {'clave': 'SUL LAU VID SAN',    'alias': 'WALDIR'},
    {'clave': 'YOL PEN GUT',        'alias': 'ENRIQUE'},
    {'clave': 'UIL DE JES OSO',     'alias': 'PAISA'},
    {'clave': 'BLA NID OCA OCA',    'alias': 'NIDIA'},
    {'clave': 'LEA DAV LAM BAR',    'alias': 'LEAN/DAVID'},
    {'clave': 'JUL ALE ROD CAS',    'alias': 'JULIAN'},
    {'clave': 'WEN JOH ORT LOP',    'alias': 'GUSTAVO'},
    {'clave': 'CAR BON',            'alias': 'FERNANDO'},
    {'clave': 'JAD VAL ROD OCA',    'alias': 'RAUL'},
    {'clave': 'ANA MAR RAC CAS',    'alias': 'DEIVID'},
    {'clave': 'JES DAV REY SIL',    'alias': 'DAVID'},
    {'clave': 'JIM MAN MOS',        'alias': 'NIDIA'},
    {'clave': 'GUS RAF MER GON',    'alias': 'GUSTAVO'},
    {'clave': 'MAR FER PIN BLA',    'alias': 'HECTOR'},
    {'clave': 'MIG HER RUE ESC',    'alias': 'HECTOR'},
    {'clave': 'VIC MAN ORT CAS',    'alias': 'KOALA'},
    {'clave': 'LUI RIC QUI PER',    'alias': 'LUIS QUINTERO'},
    {'clave': 'AND DAV ORT ESP',    'alias': 'ASESORIAS Y CAPACITACIONES N&M S.A.S.'},
    {'clave': 'RIC DAV MER CER',    'alias': 'MARIA FERNANDA CAPATAZ SIERRA'},
    {'clave': 'MIS ENR NUN CAM',    'alias': 'PROVISION MAXIMA S.A.S.'},
    {'clave': 'ROB DE JES LAP SAN', 'alias': 'ASOCIACION AFROCOLOMBIANA KUMKUMBAMANA'},
    {'clave': 'CAR CEL ANG GAL',    'alias': 'LEAN/DAVID'},
    {'clave': 'MAR ALE AND FLO',    'alias': 'DEIVID'},
    {'clave': 'JES ALB PLA BAR',    'alias': 'POLLO'},
    {'clave': 'TED JOS GUE SAL',    'alias': 'DEIVID'},
    {'clave': 'MAR BAY ANG',        'alias': 'DEIVID'},
    {'clave': 'BEL LUC RUI GUT',    'alias': 'DEIVID'},
    {'clave': 'JUL CES MOL MON',    'alias': 'NIDIA'},
]

CONFIGS = {
    'proveedores': {
        'default':  DEFAULT_PROVEEDORES,
        'pathname': 'config/proveedores.json',
        'schema':   ['nit', 'nombre'],
    },
    'alias': {
        'default':  DEFAULT_ALIAS,
        'pathname': 'config/alias.json',
        'schema':   ['clave', 'alias'],
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# BLOB HELPERS (reutilizables por otros módulos — se duplican en cada api/*.py
# porque las funciones serverless no pueden importar entre sí)
# ─────────────────────────────────────────────────────────────────────────────

def _blob_base_url():
    """Deriva la URL pública del Blob store desde el RW token.
    Token formato: 'vercel_blob_rw_<STORE_ID>_<random>' → base URL usa store_id en minúsculas.
    """
    token = os.environ.get('BLOB_READ_WRITE_TOKEN', '')
    parts = token.split('_')
    if len(parts) < 5 or parts[0] != 'vercel' or parts[1] != 'blob':
        return None
    store_id = parts[3].lower()
    return f'https://{store_id}.public.blob.vercel-storage.com'


def blob_get_json(pathname, default=None):
    """GET público de un JSON del Blob. Devuelve `default` si falla.
    Usa cache-buster (?t=<epoch_seg>) para evitar el edge cache de Vercel.
    """
    base = _blob_base_url()
    if not base:
        return default
    import time
    url = f'{base}/{pathname}?t={int(time.time())}'
    try:
        req = urllib.request.Request(url, headers={'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception:
        return default


def blob_put_json(pathname, data):
    """PUT del JSON al Blob con cache TTL = 0 (sin edge cache).
    Requiere BLOB_READ_WRITE_TOKEN."""
    token = os.environ.get('BLOB_READ_WRITE_TOKEN')
    if not token:
        raise RuntimeError('BLOB_READ_WRITE_TOKEN no está configurado')
    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        f'https://blob.vercel-storage.com/{pathname}',
        data=body,
        method='PUT',
        headers={
            'Authorization':           f'Bearer {token}',
            'x-add-random-suffix':      '0',
            'x-content-type':           'application/json',
            'x-cache-control-max-age':  '0',
        },
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read().decode('utf-8'))


# ─────────────────────────────────────────────────────────────────────────────
# VALIDACIÓN
# ─────────────────────────────────────────────────────────────────────────────

def validar_lista(data, schema):
    """Devuelve (limpia, error_msg | None). Elimina filas vacías/incompletas."""
    if not isinstance(data, list):
        return None, 'El body debe ser una lista de objetos'
    limpia = []
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            return None, f'Item {i} no es un objeto'
        fila = {}
        for k in schema:
            v = item.get(k, '')
            if not isinstance(v, str):
                v = str(v) if v is not None else ''
            fila[k] = v.strip()
        # Descartar filas completamente vacías (sin valor en ningún campo requerido)
        if all(fila[k] == '' for k in schema):
            continue
        # Rechazar filas con algún campo vacío (usuario debe completar todo)
        if any(fila[k] == '' for k in schema):
            return None, f'Item {i}: hay campos vacíos ({[k for k in schema if fila[k] == ""]})'
        limpia.append(fila)
    return limpia, None


# ─────────────────────────────────────────────────────────────────────────────
# HANDLER HTTP
# ─────────────────────────────────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _json_response(self, code, body):
        payload = json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._cors_headers()
        self.end_headers()
        self.wfile.write(payload)

    def _get_name(self):
        # /api/config?name=proveedores  →  'proveedores'
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        return (qs.get('name') or [''])[0]

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        name = self._get_name()
        cfg = CONFIGS.get(name)
        if not cfg:
            return self._json_response(400, {'error': f'name inválido. Válidos: {list(CONFIGS)}'})

        data = blob_get_json(cfg['pathname'], default=cfg['default'])
        return self._json_response(200, {'name': name, 'data': data})

    def do_POST(self):
        name = self._get_name()
        cfg = CONFIGS.get(name)
        if not cfg:
            return self._json_response(400, {'error': f'name inválido. Válidos: {list(CONFIGS)}'})

        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            payload = json.loads(body)
        except (ValueError, json.JSONDecodeError):
            return self._json_response(400, {'error': 'Body no es JSON válido'})

        data = payload.get('data')
        limpia, err = validar_lista(data, cfg['schema'])
        if err:
            return self._json_response(400, {'error': err})

        try:
            blob_put_json(cfg['pathname'], limpia)
        except Exception as e:
            return self._json_response(500, {'error': f'Error al guardar en Blob: {e}'})

        return self._json_response(200, {'name': name, 'saved': len(limpia)})
