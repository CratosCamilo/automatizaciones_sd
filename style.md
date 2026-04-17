# Style Guide — Slendy Automatizaciones

## Concepto visual
Dashboard de automatizaciones empresariales de uso personal. El tono es **profesional pero cálido** — no es un SaaS genérico, es una herramienta hecha a medida. La paleta gira alrededor del cyan profundo como color dominante, con un acento brillante que guía la atención del usuario hacia las acciones importantes.

---

## Paleta de colores

### Fondos
| Nombre | Hex | Uso |
|--------|-----|-----|
| `bg-base` | `#003F4F` | Fondo general de todas las páginas |
| `bg-surface` | `#004D5F` | Paneles, sidebars, áreas secundarias |
| `bg-card` | `#006070` | Tarjetas de módulos, contenedores principales |
| `bg-card-hover` | `#007585` | Estado hover de tarjetas |
| `bg-overlay` | `rgba(0,0,0,0.35)` | Modales, overlays |

### Acentos
| Nombre | Hex | Uso |
|--------|-----|-----|
| `accent-cyan` | `#00C4D4` | CTAs primarios, bordes activos, highlights |
| `accent-cyan-dim` | `#0097A7` | Botones secundarios, estados intermedios |
| `accent-magenta` | `#D81B7C` | Barra superior, badges especiales |
| `accent-magenta-dim` | `#AD1457` | Hover de elementos magenta |

### Texto
| Nombre | Valor | Uso |
|--------|-------|-----|
| `text-primary` | `#FFFFFF` | Títulos, texto principal |
| `text-secondary` | `rgba(255,255,255,0.65)` | Subtítulos, labels, texto de soporte |
| `text-disabled` | `rgba(255,255,255,0.35)` | Placeholders, elementos inactivos |

### Estado
| Nombre | Hex | Uso |
|--------|-----|-----|
| `state-success` | `#66BB6A` | Confirmaciones, uploads exitosos |
| `state-warning` | `#FFA726` | Advertencias, extras en Siigo |
| `state-error` | `#EF5350` | Errores, faltan en Siigo |
| `state-info` | `#29B6F6` | Información neutral |

### Bordes y separadores
```
border-subtle:  rgba(255,255,255,0.08)
border-default: rgba(255,255,255,0.15)
border-active:  #00C4D4
```

---

## Tipografía

**Familia**: `Inter` (Google Fonts) — fallback: `system-ui, -apple-system, sans-serif`

| Nivel | Tamaño | Peso | Uso |
|-------|--------|------|-----|
| Display | 28px | 700 | Nombre de la app, greeting principal |
| H1 | 22px | 600 | Títulos de página/módulo |
| H2 | 17px | 600 | Subtítulos de sección |
| Body | 14px | 400 | Texto corriente |
| Small | 12px | 400 | Labels, metadata, tooltips |
| Mono | 13px | 400 | Rutas, códigos, nombres de archivo |

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 14px;
  color: #FFFFFF;
  background-color: #003F4F;
}
```

---

## Componentes

### Tarjeta de módulo (dashboard)
```
background:    #006070
border-radius: 12px
padding:       20px 24px
border:        1px solid rgba(255,255,255,0.08)
transition:    background 180ms ease, transform 180ms ease

hover:
  background:  #007585
  transform:   translateY(-2px)
  border:      1px solid rgba(0,196,212,0.4)
  box-shadow:  0 8px 24px rgba(0,0,0,0.3)
```

### Botón primario
```
background:    #00C4D4
color:         #003F4F
font-weight:   600
border-radius: 8px
padding:       10px 22px
border:        none

hover:
  background:  #00AABB
  box-shadow:  0 4px 16px rgba(0,196,212,0.35)
```

### Botón secundario / ghost
```
background:    transparent
color:         #00C4D4
border:        1px solid #00C4D4
border-radius: 8px
padding:       10px 22px

hover:
  background:  rgba(0,196,212,0.1)
```

### Zona de upload (drag & drop)
```
background:    rgba(0,96,112,0.5)
border:        2px dashed rgba(255,255,255,0.25)
border-radius: 12px
padding:       40px
text-align:    center

hover / drag-over:
  border:      2px dashed #00C4D4
  background:  rgba(0,196,212,0.08)
```

### Barra superior (header)
```
background:       #D81B7C
height:           48px
padding:          0 24px
display:          flex
align-items:      center
justify-content:  space-between
box-shadow:       0 2px 12px rgba(0,0,0,0.3)
```

### Badge / chip
```
background:    rgba(0,196,212,0.15)
color:         #00C4D4
border:        1px solid rgba(0,196,212,0.3)
border-radius: 20px
padding:       3px 12px
font-size:     12px
font-weight:   500
```

### Spinner de carga
```
border:       3px solid rgba(255,255,255,0.15)
border-top:   3px solid #00C4D4
border-radius: 50%
width:        36px
height:       36px
animation:    spin 0.8s linear infinite
```

---

## Layout

```
max-width dashboard:   900px
max-width módulo:      560px
padding lateral:       24px
gap entre tarjetas:    16px
grid dashboard:        repeat(auto-fill, minmax(240px, 1fr))
```

### Espaciado base (escala de 4px)
```
xs:  4px
sm:  8px
md:  16px
lg:  24px
xl:  40px
2xl: 64px
```

---

## Principios de diseño

1. **Fondo oscuro, acciones claras** — el cyan brillante siempre señala qué hacer a continuación.
2. **Sin ruido** — cada página tiene un solo propósito. Nada decorativo que distraiga.
3. **Feedback inmediato** — cada acción (hover, upload, proceso) tiene respuesta visual.
4. **Escalable** — añadir un módulo nuevo es añadir una tarjeta al grid. El sistema crece sin rediseño.
