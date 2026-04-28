import Link from 'next/link'

export default function ModuleCard({ href, icon, nombre, descripcion, logos }) {
  return (
    <Link href={href} className="module-card group no-underline">
      <div className="flex items-start justify-between">
        {logos?.length > 0 ? (
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
        ) : (
          <span className="text-3xl">{icon}</span>
        )}
        <span className="text-white/30 group-hover:text-cyan-bright transition-colors text-lg">→</span>
      </div>
      <div>
        <p className="text-white font-semibold text-[15px] leading-snug mt-1">{nombre}</p>
        <p className="text-secondary text-[13px] leading-relaxed mt-1">{descripcion}</p>
      </div>
    </Link>
  )
}
