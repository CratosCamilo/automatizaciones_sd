import Link from 'next/link'

function LogoRow({ logos, icon, compact = false }) {
  if (!logos || logos.length === 0) {
    return <span className={compact ? 'text-xl' : 'text-3xl'}>{icon}</span>
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className="module-logo-chip chip-left">
        <img src={logos[0].src} alt={logos[0].alt} />
      </div>
      {logos[1] && (
        <>
          <span
            className="text-white/20 group-hover:text-cyan-bright transition-colors duration-300 text-[11px] select-none"
            style={{ fontWeight: 700, letterSpacing: '-0.5px' }}
          >
            ⟷
          </span>
          <div className="module-logo-chip chip-right">
            <img src={logos[1].src} alt={logos[1].alt} />
          </div>
        </>
      )}
    </div>
  )
}

export default function ModuleCard({ href, icon, nombre, descripcion, logos, variant = 'grid' }) {
  if (variant === 'list') {
    return (
      <Link href={href} className="module-card module-card-list group no-underline">
        <LogoRow logos={logos} icon={icon} compact />
        <p className="text-white font-semibold text-[14px] leading-tight flex-1 truncate">
          {nombre}
        </p>
        <span className="text-white/30 group-hover:text-cyan-bright transition-colors text-lg flex-shrink-0">→</span>
      </Link>
    )
  }

  return (
    <Link href={href} className="module-card group no-underline">
      <div className="flex items-start justify-between">
        <LogoRow logos={logos} icon={icon} />
        <span className="text-white/30 group-hover:text-cyan-bright transition-colors text-lg">→</span>
      </div>
      <div>
        <p className="text-white font-semibold text-[15px] leading-snug mt-1">{nombre}</p>
        <p className="text-secondary text-[13px] leading-relaxed mt-1">{descripcion}</p>
      </div>
    </Link>
  )
}
