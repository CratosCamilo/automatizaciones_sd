import { useEffect, useRef, useState } from 'react'

/**
 * Modal editor de listas de configuración (proveedores excluidos, alias, etc.).
 *
 * Props:
 *   name        — clave del config en el backend ('proveedores' | 'alias')
 *   title       — título visible del modal
 *   subtitle    — subtítulo/ayuda breve
 *   columns     — [{ key, label, placeholder, width? }]
 *   onClose     — cerrar sin guardar
 *   onSaved?    — callback opcional post-guardado exitoso
 */
export default function ListEditor({ name, title, subtitle, columns, onClose, onSaved }) {
  const [rows,    setRows]    = useState(null) // null = cargando
  const [estado,  setEstado]  = useState('loading') // loading | ready | saving | success | error
  const [error,   setError]   = useState('')
  const [dirty,   setDirty]   = useState(false)
  const [filter,  setFilter]  = useState('')
  const nuevoRef = useRef(null)

  const emptyRow = () => Object.fromEntries(columns.map(c => [c.key, '']))

  // Carga inicial
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/config?name=${encodeURIComponent(name)}`)
        if (!res.ok) throw new Error(`GET falló (${res.status})`)
        const body = await res.json()
        if (cancelled) return
        setRows(Array.isArray(body.data) ? body.data.map(r => ({ ...emptyRow(), ...r })) : [])
        setEstado('ready')
      } catch (e) {
        if (!cancelled) {
          setError(e.message)
          setEstado('error')
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])

  const actualizar = (idx, key, valor) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: valor } : r))
    setDirty(true)
  }

  const eliminar = (idx) => {
    setRows(prev => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const agregar = () => {
    setRows(prev => [...prev, emptyRow()])
    setDirty(true)
    // Enfocar el nuevo item cuando el DOM se pinte
    setTimeout(() => {
      const inputs = nuevoRef.current?.querySelectorAll('input')
      const total = rows?.length || 0
      const first = inputs?.[total * columns.length]
      first?.focus()
      first?.scrollIntoView({ block: 'nearest' })
    }, 40)
  }

  const guardar = async () => {
    setEstado('saving')
    setError('')
    try {
      const res = await fetch(`/api/config?name=${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: rows }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `POST falló (${res.status})`)
      setEstado('success')
      setDirty(false)
      onSaved?.(body)
      // auto-close después de 900ms
      setTimeout(() => onClose?.(), 900)
    } catch (e) {
      setError(e.message)
      setEstado('error')
    }
  }

  const intentarCerrar = () => {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Cerrar de todos modos?')) return
    onClose?.()
  }

  const rowsFiltradas = !rows ? [] : (
    !filter ? rows.map((r, i) => ({ r, i })) :
      rows.map((r, i) => ({ r, i })).filter(({ r }) =>
        columns.some(c => (r[c.key] || '').toLowerCase().includes(filter.toLowerCase()))
      )
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={intentarCerrar}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: '#004D5F',
          border: '1px solid rgba(255,255,255,0.12)',
          maxHeight: '90vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#006070' }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">⚙️</span>
            <div className="min-w-0">
              <h2 className="text-white font-semibold text-[15px] truncate">{title}</h2>
              {subtitle && <p className="text-secondary text-xs mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={intentarCerrar}
            className="text-secondary hover:text-white transition-colors text-xl leading-none pl-4"
            aria-label="Cerrar"
          >×</button>
        </div>

        {/* Contenido */}
        <div className="px-6 py-4 flex flex-col gap-3 overflow-hidden flex-1 min-h-0">

          {/* Barra búsqueda + contador */}
          {estado !== 'loading' && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
                type="text"
                placeholder="Buscar…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                style={{
                  background: 'rgba(0,96,112,0.5)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'white',
                }}
                onFocus={e => e.target.style.borderColor = '#00C4D4'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
              />
              <span className="text-xs text-secondary tabular-nums">
                {rowsFiltradas.length}
                {filter && rowsFiltradas.length !== rows?.length && ` / ${rows.length}`}
              </span>
            </div>
          )}

          {/* Tabla scrollable */}
          <div
            ref={nuevoRef}
            className="overflow-y-auto flex-1 min-h-0 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {estado === 'loading' && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="spinner" />
                <p className="text-secondary text-sm">Cargando lista…</p>
              </div>
            )}

            {estado !== 'loading' && rowsFiltradas.length === 0 && (
              <div className="text-center py-10 text-secondary text-sm">
                {filter ? 'Sin resultados para ese filtro.' : 'Lista vacía. Añade el primero →'}
              </div>
            )}

            {estado !== 'loading' && rowsFiltradas.length > 0 && (
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: '#004D5F' }}>
                  <tr>
                    {columns.map(c => (
                      <th key={c.key}
                          className="text-left px-3 py-2 font-semibold text-white/70 text-[11px] uppercase tracking-wider"
                          style={c.width ? { width: c.width } : {}}>
                        {c.label}
                      </th>
                    ))}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rowsFiltradas.map(({ r, i }) => (
                    <tr key={i}
                        className="border-t transition-colors hover:bg-white/[0.03]"
                        style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      {columns.map(c => (
                        <td key={c.key} className="px-2 py-1">
                          <input
                            type="text"
                            value={r[c.key] || ''}
                            placeholder={c.placeholder || ''}
                            onChange={e => actualizar(i, c.key, e.target.value)}
                            className="w-full rounded px-2 py-1.5 text-white text-sm outline-none transition-colors"
                            style={{
                              background: 'transparent',
                              border: '1px solid transparent',
                            }}
                            onFocus={e => {
                              e.target.style.background = 'rgba(0,196,212,0.08)'
                              e.target.style.borderColor = 'rgba(0,196,212,0.4)'
                            }}
                            onBlur={e => {
                              e.target.style.background = 'transparent'
                              e.target.style.borderColor = 'transparent'
                            }}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => eliminar(i)}
                          className="rounded w-7 h-7 text-white/40 hover:text-red-400 transition-colors flex items-center justify-center"
                          title="Eliminar fila"
                          aria-label="Eliminar"
                        >×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Botón añadir */}
          {estado !== 'loading' && (
            <button
              type="button"
              onClick={agregar}
              className="rounded-lg py-2 text-sm font-medium transition-all flex-shrink-0"
              style={{
                background: 'transparent',
                border: '1px dashed rgba(0,196,212,0.4)',
                color: '#00C4D4',
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(0,196,212,0.08)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              + Añadir fila
            </button>
          )}

          {/* Estado / feedback */}
          {estado === 'error' && (
            <div className="rounded-lg px-3 py-2 text-xs flex-shrink-0"
                 style={{ background: 'rgba(239,83,80,0.12)', border: '1px solid rgba(239,83,80,0.3)', color: '#ffbcb9' }}>
              {error}
            </div>
          )}
          {estado === 'success' && (
            <div className="rounded-lg px-3 py-2 text-xs flex-shrink-0"
                 style={{ background: 'rgba(102,187,106,0.12)', border: '1px solid rgba(102,187,106,0.3)', color: '#c8e6c9' }}>
              ✓ Cambios guardados
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 flex-shrink-0"
             style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)' }}>
          <button
            onClick={intentarCerrar}
            disabled={estado === 'saving'}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.6)',
              cursor: estado === 'saving' ? 'not-allowed' : 'pointer',
            }}
            onMouseOver={e => { if (estado !== 'saving') e.currentTarget.style.color = 'white' }}
            onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={estado === 'loading' || estado === 'saving' || !dirty}
            className="rounded-lg px-5 py-2 text-sm font-semibold transition-all"
            style={{
              background: (estado === 'loading' || estado === 'saving' || !dirty) ? 'rgba(255,255,255,0.1)' : '#00C4D4',
              color:      (estado === 'loading' || estado === 'saving' || !dirty) ? 'rgba(255,255,255,0.35)' : '#003F4F',
              cursor:     (estado === 'loading' || estado === 'saving' || !dirty) ? 'not-allowed' : 'pointer',
              boxShadow:  (estado === 'loading' || estado === 'saving' || !dirty) ? 'none' : '0 4px 16px rgba(0,196,212,0.35)',
            }}
          >
            {estado === 'saving' ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
