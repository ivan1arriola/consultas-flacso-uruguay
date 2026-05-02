import Head from 'next/head'
import Link from 'next/link'
import { GetServerSideProps } from 'next'
import { google } from 'googleapis'
import { useState } from 'react'
import { useRouter } from 'next/router'
import prisma from '../../src/lib/prisma'

interface LegacySubmission {
  email: string
  name: string
  lastName: string
  profession: string
  offer: string
  date: string
  time: string
  country: string
  eduLevel: string
  postId?: string
}

interface Program {
  wpId: string
  name: string
}

interface Props {
  submissions: LegacySubmission[]
  programs: Program[]
  totalInSheet: number
  error?: string
  query: {
    start?: string
    end?: string
    search?: string
    postIds?: string
  }
}

export default function LegacySubmissionsPage({ submissions, programs, totalInSheet, error, query }: Props) {
  const router = useRouter()
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [isExporting, setIsExporting] = useState(false)

  const [startDate, setStartDate] = useState(query.start || '')
  const [endDate, setEndDate] = useState(query.end || '')
  const [search, setSearch] = useState(query.search || '')
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>(query.postIds ? query.postIds.split(',') : [])

  const toggleSelectAll = () => {
    if (selectedIndices.length === submissions.length) {
      setSelectedIndices([])
    } else {
      setSelectedIndices(submissions.map((_, i) => i))
    }
  }

  const toggleSelect = (idx: number) => {
    setSelectedIndices(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    )
  }

  const handleFilter = () => {
    router.push({
      pathname: '/admin/legacy-submissions',
      query: {
        start: startDate,
        end: endDate,
        search: search,
        postIds: selectedPrograms.join(',')
      }
    })
  }

  const handleExport = async () => {
    if (selectedIndices.length === 0) return
    setIsExporting(true)
    
    try {
      const selectedData = submissions.filter((_, i) => selectedIndices.includes(i))
      const response = await fetch('/api/admin/export-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: selectedData,
          fileName: `Exportación Histórica (${selectedIndices.length}) - ${new Date().toLocaleDateString()}`
        })
      })

      const result = await response.json()
      if (result.success) {
        window.open(result.url, '_blank')
        alert(result.message)
      } else {
        alert('Error: ' + result.message)
      }
    } catch (error) {
      alert('Error al exportar a Drive')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Administración - Consultas Históricas (Sheets)</title>
      </Head>
      
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consultas Históricas (Sheets)</h1>
            <p className="text-sm text-gray-600 mt-1">
              Mostrando {submissions.length} de {totalInSheet} registros totales en la hoja de cálculo
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/submissions" className="px-3 py-1.5 text-sm font-medium bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
              📊 Ver Consultas en DB
            </Link>
            <Link href="/" className="px-3 py-1.5 text-sm font-medium bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              🏠 Inicio
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
            <p className="text-sm text-red-700 font-medium">Error: {error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-gray-400">Rango de fechas</label>
            <div className="flex gap-2">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm border-gray-200 rounded-lg focus:ring-purple-500" 
              />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm border-gray-200 rounded-lg focus:ring-purple-500" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-gray-400">Buscar (Email / Nombre)</label>
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ej: ivan@..."
              className="w-full text-sm border-gray-200 rounded-lg focus:ring-purple-500" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-gray-400">Filtrar por Programa</label>
            <div className="max-h-32 overflow-y-auto border border-gray-100 rounded-lg p-2 space-y-1 bg-gray-50 text-[10px]">
              {programs.map(p => (
                <label key={p.wpId} className="flex items-center gap-2 px-2 py-1 hover:bg-white rounded cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedPrograms.includes(p.wpId)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedPrograms([...selectedPrograms, p.wpId])
                      else setSelectedPrograms(selectedPrograms.filter(id => id !== p.wpId))
                    }}
                    className="rounded text-purple-600 h-3 w-3" 
                  />
                  <span className="text-gray-700 truncate">{p.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-end">
            <button 
              onClick={handleFilter}
              className="w-full py-2 bg-purple-600 text-white text-sm font-bold rounded-lg shadow hover:bg-purple-700 transition-colors"
            >
              🔍 Filtrar en Sheets
            </button>
          </div>
        </div>

        {/* Selection Actions */}
        {selectedIndices.length > 0 && (
          <div className="mb-4 bg-purple-600 p-4 rounded-lg shadow-lg flex justify-between items-center animate-in fade-in slide-in-from-top-2">
            <div className="text-sm text-white font-medium">
              {selectedIndices.length} registros seleccionados
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-2 bg-white text-purple-600 text-sm font-bold rounded-lg shadow hover:bg-purple-50 transition-colors flex items-center gap-2"
            >
              {isExporting ? 'Exportando...' : 'Exportar a Drive →'}
            </button>
          </div>
        )}

        <div className="bg-white shadow-xl overflow-hidden rounded-xl border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-4 text-left">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-purple-600 h-4 w-4"
                      checked={selectedIndices.length === submissions.length && submissions.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha / Hora</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Usuario / Email</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Oferta Consultada</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">País / Nivel</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Profesión</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">
                      No se encontraron registros en la hoja de cálculo con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub, idx) => (
                    <tr key={idx} className={`hover:bg-purple-50/50 transition-colors ${selectedIndices.includes(idx) ? 'bg-purple-50' : ''}`}>
                      <td className="px-4 py-4 text-left">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-purple-600 h-4 w-4"
                          checked={selectedIndices.includes(idx)}
                          onChange={() => toggleSelect(idx)}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="font-medium text-gray-900">{sub.date}</div>
                        <div className="text-xs">{sub.time}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{sub.name} {sub.lastName}</div>
                        <div className="text-xs text-purple-600">{sub.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-gray-700 max-w-xs leading-tight">{sub.offer}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-gray-600">{sub.country}</span>
                          <span className="text-[10px] text-gray-400">{sub.eduLevel}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 italic">
                        {sub.profession}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { start, end, search, postIds } = context.query
  const startDate = start ? new Date(start as string) : null
  const endDate = end ? new Date(end as string) : null
  const searchTerm = search ? (search as string).toLowerCase() : ''
  const targetPostIds = postIds ? (postIds as string).split(',') : []

  if (endDate) endDate.setHours(23, 59, 59, 999)

  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
    let privateKey = process.env.GOOGLE_PRIVATE_KEY
    if (!clientEmail || !privateKey) throw new Error('Credenciales de Google no configuradas')

    privateKey = privateKey.replace(/\\n/g, '\n')

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = process.env.SPREADSHEET_REGISTROS_ID
    const sheetName = 'Datos registrados'
    
    // Fetch Programs from DB for mapping
    const programsFromDb = await prisma.program.findMany({
      select: { wpId: true, name: true, legacyId: true },
      orderBy: { abbreviation: 'asc' }
    })

    // Resolve Expanded IDs (WP ID + Legacy ID)
    let expandedPostIds = [...targetPostIds]
    if (targetPostIds.length > 0) {
      const selectedProgs = programsFromDb.filter(p => targetPostIds.includes(p.wpId))
      selectedProgs.forEach(p => {
        if (p.legacyId && !expandedPostIds.includes(p.legacyId)) {
          expandedPostIds.push(p.legacyId)
        }
      })
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z30000`, 
    })

    const allValues = response.data.values || []
    if (allValues.length < 1) {
      return { props: { submissions: [], programs: JSON.parse(JSON.stringify(programsFromDb)), totalInSheet: 0, query: context.query } }
    }

    const headers = allValues[0].map(h => String(h).trim().toLowerCase())
    const rows = allValues.slice(1)

    const getCol = (row: any[], name: string) => {
      const idx = headers.indexOf(name.toLowerCase())
      return idx !== -1 ? String(row[idx] || '').trim() : ''
    }

    const parseSheetDate = (dateStr: string) => {
      if (!dateStr) return null
      const parts = dateStr.split('/')
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      }
      return new Date(dateStr)
    }

    const submissions: LegacySubmission[] = rows.map((row) => ({
      email: getCol(row, 'Tu correo electrónico'),
      name: getCol(row, 'Nombre'),
      lastName: getCol(row, 'Apellido'),
      profession: getCol(row, 'Profesión'),
      offer: getCol(row, 'Oferta Consultada'),
      date: getCol(row, 'Día'),
      time: getCol(row, 'Hora'),
      country: getCol(row, 'País de residencia'),
      eduLevel: getCol(row, 'Nivel educativo'),
      postId: getCol(row, 'Post_ID')
    })).filter(s => {
      if (!s.email) return false
      
      const d = parseSheetDate(s.date)
      if (startDate && (!d || d < startDate)) return false
      if (endDate && (!d || d > endDate)) return false
      
      if (expandedPostIds.length > 0 && (!s.postId || !expandedPostIds.includes(s.postId))) return false
      
      if (searchTerm) {
        const fullText = `${s.name} ${s.lastName} ${s.email}`.toLowerCase()
        if (!fullText.includes(searchTerm)) return false
      }
      
      return true
    }).reverse()

    return {
      props: {
        submissions,
        programs: JSON.parse(JSON.stringify(programsFromDb)),
        totalInSheet: rows.length,
        query: context.query
      },
    }
  } catch (error: any) {
    console.error('Error fetching legacy submissions:', error)
    return {
      props: {
        submissions: [],
        programs: [],
        totalInSheet: 0,
        error: error.message,
        query: context.query
      },
    }
  }
}
