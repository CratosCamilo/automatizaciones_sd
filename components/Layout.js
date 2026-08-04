import Head from 'next/head'
import Link from 'next/link'

export default function Layout({ children, title = 'Slendy Automatizaciones' }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta name="theme-color" content="#00C4D4" />
      </Head>

      {/* Barra superior */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-12"
              style={{ background: '#37474F', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <img src="/logo.svg" alt="" className="w-7 h-7" width="28" height="28" />
          <span className="text-white font-semibold text-sm tracking-wide">
            SLENDY AUTOMATIZACIONES
          </span>
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
