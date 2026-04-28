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
              Toma los movimientos de <strong className="text-white">Banco Caja Social</strong> y{' '}
              <strong className="text-white">Bancolombia</strong>, los filtra al rango de fechas
              que elijas y genera un Excel organizado por día — de menor a mayor monto —
              con el total de cada día.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1.5">¿Por qué se piden las fechas?</h3>
            <p className="text-secondary">
              Caja Social no permite descargar por rango exacto: el archivo trae días de más
              (antes y después de la semana). Las fechas que ingreses le dicen al sistema
              cuáles filas conservar en ambos bancos.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1.5">¿Cómo se identifican los archivos?</h3>
            <p className="text-secondary">
              El sistema detecta automáticamente cuál Excel es de cada banco por su estructura
              interna. No importa el nombre del archivo ni el orden en que los subas.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1.5">Filas que se eliminan automáticamente</h3>
            <div className="rounded-lg px-3 py-2.5 space-y-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <p className="text-secondary text-xs">
                — <strong className="text-white">IMPTO GOBIERNO 4X1000</strong>: impuesto automático del banco, no es un movimiento de negocio.
              </p>
              <p className="text-secondary text-xs">
                — <strong className="text-white">ABONO INTERESES AHORROS</strong>: rendimientos de la cuenta, no ingresan como ventas.
              </p>
              <p className="text-secondary text-xs">
                — Filas de Caja Social que caen fuera del rango de fechas elegido.
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1.5">Resultado</h3>
            <p className="text-secondary">
              Un Excel de <strong className="text-white">dos hojas</strong>: la primera con Caja Social
              y la segunda con Bancolombia. Cada hoja organiza los movimientos por día —
              ordenados de menor a mayor — con una fila de total al final de cada día.
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

export default function Movimientos() {
  const [archivo1, setArchivo1]   = useState(null)
  const [archivo2, setArchivo2]   = useState(null)
  const [fechaIni, setFechaIni]   = useState('')
  const [fechaFin, setFechaFin]   = useState('')
  const [estado, setEstado]       = useState('idle')
  const [resultado, setResultado] = useState(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const [modal, setModal]         = useState(false)

  const puedeEnviar = archivo1 && archivo2 && fechaIni && fechaFin && estado !== 'loading'

  const handleProcesar = async () => {
    setEstado('loading')
    setResultado(null)
    setErrorMsg('')

    try {
      const [b64_1, b64_2] = await Promise.all([toBase64(archivo1), toBase64(archivo2)])

      const res = await fetch('/api/movimientos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          archivo1:     b64_1,
          archivo2:     b64_2,
          fecha_inicio: fechaIni,
          fecha_fin:    fechaFin,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Error del servidor (${res.status})`)
      }

      const csRows = parseInt(res.headers.get('X-CS-Rows') || '0', 10)
      const bcRows = parseInt(res.headers.get('X-BC-Rows') || '0', 10)

      const blob     = await res.blob()
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      const filename = res.headers.get('Content-Disposition')
        ?.match(/filename="(.+?)"/)?.[1] || 'MOVIMIENTOS_BANCARIOS.xlsx'
      a.href     = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setResultado({ cs: csRows, bc: bcRows })
      setEstado('success')

    } catch (err) {
      setErrorMsg(err.message)
      setEstado('error')
    }
  }

  const handleReiniciar = () => {
    setArchivo1(null)
    setArchivo2(null)
    setFechaIni('')
    setFechaFin('')
    setEstado('idle')
    setResultado(null)
    setErrorMsg('')
  }

  return (
    <Layout title="Movimientos Bancarios — Slendy Automatizaciones">
      {modal && <ModalComoFunciona onClose={() => setModal(false)} />}
      <div className="min-h-[calc(100vh-48px)] px-6 py-8">
        <div className="max-w-xl mx-auto">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-secondary mb-6">
            <Link href="/" className="hover:text-white transition-colors">Inicio</Link>
            <span>/</span>
            <span className="text-white">Movimientos Bancarios</span>
          </div>

          {/* Card principal */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#004D5F', border: '1px solid rgba(255,255,255,0.08)' }}>

            {/* Header de la card */}
            <div className="px-6 py-5" style={{ background: '#006070', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏦</span>
                  <div>
                    <h1 className="text-white font-semibold text-[17px] leading-tight">
                      Movimientos Bancarios
                    </h1>
                    <p className="text-secondary text-xs mt-0.5">
                      Caja Social + Bancolombia organizados por día
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
                    Sube los dos <strong className="text-white">.xlsx</strong> (uno de Caja Social
                    y uno de Bancolombia) y elige el rango de fechas de la semana.
                    El sistema detecta automáticamente cuál es cuál.
                  </div>

                  {/* Zonas de upload */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <UploadZone
                      accept=".xlsx"
                      label="Archivo banco 1"
                      sublabel=".xlsx de Caja Social o Bancolombia"
                      logo={['/logos/CajaSocial.png', '/logos/Bancolombia.png']}
                      file={archivo1}
                      onFile={setArchivo1}
                    />
                    <UploadZone
                      accept=".xlsx"
                      label="Archivo banco 2"
                      sublabel=".xlsx de Caja Social o Bancolombia"
                      logo={['/logos/CajaSocial.png', '/logos/Bancolombia.png']}
                      file={archivo2}
                      onFile={setArchivo2}
                    />
                  </div>

                  {/* Rango de fechas */}
                  <DateRangePicker
                    fechaIni={fechaIni}
                    setFechaIni={setFechaIni}
                    fechaFin={fechaFin}
                    setFechaFin={setFechaFin}
                    grupo="semanal"
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
                    {estado === 'loading' ? 'Procesando…' : 'Organizar y descargar'}
                  </button>
                </>
              )}

              {/* Spinner */}
              {estado === 'loading' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="spinner" />
                  <p className="text-secondary text-sm">Organizando movimientos…</p>
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="result-pill flex-col items-start"
                         style={{ background: 'rgba(0,196,212,0.1)', border: '1px solid rgba(0,196,212,0.25)' }}>
                      <span className="text-lg">🏦</span>
                      <span className="text-white font-bold text-xl leading-none">{resultado.cs}</span>
                      <span className="text-white/60 text-[11px] leading-tight">Movimientos Caja Social</span>
                    </div>
                    <div className="result-pill flex-col items-start"
                         style={{ background: 'rgba(0,196,212,0.1)', border: '1px solid rgba(0,196,212,0.25)' }}>
                      <span className="text-lg">💳</span>
                      <span className="text-white font-bold text-xl leading-none">{resultado.bc}</span>
                      <span className="text-white/60 text-[11px] leading-tight">Movimientos Bancolombia</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={handleReiniciar}
                            className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-all"
                            style={{ background: 'transparent', border: '1px solid #00C4D4', color: '#00C4D4' }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(0,196,212,0.1)'}
                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      Nueva semana
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
