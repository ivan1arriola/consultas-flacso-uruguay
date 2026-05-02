import Head from 'next/head'
import Link from 'next/link'
import { GetServerSideProps } from 'next'
import prisma from '../../src/lib/prisma'
import { google } from 'googleapis'
import { useState, useRef } from 'react'
import { useRouter } from 'next/router'
import html2canvas from 'html2canvas'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

interface AnalyticsData {
  offer: string
  abbreviation: string
  total: number
  uy: number
  ext: number
}

interface Summary {
  totalConsultas: number
  totalCorreosUnicos: number
  totalUy: number
  totalExt: number
  correosUyUnicos: number
  correosExtUnicos: number
  correosAmbos: number
  paisesDiferentes: number
  startDate?: string
  endDate?: string
}

interface Program {
  wpId: string
  abbreviation: string | null
  name: string
}

interface Props {
  data: AnalyticsData[]
  summary: Summary
  programs: Program[]
  error?: string
}

const COLORS = ['#0f5b7a', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function AnalyticsPage({ data, summary, programs, error }: Props) {
  const router = useRouter()
  const reportRef = useRef<HTMLDivElement>(null)
  
  const [dates, setDates] = useState({
    start: summary.startDate || '',
    end: summary.endDate || ''
  })
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>(
    router.query.postIds ? (router.query.postIds as string).split(',') : []
  )
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingDrive, setIsExportingDrive] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/admin/sync-programs', { method: 'POST' })
      const result = await response.json()
      if (result.success) {
        alert(result.message)
        router.reload()
      } else {
        alert('Error: ' + result.message)
      }
    } catch (err) {
      alert('Error al sincronizar con WordPress')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleMigrate = async () => {
    if (!confirm('¿Estás seguro de que quieres migrar todos los datos del spreadsheet? Este proceso puede tardar unos minutos.')) return
    setIsMigrating(true)
    try {
      const response = await fetch('/api/admin/migrate-sheet', { method: 'POST' })
      const result = await response.json()
      if (result.success) {
        alert(result.message)
        router.reload()
      } else {
        alert('Error: ' + result.message)
      }
    } catch (err) {
      alert('Error al migrar datos del spreadsheet')
    } finally {
      setIsMigrating(false)
    }
  }

  const handleFilter = () => {
    router.push({
      pathname: '/admin/analytics',
      query: { 
        start: dates.start, 
        end: dates.end,
        postIds: selectedPostIds.join(',')
      }
    })
  }

  const handleExportDrive = async () => {
    setIsExportingDrive(true)
    try {
      const response = await fetch('/api/admin/export-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: dates.start,
          endDate: dates.end,
          postIds: selectedPostIds,
          fileName: `Exportación Consultas Filtradas - ${new Date().toLocaleDateString()}`
        })
      })

      const result = await response.json()
      if (result.success) {
        window.open(result.url, '_blank')
        alert(result.message)
      } else {
        alert('Error: ' + result.message)
      }
    } catch (err) {
      alert('Error al exportar a Drive')
    } finally {
      setIsExportingDrive(false)
    }
  }

  const handleExportImage = async () => {
    if (!reportRef.current) return
    setIsExporting(true)
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f9fafb'
      })
      const link = document.createElement('a')
      link.download = `Reporte_Consultas_${dates.start || 'inicio'}_a_${dates.end || 'hoy'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      alert('Error al generar la imagen')
    } finally {
      setIsExporting(false)
    }
  }

  const togglePostId = (wpId: string) => {
    setSelectedPostIds(prev => 
      prev.includes(wpId) ? prev.filter(id => id !== wpId) : [...prev, wpId]
    )
  }

  const pieData = [
    { name: 'Uruguay', value: summary.totalUy },
    { name: 'Exterior', value: summary.totalExt },
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Panel de Análisis y Reportes</title>
      </Head>
      
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 font-sans">Análisis y Exportación</h1>
              <p className="text-sm text-gray-600 mt-1">Filtra por fechas y programas para exportar a Drive</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={handleSync}
                disabled={isSyncing}
                className="px-3 py-1.5 text-xs font-bold bg-purple-50 text-purple-600 rounded-lg border border-purple-100 hover:bg-purple-100 transition-colors flex items-center gap-1.5"
              >
                🔄 {isSyncing ? 'Sincronizando...' : 'Sincronizar WP'}
              </button>
              <button 
                onClick={handleMigrate}
                disabled={isMigrating}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors ${
                  isMigrating ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100'
                }`}
              >
                🚀 {isMigrating ? 'Migrando...' : 'Migrar Histórico'}
              </button>
              <Link href="/admin/submissions" className="px-3 py-1.5 text-xs font-bold bg-white text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                👁️ Ver Registros
              </Link>
              <Link href="/admin/settings" className="px-3 py-1.5 text-xs font-bold bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-1.5">
                ⚙️ Configuración
              </Link>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Date Filters */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase text-gray-400">Rango de fechas</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-500 mb-1">Desde</label>
                  <input 
                    type="date" 
                    className="text-sm border-gray-200 rounded-lg w-full"
                    value={dates.start}
                    onChange={(e) => setDates(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-500 mb-1">Hasta</label>
                  <input 
                    type="date" 
                    className="text-sm border-gray-200 rounded-lg w-full"
                    value={dates.end}
                    onChange={(e) => setDates(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Program Selection */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase text-gray-400">Ofertas Académicas</label>
                <button 
                  onClick={() => {
                    if (selectedPostIds.length === programs.length) setSelectedPostIds([])
                    else setSelectedPostIds(programs.map(p => p.wpId))
                  }}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-500 uppercase"
                >
                  {selectedPostIds.length === programs.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto border border-gray-100 rounded-lg p-2 space-y-1 bg-gray-50">
                {(programs || []).map(p => (
                  <label key={p.wpId} className="flex items-center gap-2 px-2 py-1 hover:bg-white rounded cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 h-3 w-3"
                      checked={selectedPostIds.includes(p.wpId)}
                      onChange={() => togglePostId(p.wpId)}
                    />
                    <span className="text-[11px] text-gray-700 truncate">{p.abbreviation || 'S/C'} - {p.name}</span>
                  </label>
                ))}
                {(!programs || programs.length === 0) && (
                  <div className="text-[10px] text-gray-400 p-2 italic text-center">No hay programas disponibles</div>
                )}
              </div>
              <p className="text-[10px] text-gray-400 text-right">{selectedPostIds.length} seleccionadas</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col justify-end gap-3">
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleFilter}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors"
                >
                  Filtrar Vista
                </button>
                <button 
                  onClick={handleExportDrive}
                  disabled={isExportingDrive}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition-colors flex justify-center items-center gap-1"
                >
                  {isExportingDrive ? 'Exportando...' : 'Exportar Drive'}
                </button>
              </div>
              <button 
                onClick={handleExportImage}
                disabled={isExporting}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg font-bold text-sm hover:bg-black transition-colors"
              >
                {isExporting ? 'Procesando...' : 'Descargar Reporte PNG'}
              </button>
            </div>
          </div>
        </div>

        <div ref={reportRef} className="p-4 rounded-xl">
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded shadow-sm">
              <p className="text-sm text-red-700 font-medium">Error al procesar datos: {error}</p>
            </div>
          )}

          {/* Dashboard Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase">Consultas Totales</h3>
              <p className="text-3xl font-bold text-blue-900 mt-2">{summary.totalConsultas}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase">Usuarios Únicos</h3>
              <p className="text-3xl font-bold text-purple-900 mt-2">{summary.totalCorreosUnicos}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase">Consultas Uruguay</h3>
              <p className="text-3xl font-bold text-green-700 mt-2">{summary.totalUy}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase">Consultas Exterior</h3>
              <p className="text-3xl font-bold text-amber-700 mt-2">{summary.totalExt}</p>
            </div>
          </div>

          {/* Resumen General Table */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-6">Resumen general</h2>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-blue-900 uppercase">Segmento</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-blue-900 uppercase">Consultas únicas</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-blue-900 uppercase">Correos únicos</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Total</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">{summary.totalConsultas}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">{summary.totalCorreosUnicos}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Uruguay</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">{summary.totalUy}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">{summary.correosUyUnicos}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Exterior</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">{summary.totalExt}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">{summary.correosExtUnicos}</td>
                  </tr>
                  <tr className="bg-gray-50/30">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 italic">Correos presentes en ambos segmentos</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-400">-</td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-blue-600">{summary.correosAmbos}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top Programs Chart */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-6">Consultas por Programa (Top 10)</h2>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="abbreviation" 
                      type="category" 
                      tick={{ fontSize: 12, fontWeight: 'bold', fill: '#0f5b7a' }} 
                      width={60}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }} 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value, name, props) => [value, props.payload.offer]}
                    />
                    <Bar dataKey="total" fill="#0f5b7a" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Geographic Distribution */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-6">Segmentación Geográfica</h2>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detalle por Oferta Table */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-6">Detalle por oferta</h2>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Programa</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Uruguay</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Exterior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.offer}</td>
                      <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">{row.total}</td>
                      <td className="px-6 py-4 text-sm text-right text-green-600">{row.uy}</td>
                      <td className="px-6 py-4 text-sm text-right text-amber-600">{row.ext}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, color }: { title: string, value: number, color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
      <dd className={`mt-1 text-3xl font-bold p-2 rounded-lg inline-block ${colors[color] || 'bg-gray-50'}`}>
        {value}
      </dd>
    </div>
  )
}

function normalizeEmailLegacy(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[,;]+/g, '')
    .replace(/\s+/g, '');
}

function isUruguay(country: string | null) {
  if (!country) return false
  const norm = country.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return norm === 'uruguay' || norm === 'uy' || norm === 'uru'
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { start, end, postIds } = context.query
  
  // Ajuste de Zona Horaria (Uruguay GMT-3)
  // Para coincidir con Apps Script, el día empieza a las 00:00 Montevideo
  const startDate = start ? new Date(`${start as string}T00:00:00-03:00`) : null
  const endDate = end ? new Date(`${end as string}T23:59:59-03:00`) : null
  const targetPostIds = postIds ? (postIds as string).split(',') : []

  try {
    // 0. Fetch Programs
    const programs = await prisma.program.findMany({
      select: { wpId: true, abbreviation: true, name: true, legacyId: true },
      orderBy: { abbreviation: 'asc' }
    })

    // 0.1 Resolve Expanded IDs (WP ID + Legacy ID)
    let expandedPostIds = [...targetPostIds]
    if (targetPostIds.length > 0) {
      const selectedPrograms = programs.filter(p => targetPostIds.includes(p.wpId))
      selectedPrograms.forEach(p => {
        if (p.legacyId && !expandedPostIds.includes(p.legacyId)) {
          expandedPostIds.push(p.legacyId)
        }
      })
    }

    // 0.2 Fetch Excluded Emails
    const excludedEmailsDb = await prisma.excludedEmail.findMany({ select: { email: true } })
    const excludedSet = new Set(excludedEmailsDb.map(e => e.email.toLowerCase()))

    // 1. Fetch DB data
    const dbSubmissions = await prisma.submission.findMany({
      where: {
        ...(startDate || endDate ? {
          createdAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          }
        } : {}),
        ...(expandedPostIds.length > 0 ? {
          postId: { in: expandedPostIds }
        } : {})
      },
      orderBy: { createdAt: 'desc' } // Rule 7: Most recent first
    })

    // 2. Normalize and Filter data (Legacy logic)
    const filteredData = dbSubmissions
      .map(s => {
        const emailNorm = normalizeEmailLegacy(s.email);
        const domain = emailNorm.split('@')[1] || '';
        return {
          email: emailNorm,
          domain: domain,
          offer: s.postTitle?.trim(),
          postId: s.postId,
          isUy: isUruguay(s.country),
          country: s.country?.trim(),
          date: new Date(s.createdAt)
        };
      })
      .filter(d => {
        // Rule 2: Exclude internal and empty emails (Legacy check)
        if (!d.email) return false;
        if (d.domain === 'flacso.edu.uy') return false;
        if (excludedSet.has(d.email)) return false;
        
        // Rule 3: Exclude if no offer
        if (!d.offer) return false;
        
        // Rule 4: Exclude if no country (Legacy checks !!record.paisKey)
        const countryKey = d.country ? d.country.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
        if (!countryKey) return false;
        
        return true;
      })

    // 6. Deduplicate by Email + Offer
    const deduplicated = new Map()
    filteredData.forEach(item => {
      const key = `${item.email}|${item.offer}`
      // Since we ordered by createdAt desc, the first one seen is the most recent (Rule 7)
      if (!deduplicated.has(key)) {
        deduplicated.set(key, item)
      }
    })

    const finalRecords = Array.from(deduplicated.values())

    // Create lookup for abbreviations
    const programLookup = new Map()
    programs.forEach(p => {
      if (p.abbreviation) {
        programLookup.set(p.wpId, p.abbreviation)
        if (p.legacyId) programLookup.set(p.legacyId, p.abbreviation)
      }
    })

    // 5. Aggregate
    const offerMap = new Map()
    const correosUnicos = new Set()
    const correosUy = new Set()
    const correosExt = new Set()
    let totalUy = 0
    let totalExt = 0
    const paisesUnicos = new Set()

    finalRecords.forEach(record => {
      correosUnicos.add(record.email)
      paisesUnicos.add(record.country)
      
      if (record.isUy) {
        totalUy++
        correosUy.add(record.email)
      } else {
        totalExt++
        correosExt.add(record.email)
      }

      const stats = offerMap.get(record.offer) || { 
        total: 0, 
        uy: 0, 
        ext: 0, 
        abbreviation: programLookup.get(record.postId) || record.offer.substring(0, 15) + '...'
      }
      stats.total++
      if (record.isUy) stats.uy++
      else stats.ext++
      offerMap.set(record.offer, stats)
    })

    // Calculate intersection
    const intersection = new Set([...correosUy].filter(x => correosExt.has(x)))

    const data: AnalyticsData[] = Array.from(offerMap.entries()).map(([offer, stats]) => ({
      offer,
      ...stats
    })).sort((a, b) => b.total - a.total)

    return {
      props: {
        data,
        summary: {
          totalConsultas: finalRecords.length,
          totalCorreosUnicos: correosUnicos.size,
          totalUy,
          totalExt,
          correosUyUnicos: correosUy.size,
          correosExtUnicos: correosExt.size,
          correosAmbos: intersection.size,
          paisesDiferentes: paisesUnicos.size,
          startDate: start || null,
          endDate: end || null
        },
        programs: JSON.parse(JSON.stringify(programs))
      }
    }

  } catch (error: any) {
    console.error('Analytics Error:', error)
    return {
      props: {
        data: [],
        summary: { totalConsultas: 0, totalCorreosUnicos: 0, totalUy: 0, totalExt: 0, paisesDiferentes: 0, correosUyUnicos: 0, correosExtUnicos: 0, correosAmbos: 0 },
        programs: [],
        error: error.message || 'Error al procesar el reporte'
      }
    }
  }
}
