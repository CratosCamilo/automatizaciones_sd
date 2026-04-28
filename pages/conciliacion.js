import { useState } from 'react'
import Link from 'next/link'
import Layout from '../components/Layout'
import UploadZone from '../components/UploadZone'

function ModalComoFunciona({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-y-auto max-h-[90vh]"
        style={{ background: '#004D5F', border: '1px solid rgba(255,255,255,0.12)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header modal */}
        <div className="flex items-center justify-between px-6 py-4"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#006070' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🧾</span>
            <h2 className="text-white font-semibold text-[15px]">¿Cómo funciona la conciliación?</h2>
          </div>
          <button
            onClick={onClose}
            className="text-secondary hover:text-white transition-colors text-xl leading-none"
            aria-label="Cerrar"
          >×</button>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-5 space-y-5 text-sm leading-relaxed">

          {/* Qué es */}
          <section>
            <h3 className="text-white font-semibold mb-1.5">¿Qué es?</h3>
            <p className="text-secondary">
              Es una herramienta de conciliación mensual. Compara las facturas de compra que registra
              la <strong className="text-white">DIAN</strong> (fuente oficial) contra las que están
              cargadas en <strong className="text-white">Siigo</strong>, para detectar diferencias antes
              de cerrar la contabilidad.
            </p>
          </section>

          {/* Limpieza previa */}
          <section>
            <h3 className="text-white font-semibold mb-1.5">Limpieza antes del cruce</h3>
            <p className="text-secondary mb-2">
              Antes de comparar, cada reporte se depura por separado:
            </p>
            <div className="space-y-3">
              <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p className="text-white text-xs font-medium mb-1">Reporte DIAN (.zip)</p>
                <ul className="text-secondary space-y-1 text-xs">
                  <li>— Se elimina el encabezado del ZIP y se trabaja solo con el Excel interno.</li>
                  <li>— Se descartan columnas administrativas (Divisa, Forma de Pago, Medio de Pago, Fecha Recepción, datos del receptor).</li>
                  <li>— De los impuestos intermedios (ICA, INC, Rete IVA, etc.) solo se mantienen los que tienen algún valor distinto de cero.</li>
                  <li>— Se eliminan filas con <strong className="text-white">Total = 0</strong>.</li>
                </ul>
              </div>
              <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p className="text-white text-xs font-medium mb-1">Reporte Siigo (.xlsx)</p>
                <ul className="text-secondary space-y-1 text-xs">
                  <li>— Se ignoran las filas de encabezado del reporte (metadatos de Siigo) y se detecta automáticamente dónde empiezan los datos.</li>
                  <li>— Se descartan columnas internas (Sucursal, Base gravada, Base exenta).</li>
                  <li>— Se eliminan filas de totales y pies de página (las que no tienen nombre de tercero).</li>
                  <li>— Se excluyen comprobantes <strong className="text-white">DS-xxx</strong> porque son devoluciones, no facturas de compra.</li>
                  <li>— Se eliminan filas con <strong className="text-white">Total = 0</strong>.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Lógica del cruce */}
          <section>
            <h3 className="text-white font-semibold mb-1.5">¿Cómo identifica si una factura es la misma?</h3>
            <p className="text-secondary">
              Usa el <strong className="text-white">Prefijo + Folio</strong> como clave única. Por ejemplo,
              prefijo <code className="text-cyan-300">FEIP</code> + folio <code className="text-cyan-300">88017</code>{' '}
              debe coincidir con la factura proveedor <code className="text-cyan-300">FEIP-88017</code> en Siigo.
            </p>
            <p className="text-secondary mt-2">
              La fecha y el monto <em>no se usan</em> para el cruce porque pueden diferir por notas crédito
              o ajustes. Si una factura aparece como "Solo en Siigo", lo más probable es que el prefijo o
              folio esté mal digitado.
            </p>
          </section>

          {/* Resultado */}
          <section>
            <h3 className="text-white font-semibold mb-1.5">Resultado: tres grupos en el Excel</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#C9A8A6' }} />
                <span className="text-secondary">
                  <strong className="text-white">Falta en Siigo:</strong> la DIAN la tiene pero Siigo no.
                  Hay que registrarla. Ordenadas de mayor a menor valor.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#D4B89A' }} />
                <span className="text-secondary">
                  <strong className="text-white">Solo en Siigo:</strong> Siigo la tiene pero la DIAN no.
                  Posible error de prefijo o folio. Ordenadas de mayor a menor valor.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#AABF96' }} />
                <span className="text-secondary">
                  <strong className="text-white">Matcheadas:</strong> están en ambos sistemas. El Excel
                  incluye una columna de diferencia de IVA entre las dos fuentes. Ordenadas de mayor a menor valor.
                </span>
              </li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  )
}

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function Conciliacion() {
  const [dianFile, setDianFile]     = useState(null)
  const [siigoFile, setSiigoFile]   = useState(null)
  const [estado, setEstado]         = useState('idle') // idle | loading | success | error
  const [resultado, setResultado]   = useState(null)
  const [errorMsg, setErrorMsg]     = useState('')
  const [modalAbierto, setModal]    = useState(false)

  const puedeEnviar = dianFile && siigoFile && estado !== 'loading'

  const handleProcesar = async () => {
    setEstado('loading')
    setResultado(null)
    setErrorMsg('')

    try {
      const [dianB64, siigoB64] = await Promise.all([
        toBase64(dianFile),
        toBase64(siigoFile),
      ])

      const res = await fetch('/api/conciliacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dian: dianB64, siigo: siigoB64 }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Error del servidor (${res.status})`)
      }

      // Leer resumen desde headers antes de consumir el body
      const nFalta = parseInt(res.headers.get('X-Falta') || '0', 10)
      const nExtra = parseInt(res.headers.get('X-Extra') || '0', 10)
      const nOk    = parseInt(res.headers.get('X-Ok')    || '0', 10)

      // Descargar el Excel
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'CONCILIACION_FACTURAS.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setResultado({ falta: nFalta, extra: nExtra, ok: nOk })
      setEstado('success')

    } catch (err) {
      setErrorMsg(err.message)
      setEstado('error')
    }
  }

  const handleReiniciar = () => {
    setDianFile(null)
    setSiigoFile(null)
    setEstado('idle')
    setResultado(null)
    setErrorMsg('')
  }

  return (
    <Layout title="Conciliación DIAN vs Siigo">
      {modalAbierto && <ModalComoFunciona onClose={() => setModal(false)} />}
      <div className="min-h-[calc(100vh-48px)] px-6 py-8">
        <div className="max-w-xl mx-auto">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-secondary mb-6">
            <Link href="/" className="hover:text-white transition-colors">Inicio</Link>
            <span>/</span>
            <span className="text-white">Conciliación DIAN vs Siigo</span>
          </div>

          {/* Card principal */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#004D5F', border: '1px solid rgba(255,255,255,0.08)' }}>

            {/* Header de la card */}
            <div className="px-6 py-5" style={{ background: '#006070', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🧾</span>
                  <div>
                    <h1 className="text-white font-semibold text-[17px] leading-tight">
                      Conciliación DIAN vs Siigo
                    </h1>
                    <p className="text-secondary text-xs mt-0.5">
                      Subí los dos archivos y descargá el Excel comparativo
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModal(true)}
                  className="flex-shrink-0 text-xs transition-colors"
                  style={{ color: 'rgba(0,196,212,0.8)' }}
                  onMouseOver={e => e.currentTarget.style.color = '#00C4D4'}
                  onMouseOut={e => e.currentTarget.style.color = 'rgba(0,196,212,0.8)'}
                >
                  ¿Cómo funciona?
                </button>
              </div>
            </div>

            {/* Contenido */}
            <div className="px-6 py-6 space-y-6">

              {estado !== 'success' && (
                <>
                  {/* Instrucción */}
                  <div className="rounded-lg px-4 py-3 text-xs text-secondary leading-relaxed"
                       style={{ background: 'rgba(0,196,212,0.07)', border: '1px solid rgba(0,196,212,0.15)' }}>
                    Subí el <strong className="text-white">.zip</strong> que descargás de la DIAN y el
                    {' '}<strong className="text-white">.xlsx</strong> que exportás de Siigo. El orden no importa.
                    El sistema los cruza por Prefijo+Folio y te devuelve el Excel listo.
                  </div>

                  {/* Zonas de upload */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <UploadZone
                      accept=".zip"
                      label="Archivo DIAN"
                      sublabel=".zip descargado del portal DIAN"
                      logo="/logos/Dian.png"
                      file={dianFile}
                      onFile={setDianFile}
                    />
                    <UploadZone
                      accept=".xlsx"
                      label="Reporte Siigo"
                      sublabel=".xlsx exportado de Siigo"
                      logo="/logos/Siigo.png"
                      file={siigoFile}
                      onFile={setSiigoFile}
                    />
                  </div>

                  {/* Botón procesar */}
                  <button
                    onClick={handleProcesar}
                    disabled={!puedeEnviar}
                    className="w-full rounded-xl py-3 font-semibold text-[15px] transition-all duration-200"
                    style={{
                      background: puedeEnviar ? '#00C4D4' : 'rgba(255,255,255,0.1)',
                      color:      puedeEnviar ? '#003F4F' : 'rgba(255,255,255,0.35)',
                      cursor:     puedeEnviar ? 'pointer' : 'not-allowed',
                      boxShadow:  puedeEnviar ? '0 4px 16px rgba(0,196,212,0.35)' : 'none',
                    }}
                  >
                    {estado === 'loading' ? 'Procesando…' : 'Procesar y descargar'}
                  </button>
                </>
              )}

              {/* Spinner */}
              {estado === 'loading' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="spinner" />
                  <p className="text-secondary text-sm">Procesando facturas…</p>
                </div>
              )}

              {/* Error */}
              {estado === 'error' && (
                <div className="rounded-xl px-4 py-4 text-sm"
                     style={{ background: 'rgba(239,83,80,0.12)', border: '1px solid rgba(239,83,80,0.3)' }}>
                  <p className="text-white font-medium mb-1">Ocurrió un error</p>
                  <p className="text-secondary text-xs">{errorMsg}</p>
                  <button onClick={handleReiniciar}
                          className="mt-3 text-xs text-cyan-bright hover:underline">
                    Intentar de nuevo
                  </button>
                </div>
              )}

              {/* Resultado exitoso */}
              {estado === 'success' && resultado && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">✅</span>
                    <p className="text-white font-semibold">¡Listo! El archivo se descargó automáticamente.</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="result-pill flex-col items-start"
                         style={{ background: 'rgba(242,220,219,0.15)', border: '1px solid rgba(242,220,219,0.3)' }}>
                      <span className="text-lg">🔴</span>
                      <span className="text-white font-bold text-xl leading-none">{resultado.falta}</span>
                      <span className="text-white/60 text-[11px] leading-tight">Faltan en Siigo</span>
                    </div>
                    <div className="result-pill flex-col items-start"
                         style={{ background: 'rgba(253,233,217,0.15)', border: '1px solid rgba(253,233,217,0.3)' }}>
                      <span className="text-lg">🟠</span>
                      <span className="text-white font-bold text-xl leading-none">{resultado.extra}</span>
                      <span className="text-white/60 text-[11px] leading-tight">Solo en Siigo</span>
                    </div>
                    <div className="result-pill flex-col items-start"
                         style={{ background: 'rgba(235,241,222,0.15)', border: '1px solid rgba(235,241,222,0.3)' }}>
                      <span className="text-lg">🟢</span>
                      <span className="text-white font-bold text-xl leading-none">{resultado.ok}</span>
                      <span className="text-white/60 text-[11px] leading-tight">Matcheadas</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={handleReiniciar}
                            className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-all"
                            style={{ background: 'transparent', border: '1px solid #00C4D4', color: '#00C4D4' }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(0,196,212,0.1)'}
                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      Nueva conciliación
                    </button>
                    <Link href="/"
                          className="flex-1 rounded-xl py-2.5 text-sm font-medium text-center transition-all"
                          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
                      Volver al inicio
                    </Link>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Leyenda de colores */}
          {estado !== 'success' && (
            <div className="mt-4 rounded-xl px-4 py-3 flex flex-wrap gap-x-5 gap-y-2"
                 style={{ background: 'rgba(0,0,0,0.2)' }}>
              <span className="text-xs text-secondary flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: '#C9A8A6' }} />
                Falta en Siigo
              </span>
              <span className="text-xs text-secondary flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: '#D4B89A' }} />
                Solo en Siigo
              </span>
              <span className="text-xs text-secondary flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: '#AABF96' }} />
                Matcheadas
              </span>
            </div>
          )}

        </div>
      </div>
    </Layout>
  )
}
