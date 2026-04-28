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
            <span className="text-lg">💳</span>
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
              Toma el reporte de <strong className="text-white">Davivienda</strong> (que no
              trae fechas filtradas ni nombres de quienes consignan) y el CSV de{' '}
              <strong className="text-white">Redeban QR</strong>, los filtra al rango de fechas
              y cruza los nombres por fecha+valor. Devuelve el Excel listo para conciliar.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1.5">¿Por qué los dos archivos?</h3>
            <p className="text-secondary">
              Davivienda reporta los pagos QR como <em>"Pago A Llave De Comercio"</em> sin
              nombre. Redeban QR sí trae los emisores. El sistema cruza cada "Pago A Llave"
              con su entrada en Redeban usando la fecha y el valor como clave, y reemplaza
              la descripción con el nombre del emisor (formato enmascarado, ej. <code className="text-cyan-300">JUL*** ALE***</code>).
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1.5">Limpieza automática</h3>
            <div className="rounded-lg px-3 py-2.5 space-y-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <p className="text-secondary text-xs">
                — Se eliminan columnas que no aportan: <strong className="text-white">Documento, Oficina de Recaudo, ID Origen/Destino, Valor Cheque, Referencia 1 y 2</strong>.
              </p>
              <p className="text-secondary text-xs">
                — Davivienda descarga días de más (antes y después del rango). El filtro de fecha recorta lo necesario.
              </p>
              <p className="text-secondary text-xs">
                — Del CSV de Redeban solo se conservan las transacciones con estado <strong className="text-white">ACEPTADA</strong> (las rechazadas se descartan).
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1.5">Formato del resultado</h3>
            <p className="text-secondary">
              Una hoja <strong className="text-white">Movimientos1</strong> ordenada por fecha
              ascendente y, dentro de cada día, por valor ascendente. Las{' '}
              <strong className="text-white">Notas Débito</strong> (salidas) se pintan en rojo;
              las <strong className="text-white">Notas Crédito</strong> (entradas) quedan en negro.
              Fuente Trebuchet MS tamaño 12, encabezado gris con negrilla.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1.5">Si algo no cuadra</h3>
            <p className="text-secondary">
              Al final se muestra cuántas filas de "Pago A Llave" quedaron{' '}
              <strong className="text-white">sin match</strong> con Redeban y cuántas filas de
              Redeban sobraron sin aparecer en Davivienda. En un cierre correcto ambos son 0.
            </p>
          </section>

        </div>
      </div>
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

export default function Davivienda() {
  const [davFile, setDavFile]     = useState(null)
  const [redebanFile, setRbFile]  = useState(null)
  const [fechaIni, setFechaIni]   = useState('')
  const [fechaFin, setFechaFin]   = useState('')
  const [estado, setEstado]       = useState('idle')
  const [resultado, setResultado] = useState(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const [modal, setModal]         = useState(false)

  const puedeEnviar = davFile && redebanFile && fechaIni && fechaFin && estado !== 'loading'

  const handleProcesar = async () => {
    setEstado('loading')
    setResultado(null)
    setErrorMsg('')

    try {
      const [davB64, rbB64] = await Promise.all([toBase64(davFile), toBase64(redebanFile)])

      const res = await fetch('/api/davivienda', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          davivienda:   davB64,
          redeban:      rbB64,
          fecha_inicio: fechaIni,
          fecha_fin:    fechaFin,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Error del servidor (${res.status})`)
      }

      const total     = parseInt(res.headers.get('X-Total-Rows') || '0', 10)
      const matched   = parseInt(res.headers.get('X-Matched')    || '0', 10)
      const unmatched = parseInt(res.headers.get('X-Unmatched')  || '0', 10)
      const extras    = parseInt(res.headers.get('X-Extras')     || '0', 10)

      const blob     = await res.blob()
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      const filename = res.headers.get('Content-Disposition')
        ?.match(/filename="(.+?)"/)?.[1] || 'DAVIVIENDA_CONCILIADO.xlsx'
      a.href     = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setResultado({ total, matched, unmatched, extras })
      setEstado('success')

    } catch (err) {
      setErrorMsg(err.message)
      setEstado('error')
    }
  }

  const handleReiniciar = () => {
    setDavFile(null)
    setRbFile(null)
    setFechaIni('')
    setFechaFin('')
    setEstado('idle')
    setResultado(null)
    setErrorMsg('')
  }

  return (
    <Layout title="Davivienda + Redeban — Slendy Automatizaciones">
      {modal && <ModalComoFunciona onClose={() => setModal(false)} />}
      <div className="min-h-[calc(100vh-48px)] px-6 py-8">
        <div className="max-w-xl mx-auto">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-secondary mb-6">
            <Link href="/" className="hover:text-white transition-colors">Inicio</Link>
            <span>/</span>
            <span className="text-white">Davivienda + Redeban</span>
          </div>

          {/* Card principal */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#004D5F', border: '1px solid rgba(255,255,255,0.08)' }}>

            {/* Header */}
            <div className="px-6 py-5" style={{ background: '#006070', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💳</span>
                  <div>
                    <h1 className="text-white font-semibold text-[17px] leading-tight">
                      Davivienda + Redeban
                    </h1>
                    <p className="text-secondary text-xs mt-0.5">
                      Cruza los QR con Redeban y arma el reporte quincenal
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
                    Sube el <strong className="text-white">.xlsx</strong> de Davivienda y el
                    {' '}<strong className="text-white">.csv</strong> de Redeban QR, y elige el
                    rango de fechas (normalmente 1–15 o 16–último del mes).
                  </div>

                  {/* Zonas de upload */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <UploadZone
                      accept=".xlsx"
                      label="Davivienda"
                      sublabel=".xlsx descargado del banco"
                      logo="/logos/Davivienda.png"
                      file={davFile}
                      onFile={setDavFile}
                    />
                    <UploadZone
                      accept=".csv"
                      label="Redeban QR"
                      sublabel=".csv de consulta de transacciones"
                      logo="/logos/Redeban.webp"
                      file={redebanFile}
                      onFile={setRbFile}
                    />
                  </div>

                  {/* Rango de fechas */}
                  <DateRangePicker
                    fechaIni={fechaIni}
                    setFechaIni={setFechaIni}
                    fechaFin={fechaFin}
                    setFechaFin={setFechaFin}
                    grupo="quincenal"
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
                  <p className="text-secondary text-sm">Cruzando Davivienda con Redeban…</p>
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="result-pill flex-col items-start"
                         style={{ background: 'rgba(0,196,212,0.1)', border: '1px solid rgba(0,196,212,0.25)' }}>
                      <span className="text-lg">💳</span>
                      <span className="text-white font-bold text-xl leading-none">{resultado.total}</span>
                      <span className="text-white/60 text-[11px] leading-tight">Movimientos totales</span>
                    </div>
                    <div className="result-pill flex-col items-start"
                         style={{ background: 'rgba(102,187,106,0.12)', border: '1px solid rgba(102,187,106,0.3)' }}>
                      <span className="text-lg">🔗</span>
                      <span className="text-white font-bold text-xl leading-none">{resultado.matched}</span>
                      <span className="text-white/60 text-[11px] leading-tight">Nombres cruzados</span>
                    </div>
                  </div>

                  {(resultado.unmatched > 0 || resultado.extras > 0) && (
                    <div className="rounded-xl px-4 py-3 text-xs"
                         style={{ background: 'rgba(255,167,38,0.1)', border: '1px solid rgba(255,167,38,0.3)' }}>
                      <p className="text-white font-medium mb-1">⚠️ Hay diferencias</p>
                      {resultado.unmatched > 0 && (
                        <p className="text-secondary">
                          <strong className="text-white">{resultado.unmatched}</strong> "Pago A Llave" en Davivienda sin match en Redeban.
                        </p>
                      )}
                      {resultado.extras > 0 && (
                        <p className="text-secondary">
                          <strong className="text-white">{resultado.extras}</strong> transacciones de Redeban no aparecen en Davivienda.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button onClick={handleReiniciar}
                            className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-all"
                            style={{ background: 'transparent', border: '1px solid #00C4D4', color: '#00C4D4' }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(0,196,212,0.1)'}
                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      Nueva quincena
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
