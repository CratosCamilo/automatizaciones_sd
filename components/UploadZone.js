import { useRef, useState } from 'react'

export default function UploadZone({ accept, label, sublabel, icon, file, onFile }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  const classes = [
    'upload-zone',
    dragging ? 'dragging' : '',
    file ? 'has-file' : '',
  ].join(' ')

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
        onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
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
      ) : (
        <>
          <span className="text-4xl opacity-70">{icon}</span>
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
