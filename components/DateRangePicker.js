import { useState } from 'react'

const PRESETS = [
  { value: '',                   label: 'Elegir rango rápido...', grupos: ['semanal', 'quincenal', 'mensual'] },
  { value: 'este-mes',           label: 'Este mes',                grupos: ['mensual'] },
  { value: 'mes-anterior',       label: 'Mes anterior',            grupos: ['mensual'] },
  { value: 'esta-semana',        label: 'Esta semana (Lun–Dom)',   grupos: ['semanal'] },
  { value: 'semana-anterior',    label: 'Semana anterior',         grupos: ['semanal'] },
  { value: 'ultimos-7-dias',     label: 'Últimos 7 días',          grupos: ['semanal'] },
  { value: 'quincena-1-actual',  label: 'Quincena 1 este mes (1–15)',      grupos: ['quincenal'] },
  { value: 'quincena-2-actual',  label: 'Quincena 2 este mes (16–fin)',    grupos: ['quincenal'] },
  { value: 'quincena-1-anterior',label: 'Quincena 1 mes anterior (1–15)', grupos: ['quincenal'] },
  { value: 'quincena-2-anterior',label: 'Quincena 2 mes anterior (16–fin)',grupos: ['quincenal'] },
]

function toISO(date) {
  return date.toISOString().split('T')[0]
}

function getRange(preset) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  if (preset === 'este-mes') {
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    return [toISO(ini), toISO(fin)]
  }
  if (preset === 'mes-anterior') {
    const ini = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
    return [toISO(ini), toISO(fin)]
  }
  if (preset === 'esta-semana') {
    const diaSemana = hoy.getDay() // 0=Dom, 1=Lun...
    const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() + diffLunes)
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)
    return [toISO(lunes), toISO(domingo)]
  }
  if (preset === 'semana-anterior') {
    const diaSemana = hoy.getDay()
    const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() + diffLunes - 7)
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)
    return [toISO(lunes), toISO(domingo)]
  }
  if (preset === 'ultimos-7-dias') {
    const ini = new Date(hoy)
    ini.setDate(hoy.getDate() - 6)
    return [toISO(ini), toISO(hoy)]
  }
  if (preset === 'quincena-1-actual') {
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 15)
    return [toISO(ini), toISO(fin)]
  }
  if (preset === 'quincena-2-actual') {
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 16)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    return [toISO(ini), toISO(fin)]
  }
  if (preset === 'quincena-1-anterior') {
    const ini = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 15)
    return [toISO(ini), toISO(fin)]
  }
  if (preset === 'quincena-2-anterior') {
    const ini = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 16)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
    return [toISO(ini), toISO(fin)]
  }
  return ['', '']
}

export default function DateRangePicker({ fechaIni, setFechaIni, fechaFin, setFechaFin, grupo }) {
  const opciones = PRESETS.filter(p => !grupo || p.grupos.includes(grupo))
  const [preset, setPreset] = useState('')

  function handlePreset(e) {
    const val = e.target.value
    setPreset(val)
    if (val) {
      const [ini, fin] = getRange(val)
      setFechaIni(ini)
      setFechaFin(fin)
    } else {
      setFechaIni('')
      setFechaFin('')
    }
  }

  function handleFechaIni(e) {
    setFechaIni(e.target.value)
    setPreset('')
  }

  function handleFechaFin(e) {
    setFechaFin(e.target.value)
    setPreset('')
  }

  return (
    <div>
      <p className="text-secondary text-xs font-medium mb-3 uppercase tracking-wider">
        Rango de fechas
      </p>
      <select
        value={preset}
        onChange={handlePreset}
        className="select-input mb-3"
      >
        {opciones.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-secondary text-xs">Desde</label>
          <input
            type="date"
            value={fechaIni}
            onChange={handleFechaIni}
            className="date-input"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-secondary text-xs">Hasta</label>
          <input
            type="date"
            value={fechaFin}
            onChange={handleFechaFin}
            className="date-input"
          />
        </div>
      </div>
    </div>
  )
}
