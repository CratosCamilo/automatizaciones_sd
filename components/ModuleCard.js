import Link from 'next/link'

export default function ModuleCard({ href, icon, nombre, descripcion }) {
  return (
    <Link href={href} className="module-card group no-underline">
      <div className="flex items-start justify-between">
        <span className="text-3xl">{icon}</span>
        <span className="text-white/30 group-hover:text-cyan-bright transition-colors text-lg">→</span>
      </div>
      <div>
        <p className="text-white font-semibold text-[15px] leading-snug mt-1">{nombre}</p>
        <p className="text-secondary text-[13px] leading-relaxed mt-1">{descripcion}</p>
      </div>
    </Link>
  )
}
