import { useState } from 'react'
import Layout from '../../components/Layout'
import UploadZone from '../../components/UploadZone'

function fmtCOP(n) {
  if (n === null || n === undefined) return '—'
  const abs = Math.abs(n)
  const fmt = abs.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return (n < 0 ? '-' : '') + '$ ' + fmt
}

function TotalesRow({ label, value, highlight }) {
  const colorClass =
    highlight === 'error' ? 'text-red-400' :
    highlight === 'ok'    ? 'text-green-400' :
    'text-white'
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-white/60 text-sm">{label}</span>
      <span className={`font-mono text-sm font-semibold ${colorClass}`}>
        {fmtCOP(value)}
      </span>
    </div>
  )
}

export default function CajaSocialNueva() {
  const [banco, setBanco]       = useState(null)
  const [siigo, setSiigo]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [resultado, setResultado] = useState(null)

  const toBase64 = file => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = () => res(r.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })

  const procesar = async () => {
    if (!banco || !siigo) return
    setLoading(true)
    setError(null)
    setResultado(null)
    try {
      const [b64banco, b64siigo] = await Promise.all([toBase64(banco), toBase64(siigo)])
      const res = await fetch('/api/caja_social_nueva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banco: b64banco, siigo: b64siigo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error procesando')
      setResultado(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const descargar = () => {
    if (!resultado?.excel) return
    const bytes = Uint8Array.from(atob(resultado.excel), c => c.charCodeAt(0))
    const blob  = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement('a')
    a.href      = url
    a.download  = 'conciliacion_caja_social_nueva.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const canProcesar = banco && siigo && !loading

  return (
    <Layout title="Caja Social Nueva — Slendy Automatizaciones">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-[22px] font-bold text-white mb-1">
          Caja Social — Página Nueva
        </h1>
        <p className="text-white/50 text-sm mb-8">
          Concilia el extracto XLSX de la nueva página de Caja Social con Siigo.
        </p>

        {/* Uploads */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <UploadZone
            label="Extracto Caja Social"
            accept=".xlsx"
            onFile={setBanco}
            file={banco}
          />
          <UploadZone
            label="Siigo"
            accept=".xlsx"
            onFile={setSiigo}
            file={siigo}
          />
        </div>

        {/* Procesar */}
        <button
          onClick={procesar}
          disabled={!canProcesar}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
          style={{
            background: canProcesar
              ? 'linear-gradient(135deg, #00C4D4, #0096A0)'
              : 'rgba(255,255,255,0.06)',
            color:  canProcesar ? '#fff' : 'rgba(255,255,255,0.3)',
            cursor: canProcesar ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Procesando…' : 'Procesar'}
        </button>

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 rounded-xl text-red-400 text-sm"
               style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)' }}>
            {error}
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div className="mt-6 space-y-4">

            {resultado.conciliado && (
              <div className="p-4 rounded-xl text-center font-semibold text-green-400"
                   style={{ background: 'rgba(0,200,100,0.1)', border: '1px solid rgba(0,200,100,0.3)' }}>
                ¡Conciliado! ✓
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Total Salida */}
              <div className="rounded-xl p-5"
                   style={{ background: 'rgba(0,60,80,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-white/40 text-xs uppercase tracking-widest font-medium mb-3">
                  Total Salida
                </p>
                <TotalesRow label="CS Débito"     value={resultado.salida.banco} />
                <TotalesRow label="Siigo Crédito" value={resultado.salida.siigo} />
                <div className="border-t border-white/10 mt-2 pt-2">
                  <TotalesRow
                    label="Diferencia"
                    value={resultado.salida.diferencia}
                    highlight={resultado.salida.diferencia === 0 ? 'ok' : 'error'}
                  />
                </div>
              </div>

              {/* Total Entrada */}
              <div className="rounded-xl p-5"
                   style={{ background: 'rgba(0,60,80,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-white/40 text-xs uppercase tracking-widest font-medium mb-3">
                  Total Entrada
                </p>
                <TotalesRow label="CS Crédito"  value={resultado.entrada.banco} />
                <TotalesRow label="Siigo Débito" value={resultado.entrada.siigo} />
                <div className="border-t border-white/10 mt-2 pt-2">
                  <TotalesRow
                    label="Diferencia"
                    value={resultado.entrada.diferencia}
                    highlight={resultado.entrada.diferencia === 0 ? 'ok' : 'error'}
                  />
                </div>
              </div>

            </div>

            {/* Descarga */}
            <button
              onClick={descargar}
              className="w-full py-3 rounded-xl font-semibold text-sm"
              style={{
                background: 'rgba(0,196,212,0.15)',
                border: '1px solid rgba(0,196,212,0.3)',
                color: '#00C4D4',
              }}
            >
              Descargar Excel
            </button>

          </div>
        )}
      </div>
    </Layout>
  )
}
