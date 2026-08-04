import { useState } from 'react'
import Link from 'next/link'
import Layout from '../../components/Layout'
import UploadZone from '../../components/UploadZone'

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
            <span className="text-lg">📦</span>
            <h2 className="text-white font-semibold text-[15px]">¿Cómo funciona el inventario mensual?</h2>
          </div>
          <button
            onClick={onClose}
            className="text-secondary hover:text-white transition-colors text-xl leading-none"
            aria-label="Cerrar"
          >×</button>
        </div>

        <div className="px-6 py-5 space-y-5 text-sm leading-relaxed">

          <section>
            <h3 className="text-white font-semibold mb-1.5">¿Qué es?</h3>
            <p className="text-secondary">
              Automatiza el armado de la hoja del mes en el archivo <strong className="text-white">INVENTARIO {new Date().getFullYear()}</strong>.
              Toma las <strong className="text-white">pólizas de Siigo</strong> (compras de materia prima) y el <strong className="text-white">stock físico</strong>{' '}
              del último día del mes, y los cruza contra los productos del inventario.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1.5">¿Qué hace exactamente?</h3>
            <ul className="text-secondary space-y-1 list-disc list-inside">
              <li>Duplica la hoja del mes anterior en el INVENTARIO.</li>
              <li>Pasa <em>INV FINAL</em> del mes anterior a <em>INV INICIAL</em> del nuevo mes.</li>
              <li>Filtra las pólizas de Siigo por <em>Producto: MATERIA PRIMA VARIOS</em> y consolida por descripción.</li>
              <li>Cruza los nombres del pool contra el inventario y rellena la columna <em>COMPRAS</em>.</li>
              <li>Cruza los nombres del stock físico y rellena la columna <em>CANTIDAD</em>.</li>
              <li>Los que no matchean quedan a la derecha (columnas I-K) para revisar manualmente.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1.5">¿Cómo detecta cuál archivo es cuál?</h3>
            <p className="text-secondary">
              No importa el orden en que subas los 3 excels. El sistema los detecta por contenido: el
              INVENTARIO por sus hojas con nombres de mes, las pólizas por su encabezado en fila 8 con la
              columna "Detalle", y el stock por el header <em>Stock al YYYY-MM-DD</em>.
              El mes se saca automáticamente de la fecha del stock.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1.5">Match por nombre exacto</h3>
            <p className="text-secondary">
              El cruce es por nombre exacto (ignorando espacios al inicio y al final). Si un producto tiene
              una letra o espacio de más, no matchea y queda en el bloque de sobrantes. Es intencional:
              te sirve para detectar nombres inconsistentes.
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
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function InventarioMensual() {
  const [fileA,        setFileA]        = useState(null)
  const [fileB,        setFileB]        = useState(null)
  const [fileC,        setFileC]        = useState(null)
  const [estado,       setEstado]       = useState('idle')
  const [resultado,    setResultado]    = useState(null)
  const [errorMsg,     setErrorMsg]     = useState('')
  const [modalAbierto, setModal]        = useState(false)

  const puedeEnviar = fileA && fileB && fileC && estado !== 'loading'

  const handleProcesar = async () => {
    setEstado('loading')
    setResultado(null)
    setErrorMsg('')

    try {
      const [b64A, b64B, b64C] = await Promise.all([
        toBase64(fileA),
        toBase64(fileB),
        toBase64(fileC),
      ])

      const res = await fetch('/api/inventario_mensual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archivo_a: b64A,
          archivo_b: b64B,
          archivo_c: b64C,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Error del servidor (${res.status})`)
      }

      const mes         = res.headers.get('X-Mes') || ''
      const comprasOk   = parseInt(res.headers.get('X-Compras-Ok')          || '0', 10)
      const comprasPend = parseInt(res.headers.get('X-Compras-Pendientes')  || '0', 10)
      const cantOk      = parseInt(res.headers.get('X-Cantidad-Ok')         || '0', 10)
      const cantPend    = parseInt(res.headers.get('X-Cantidad-Pendientes') || '0', 10)

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      const anio = (mes.match(/\d{4}/) || [new Date().getFullYear()])[0]
      a.download = `INVENTARIO ${anio}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setResultado({ mes, comprasOk, comprasPend, cantOk, cantPend })
      setEstado('success')

    } catch (err) {
      setErrorMsg(err.message)
      setEstado('error')
    }
  }

  const handleReiniciar = () => {
    setFileA(null)
    setFileB(null)
    setFileC(null)
    setEstado('idle')
    setResultado(null)
    setErrorMsg('')
  }

  return (
    <Layout title="Inventario mensual Zapatoca">
      {modalAbierto && <ModalComoFunciona onClose={() => setModal(false)} />}
      <div className="min-h-[calc(100vh-48px)] px-6 py-8">
        <div className="max-w-2xl mx-auto">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-secondary mb-6">
            <Link href="/" className="hover:text-white transition-colors">Inicio</Link>
            <span>/</span>
            <span className="text-white">Inventario mensual Zapatoca</span>
          </div>

          {/* Card principal */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#004D5F', border: '1px solid rgba(255,255,255,0.08)' }}>

            {/* Header de la card */}
            <div className="px-6 py-5" style={{ background: '#006070', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📦</span>
                  <div>
                    <h1 className="text-white font-semibold text-[17px] leading-tight">
                      Inventario mensual Zapatoca
                    </h1>
                    <p className="text-secondary text-xs mt-0.5">
                      Arma la hoja del nuevo mes en INVENTARIO cruzando Siigo + stock físico
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
                    Subí los <strong className="text-white">3 archivos .xlsx</strong> en cualquier orden. El mes
                    se detecta automáticamente desde la fecha del stock físico.
                  </div>

                  {/* Zonas de upload */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <UploadZone
                      accept=".xlsx"
                      label="Siigo"
                      sublabel=".xlsx — pólizas detalladas del mes"
                      logo="/logos/Siigo.png"
                      file={fileA}
                      onFile={setFileA}
                    />
                    <UploadZone
                      accept=".xlsx"
                      label="Inventario"
                      sublabel=".xlsx — INVENTARIO YYYY acumulado"
                      logo="/logos/Zapatoca.png"
                      file={fileB}
                      onFile={setFileB}
                    />
                    <UploadZone
                      accept=".xlsx"
                      label="Stock"
                      sublabel=".xlsx — stock físico al último día del mes"
                      logo="/logos/Zapatoca.png"
                      file={fileC}
                      onFile={setFileC}
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
                  <p className="text-secondary text-sm">Cruzando Siigo, stock e inventario…</p>
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
                    <p className="text-white font-semibold">
                      ¡Listo! Hoja de <span className="text-cyan-bright">{resultado.mes}</span> agregada y descargada.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="result-pill flex-col items-start"
                         style={{ background: 'rgba(235,241,222,0.15)', border: '1px solid rgba(235,241,222,0.3)' }}>
                      <span className="text-lg">🟢</span>
                      <span className="text-white font-bold text-xl leading-none">{resultado.comprasOk}</span>
                      <span className="text-white/60 text-[11px] leading-tight">Compras matcheadas</span>
                    </div>
                    <div className="result-pill flex-col items-start"
                         style={{ background: 'rgba(253,233,217,0.15)', border: '1px solid rgba(253,233,217,0.3)' }}>
                      <span className="text-lg">🟠</span>
                      <span className="text-white font-bold text-xl leading-none">{resultado.comprasPend}</span>
                      <span className="text-white/60 text-[11px] leading-tight">Compras pendientes</span>
                    </div>
                    <div className="result-pill flex-col items-start"
                         style={{ background: 'rgba(235,241,222,0.15)', border: '1px solid rgba(235,241,222,0.3)' }}>
                      <span className="text-lg">🟢</span>
                      <span className="text-white font-bold text-xl leading-none">{resultado.cantOk}</span>
                      <span className="text-white/60 text-[11px] leading-tight">Cantidades matcheadas</span>
                    </div>
                    <div className="result-pill flex-col items-start"
                         style={{ background: 'rgba(253,233,217,0.15)', border: '1px solid rgba(253,233,217,0.3)' }}>
                      <span className="text-lg">🟠</span>
                      <span className="text-white font-bold text-xl leading-none">{resultado.cantPend}</span>
                      <span className="text-white/60 text-[11px] leading-tight">Cantidades pendientes</span>
                    </div>
                  </div>

                  {(resultado.comprasPend > 0 || resultado.cantPend > 0) && (
                    <div className="rounded-lg px-4 py-3 text-xs text-secondary leading-relaxed"
                         style={{ background: 'rgba(253,233,217,0.08)', border: '1px solid rgba(253,233,217,0.2)' }}>
                      Los items pendientes están a la derecha de la hoja (columnas I-K) para que los revises manualmente.
                    </div>
                  )}

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
