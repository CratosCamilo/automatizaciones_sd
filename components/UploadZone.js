import { useRef, useState } from 'react'

function LogoChip({ logo }) {
  const logos = Array.isArray(logo) ? logo : [logo]
  const isMultiple = logos.length > 1
  return (
    <div className={isMultiple ? 'flex items-center gap-2' : ''}>
      {logos.map((src, i) => (
        <div key={i} className={`upload-logo${isMultiple ? ' upload-logo-sm' : ''}`}>
          <img src={src} alt="Logo" />
        </div>
      ))}
    </div>
  )
}

function _extensionValida(file, accept) {
  if (!accept) return true
  const ext = '.' + file.name.split('.').pop().toLowerCase()
  return accept.split(',').map(s => s.trim().toLowerCase()).includes(ext)
}

export default function UploadZone({ accept, label, sublabel, icon, logo, file, onFile }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState(null)

  const handleFile = (f) => {
    if (!_extensionValida(f, accept)) {
      const ext = '.' + f.name.split('.').pop().toLowerCase()
      setFileError(`Formato incorrecto. Se esperaba ${accept}, se recibió ${ext}`)
      return
    }
    setFileError(null)
    onFile(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const classes = [
    'upload-zone',
    dragging ? 'dragging' : '',
    file ? 'has-file' : '',
    fileError ? 'upload-zone-error' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]) }}
      />

      {file ? (
        <>
          <span className="text-3xl">✅</span>
          <div className="text-center">
            <p className="text-white font-medium text-sm">{file.name}</p>
            <p className="text-secondary text-xs mt-1">
              {(file.size / 1024).toFixed(0)} KB — clic para cambiar
            </p>
          </div>
        </>
      ) : fileError ? (
        <>
          <span className="text-3xl">⚠️</span>
          <div className="text-center">
            <p className="font-medium text-sm" style={{ color: '#EF5350' }}>Archivo no compatible</p>
            <p className="text-secondary text-xs mt-1">{fileError}</p>
            <p className="text-xs mt-3" style={{ color: '#EF5350', opacity: 0.7 }}>
              Hacé clic o arrastrá el archivo correcto
            </p>
          </div>
        </>
      ) : (
        <>
          {logo ? <LogoChip logo={logo} /> : <span className="text-4xl opacity-70">{icon}</span>}
          <div className="text-center">
            <p className="text-white font-semibold text-[14px]">{label}</p>
            <p className="text-secondary text-xs mt-1">{sublabel}</p>
            <p className="text-cyan-bright/70 text-xs mt-3">
              Arrastrá aquí o hacé clic para buscar
            </p>
          </div>
        </>
      )}
    </div>
  )
}
