import Layout from '../components/Layout'
import ModuleCard from '../components/ModuleCard'

const MODULOS = [
  {
    id: 'conciliacion',
    href: '/conciliacion',
    logos: [
      { src: '/logos/Dian.png',  alt: 'DIAN'  },
      { src: '/logos/Siigo.png', alt: 'Siigo' },
    ],
    nombre: 'Conciliación DIAN vs Siigo',
    descripcion: 'Cruza las facturas de la DIAN con Siigo e identifica las que faltan.',
  },
  {
    id: 'movimientos',
    href: '/movimientos',
    logos: [
      { src: '/logos/CajaSocial.png',  alt: 'Banco Caja Social' },
      { src: '/logos/Bancolombia.png', alt: 'Bancolombia'       },
    ],
    nombre: 'Bancos Semanal',
    descripcion: 'Organiza los movimientos de Caja Social y Bancolombia por día y semana.',
  },
  {
    id: 'davivienda',
    href: '/davivienda',
    logos: [
      { src: '/logos/Davivienda.png', alt: 'Davivienda' },
      { src: '/logos/Redeban.webp',   alt: 'Redeban'    },
    ],
    nombre: 'Davivienda Quincenal',
    descripcion: 'Cruza los QR de Davivienda con Redeban y arma el reporte quincenal.',
  },
  {
    id: 'cta-ahorros',
    href: '/cta-ahorros',
    logos: [
      { src: '/logos/CajaSocial.png', alt: 'Banco Caja Social' },
      { src: '/logos/Siigo.png',      alt: 'Siigo'             },
    ],
    nombre: 'Cta Ahorros Caja Social',
    descripcion: 'Concilia la cuenta de ahorros de Caja Social con Siigo por débitos y créditos.',
  },
  {
    id: 'caja-social-nueva',
    href: '/caja-social-nueva',
    logos: [
      { src: '/logos/CajaSocial.png', alt: 'Banco Caja Social' },
      { src: '/logos/Siigo.png',      alt: 'Siigo'             },
    ],
    nombre: 'Caja Social Mensual',
    descripcion: 'Concilia el extracto XLSX de la nueva página de Caja Social con Siigo.',
  },
]

export default function Dashboard() {
  return (
    <Layout title="Inicio — Slendy Automatizaciones">
      <div className="min-h-[calc(100vh-48px)] flex flex-col">

        {/* Greeting */}
        <div className="px-6 pt-12 pb-8" style={{ background: 'linear-gradient(180deg, #004D5F 0%, #003F4F 100%)' }}>
          <div className="max-w-3xl mx-auto">
            <h1 className="text-[28px] font-bold text-white leading-tight">
              Hola, Slendy 👋
            </h1>
            <p className="text-secondary mt-1 text-[15px]">
              ¿Qué quieres automatizar hoy?
            </p>

            {/* Badge contador */}
            <div className="mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
                 style={{ background: 'rgba(0,196,212,0.15)', border: '1px solid rgba(0,196,212,0.3)', color: '#00C4D4' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-bright animate-pulse" />
              {MODULOS.length} módulo{MODULOS.length !== 1 ? 's' : ''} disponible{MODULOS.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Grid de módulos */}
        <div className="flex-1 px-6 py-8">
          <div className="max-w-3xl mx-auto">
            <p className="text-secondary text-xs uppercase tracking-widest font-medium mb-4">
              Módulos
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {MODULOS.map((m) => (
                <ModuleCard key={m.id} {...m} />
              ))}

              {/* Placeholder "próximamente" */}
              <div className="rounded-xl p-6 flex flex-col gap-2"
                   style={{ background: 'rgba(0,96,112,0.3)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <span className="text-3xl opacity-30">＋</span>
                <p className="text-white/30 font-medium text-[14px] mt-1">Próximo módulo</p>
                <p className="text-white/20 text-[12px]">Más automatizaciones en camino.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 text-center">
          <p className="text-white/20 text-xs">
            Slendy Automatizaciones ·{' '}
            <a href="https://github.com/CratosCamilo" target="_blank" rel="noopener noreferrer"
               className="text-white/40 hover:text-cyan-bright transition-colors underline underline-offset-2">
              Desarrollador
            </a>
          </p>
        </footer>
      </div>
    </Layout>
  )
}
