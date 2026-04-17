import { useState } from 'react'
import Link from 'next/link'
import Layout from '../components/Layout'
import UploadZone from '../components/UploadZone'

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function Conciliacion() {
  const [dianFile, setDianFile]   = useState(null)
  const [siigoFile, setSiigoFile] = useState(null)
  const [estado, setEstado]       = useState('idle') // idle | loading | success | error
  const [resultado, setResultado] = useState(null)
  const [errorMsg, setErrorMsg]   = useState('')

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
            </div>

            {/* Contenido */}
            <div className="px-6 py-6 space-y-6">

              {estado !== 'success' && (
                <>
                  {/* Instrucción */}
                  <div className="rounded-lg px-4 py-3 text-xs text-secondary leading-relaxed"
                       style={{ background: 'rgba(0,196,212,0.07)', border: '1px solid rgba(0,196,212,0.15)' }}>
                    <span className="text-cyan-bright font-medium">¿Cómo funciona? </span>
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
                      icon="🗜️"
                      file={dianFile}
                      onFile={setDianFile}
                    />
                    <UploadZone
                      accept=".xlsx"
                      label="Reporte Siigo"
                      sublabel=".xlsx exportado de Siigo"
                      icon="📊"
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
