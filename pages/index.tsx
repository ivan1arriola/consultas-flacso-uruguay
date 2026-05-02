import Head from 'next/head'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <Head>
        <title>Apps Script — Next.js</title>
      </Head>
      <main className="max-w-3xl text-center p-6">
        <h1 className="text-3xl font-bold mb-4">Migración: Apps Script → Next.js</h1>
        <p className="mb-6">Scaffold inicial con TypeScript, Tailwind y Prisma (Postgres).</p>
        <div className="flex gap-4 justify-center">
          <Link href="/api/health" className="text-sm text-blue-600 hover:underline">API Health</Link>
          <Link href="/admin/submissions" className="text-sm text-green-600 hover:underline font-bold">Ver Consultas &rarr;</Link>
          <Link href="/admin/analytics" className="text-sm text-purple-600 hover:underline font-bold">Análisis y Gráficos &rarr;</Link>
        </div>
      </main>
    </div>
  )
}
