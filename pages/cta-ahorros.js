import { useState } from 'react'
import Link from 'next/link'
import Layout from '../components/Layout'
import UploadZone from '../components/UploadZone'
import DateRangePicker from '../components/DateRangePicker'

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
        <div className="flex items-center justify-between px-6 py-4"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#006070' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🏦</span>
            <h2 className="text-white font-semibold text-[15px]">¿Cómo funciona?</h2>
          </div>
          <button
            onClick={onClose}
            className="text-secondary hover:text-white transition-colors text-xl leading-none"
            aria-label="Cerrar"
          >×</button>
        </div>

        <div className="px-6 py-5 space-y-5 text-sm leading-relaxed">

          <section>
            <h3 className="text-white font-semibold mb-1.5">¿Qué hace?</h3>
            <p className="text-secondary">
              Toma el extracto de la <strong className="text-white">Cuenta de Ahorros Caja Social</strong> y
              el auxiliar de Siigo, y genera un Excel con tres hojas listas para conciliar: los datos
              bancarios limpios, la comparación de débitos por fecha y el cruce de créditos por valor.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1.5">Archivos que necesita</h3>
            <div className="rounded-lg px-3 py-2.5 space-y-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <p className="text-secondary text-xs">
                — <strong className="text-white">Banco Caja Social (.xls)</strong>: extracto descargado
                del portal. El sistema detecta el formato automáticamente.
              </p>
              <p className="text-secondary text-xs">
                — <strong className="text-white">Siigo sin arreglar (.xlsx)</strong>: reporte
                "Movimiento auxiliar por cuenta contable" exportado de Siigo para la cuenta de ahorros.
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1.5">Las tres hojas del resultado</h3>
            <div className="space-y-2">
              <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(0,196,212,0.07)', border: '1px solid rgba(0,196,212,0.15)' }}>
                <p className="text-white text-xs font-semibold">Hoja1 — Datos bancarios</p>
                <p className="text-secondary text-xs mt-0.5">Todos los movimientos del período, limpios y formateados.</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(0,196,212,0.07)', border: '1px solid rgba(0,196,212,0.15)' }}>
                <p className="text-white text-xs font-semibold">DEBITO — Comparación por fecha</p>
                <p className="text-secondary text-xs mt-0.5">Entradas al banco (ABONOs) sumadas por día frente a los débitos de Siigo. Un vistazo rápido para ver si los totales diarios cuadran.</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(0,196,212,0.07)', border: '1px solid rgba(0,196,212,0.15)' }}>
                <p className="text-white text-xs font-semibold">CREDITO — Cruce por valor</p>
                <p className="text-secondary text-xs mt-0.5">Salidas del banco vs. créditos de Siigo, ordenadas de mayor a menor. Las filas en amarillo son asientos CC-10 (notas). Los impuestos automáticos se excluyen del cruce.</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1.5">Limpieza automática</h3>
            <div className="rounded-lg px-3 py-2.5 space-y-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <p className="text-secondary text-xs">
                — Se excluyen del cruce los <strong className="text-white">impuestos automáticos</strong>:
                retenciones en la fuente, RETEICA, GMF, comisiones de adquirencia y descuentos de comisión
                T-DEB. Estos cuadran en los asientos CC-10 de Siigo.
              </p>
              <p className="text-secondary text-xs">
                — El banco trae más días de los pedidos. El filtro de fechas recorta lo necesario.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}

function fmtCOP(n) {
  if (n === null || n === undefined) return '—'
  return Math.abs(n).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function TotalesRow({ label, value, sep, diff, highlight }) {
  const textColor = highlight ? '#EF5350' : diff && Math.abs(value) < 1 ? '#66BB6A' : '#FFFFFF'
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm"
         style={{
           background: sep ? 'rgba(255,255,255,0.04)' : 'transparent',
           borderTop: sep ? '1px solid rgba(255,255,255,0.06)' : 'none',
         }}>
      <span className="text-secondary text-xs">{label}</span>
      <span className="font-semibold tabular-nums" style={{ color: textColor }}>
        {diff && value < 0 ? '-' : ''}{fmtCOP(value)}
      </span>
    </div>
  )
}

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function CtaAhorros() {
  const [bancoFile, setBancoFile]   = useState(null)
  const [siigoFile, setSiigoFile]   = useState(null)
  const [fechaIni, setFechaIni]     = useState('')
  const [fechaFin, setFechaFin]     = useState('')
  const [estado, setEstado]         = useState('idle')
  const [resultado, setResultado]   = useState(null)
  const [errorMsg, setErrorMsg]     = useState('')
  const [modal, setModal]           = useState(false)

  const puedeEnviar = bancoFile && siigoFile && fechaIni && fechaFin && estado !== 'loading'

  const handleProcesar = async () => {
    setEstado('loading')
    setResultado(null)
    setErrorMsg('')

    try {
      const [bancoB64, siigoB64] = await Promise.all([toBase64(bancoFile), toBase64(siigoFile)])

      const res = await fetch('/api/cta_ahorros', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          banco_b64:    bancoB64,
          siigo_b64:    siigoB64,
          fecha_inicio: fechaIni,
          fecha_fin:    fechaFin,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error del servidor (${res.status})`)

      // Descargar el Excel
      const byteChars  = atob(data.archivo_b64)
      const byteArr    = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
      const blob       = new Blob([byteArr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url        = URL.createObjectURL(blob)
      const a          = document.createElement('a')
      a.href           = url
      a.download       = data.nombre || 'CTA_AHORROS.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setResultado(data.resumen)
      setEstado('success')

    } catch (err) {
      setErrorMsg(err.message)
      setEstado('error')
    }
  }

  const handleReiniciar = () => {
    setBancoFile(null)
    setSiigoFile(null)
    setFechaIni('')
    setFechaFin('')
    setEstado('idle')
    setResultado(null)
    setErrorMsg('')
  }

  return (
    <Layout title="Cta Ahorros Caja Social — Slendy Automatizaciones">
      {modal && <ModalComoFunciona onClose={() => setModal(false)} />}
      <div className="min-h-[calc(100vh-48px)] px-6 py-8">
        <div className="max-w-xl mx-auto">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-secondary mb-6">
            <Link href="/" className="hover:text-white transition-colors">Inicio</Link>
            <span>/</span>
            <span className="text-white">Cta Ahorros Caja Social</span>
          </div>

          {/* Card principal */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#004D5F', border: '1px solid rgba(255,255,255,0.08)' }}>

            {/* Header */}
            <div className="px-6 py-5" style={{ background: '#006070', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏦</span>
                  <div>
                    <h1 className="text-white font-semibold text-[17px] leading-tight">
                      Cta Ahorros Caja Social
                    </h1>
                    <p className="text-secondary text-xs mt-0.5">
                      Cruza el banco con Siigo y arma las hojas de conciliación
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
                    Sube el <strong className="text-white">.xls</strong> del banco Caja Social y el{' '}
                    <strong className="text-white">.xlsx</strong> de Siigo sin arreglar, y elige el mes a conciliar.
                  </div>

                  {/* Zonas de upload */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <UploadZone
                      accept=".xls,.xlsx"
                      label="Banco Caja Social"
                      sublabel=".xls descargado del portal"
                      icon="🏦"
                      file={bancoFile}
                      onFile={setBancoFile}
                    />
                    <UploadZone
                      accept=".xlsx"
                      label="Siigo sin arreglar"
                      sublabel=".xlsx — mov. auxiliar por cuenta"
                      icon="📊"
                      file={siigoFile}
                      onFile={setSiigoFile}
                    />
                  </div>

                  {/* Rango de fechas */}
                  <DateRangePicker
                    fechaIni={fechaIni}
                    setFechaIni={setFechaIni}
                    fechaFin={fechaFin}
                    setFechaFin={setFechaFin}
                    grupo="mensual"
                  />

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
                    {estado === 'loading' ? 'Procesando…' : 'Conciliar y descargar'}
                  </button>
                </>
              )}

              {/* Spinner */}
              {estado === 'loading' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="spinner" />
                  <p className="text-secondary text-sm">Cruzando banco con Siigo…</p>
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

              {/* Resultado */}
              {estado === 'success' && resultado && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">✅</span>
                    <p className="text-white font-semibold">¡Listo! El archivo se descargó automáticamente.</p>
                  </div>

                  {/* Felicitación si concilió */}
                  {resultado.conciliado && (
                    <div className="rounded-xl px-4 py-3 text-sm text-center"
                         style={{ background: 'rgba(102,187,106,0.15)', border: '1px solid rgba(102,187,106,0.4)' }}>
                      <p className="text-[#66BB6A] font-semibold">¡Conciliación perfecta! Ambas diferencias son cero. 🎉</p>
                    </div>
                  )}

                  {/* Bloque DÉBITO */}
                  <div>
                    <p className="text-secondary text-[11px] uppercase tracking-widest font-medium mb-2">Débito</p>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                      <TotalesRow label="Total banco"  value={resultado.total_deb_banco}  />
                      <TotalesRow label="Total Siigo"  value={resultado.total_deb_siigo}  sep />
                      <TotalesRow label="Diferencia"   value={resultado.diff_deb}
                                  diff highlight={Math.abs(resultado.diff_deb) > 1} />
                    </div>
                  </div>

                  {/* Bloque CRÉDITO */}
                  <div>
                    <p className="text-secondary text-[11px] uppercase tracking-widest font-medium mb-2">Crédito</p>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                      <TotalesRow label="Total banco"  value={resultado.total_cred_banco}  />
                      <TotalesRow label="Total Siigo"  value={resultado.total_cred_siigo}  sep />
                      <TotalesRow label="Diferencia"   value={resultado.diff_cred}
                                  diff highlight={Math.abs(resultado.diff_cred) > 1} />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={handleReiniciar}
                            className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-all"
                            style={{ background: 'transparent', border: '1px solid #00C4D4', color: '#00C4D4' }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(0,196,212,0.1)'}
                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      Nuevo mes
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

        </div>
      </div>
    </Layout>
  )
}
