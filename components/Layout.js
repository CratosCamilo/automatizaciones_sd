import Head from 'next/head'
import Link from 'next/link'

export default function Layout({ children, title = 'Slendy Automatizaciones' }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Barra superior magenta */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-12"
              style={{ background: '#D81B7C', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
        <Link href="/" className="text-white font-semibold text-sm tracking-wide hover:opacity-80 transition-opacity">
          SLENDY AUTOMATIZACIONES
        </Link>
        <span className="text-white/60 text-xs">
          {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
        </span>
      </header>

      {/* Contenido */}
      <main className="flex-1 bg-teal-base">
        {children}
      </main>
    </>
  )
}
