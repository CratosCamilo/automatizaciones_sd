# CLAUDE.md — Slendy Automatizaciones

## ¿Qué es este proyecto?
Portal web personal de automatizaciones para **SLENDY JOHANA DIAZ FIGUEROA** (NIT 1095957126), propietaria de un negocio de alimentos. La app centraliza herramientas que automatizan tareas contables y administrativas repetitivas.

No es un SaaS. No hay usuarios ni autenticación. Es una herramienta de uso exclusivo de Slendy, desplegada en Vercel.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js (React) + Tailwind CSS |
| Backend | Python serverless functions (`/api/*.py`) |
| Deploy | Vercel — un solo repositorio, un solo deploy |
| Estilo | `style.md` en la raíz del proyecto |

---

## Estructura del proyecto

```
slendy-automatizaciones/
├── pages/
│   ├── index.js              # Dashboard principal ("Hola Slendy")
│   └── [modulo]/
│       └── index.js          # Página de cada módulo
├── api/
│   └── [modulo].py           # Función Python serverless por módulo
├── components/
│   ├── Layout.js             # Header + estructura de página
│   ├── ModuleCard.js         # Tarjeta del dashboard
│   └── UploadZone.js         # Componente reutilizable de upload
├── styles/
│   └── globals.css           # Tailwind + variables CSS del style guide
├── public/
│   └── logos/                # Logos de empresas (DIAN, Siigo, bancos) — servidos estáticamente
├── requirements.txt          # Dependencias Python (todas las funciones)
├── package.json
├── vercel.json               # Config de runtimes Python
├── CLAUDE.md                 # Este archivo
├── style.md                  # Guía de estilo visual
└── modulos.md                # Documentación de cada módulo
```

---

## Convenciones

### Añadir un módulo nuevo
1. Crear la página: `pages/[nombre-modulo]/index.js`
2. Crear la función backend: `api/[nombre-modulo].py`
3. Añadir la tarjeta en `pages/index.js` (array `MODULOS`) con el campo `logos` (array de `{ src, alt }` apuntando a `/logos/`)
4. Copiar los logos de empresas a `public/logos/` si aún no están
5. Documentar en `modulos.md`

### Funciones Python serverless
- Cada función es autónoma: incluye toda su lógica, no importa de otras funciones.
- Usan `BaseHTTPRequestHandler` de Python estándar (patrón Vercel).
- Reciben archivos en base64 dentro de un JSON POST (no multipart).
- Devuelven el resultado como descarga binaria con headers apropiados.
- Dependencias en `requirements.txt` en la raíz.

### Frontend
- Los componentes de UI reutilizables van en `/components/`.
- Los colores y tokens visuales están definidos en `style.md` e implementados como variables CSS en `globals.css`.
- Cada página de módulo sigue el mismo patrón: zona de upload → botón procesar → spinner → resultado/descarga.
- El texto de la UI usa tuteo (no voseo): "sube", "elige", "descarga".
- Inputs de fecha usan la clase `.date-input` definida en `globals.css` (fondo oscuro, `color-scheme: dark`).
- `ModuleCard` recibe `logos` (array `{ src, alt }`); en hover los chips se separan con animación `⟷`.
- `UploadZone` recibe `logo` (string o array de strings a `/logos/`) en lugar de `icon` emoji.
- Labels de UploadZone: solo el nombre de la entidad (sin "Archivo", "Reporte", "Extracto").
- Sublabels de UploadZone: `.ext — breve descripción de origen` (siempre con guion largo).

---

## Variables de entorno
Actualmente no se usan variables de entorno. Si en el futuro se añade integración con APIs externas, documentarlas aquí.

---

## Deployment

```bash
# Desarrollo local
npm run dev          # Frontend en localhost:3000
# Las funciones Python se ejecutan localmente con: vercel dev

# Deploy
git push origin main  # Vercel detecta el push y despliega automáticamente
```

**Vercel requiere:**
- Repositorio en GitHub conectado al proyecto Vercel
- `vercel.json` con el runtime Python configurado
- `requirements.txt` en la raíz

---

## Módulos activos

| # | Nombre | Ruta | Backend |
|---|--------|------|---------|
| 1 | Conciliación DIAN vs Siigo | `/conciliacion` | `api/conciliacion.py` |
| 2 | Bancos Semanal | `/movimientos` | `api/movimientos.py` |
| 3 | Davivienda Quincenal | `/davivienda` | `api/davivienda.py` |
| 4 | Cta Ahorros Caja Social | `/cta-ahorros` | `api/cta_ahorros.py` |
| 5 | Caja Social Mensual | `/caja-social-nueva` | `api/caja_social_nueva.py` |

---

## Contexto del negocio
- **Empresa**: negocio de alimentos (panadería/distribución)
- **Contabilidad**: usa Siigo como software contable
- **DIAN**: las facturas electrónicas las consulta en el portal de la DIAN
- **Banco**: hace conciliación bancaria mensual comparando DIAN vs Siigo; también genera reporte semanal de movimientos (Caja Social + Bancolombia)
- **Proveedor de facturas**: recibe facturas electrónicas de múltiples proveedores con prefijos y folios únicos
