import Head from 'next/head'
import Link from 'next/link'
import prisma from '../../src/lib/prisma'
import { GetServerSideProps } from 'next'
import { useState } from 'react'
import { useRouter } from 'next/router'

interface Program {
  wpId: string
  name: string
  legacyId: string | null
}

interface Submission {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  postTitle: string | null
  createdAt: string
  profession: string | null
  country: string | null
  educationLevel?: string | null
  postId: string | null
}

interface Props {
  submissions: Submission[]
  programs: Program[]
  totalCount: number
  query: {
    start?: string
    end?: string
    search?: string
    postIds?: string
  }
}

export default function SubmissionsPage({ submissions, programs, totalCount, query }: Props) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [isExporting, setIsExporting] = useState(false)
  
  const [startDate, setStartDate] = useState(query.start || '')
  const [endDate, setEndDate] = useState(query.end || '')
  const [search, setSearch] = useState(query.search || '')
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>(query.postIds ? query.postIds.split(',') : [])

  const toggleSelectAll = () => {
    if (selectedIds.length === submissions.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(submissions.map(s => s.id))
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleFilter = () => {
    router.push({
      pathname: '/admin/submissions',
      query: {
        start: startDate,
        end: endDate,
        search: search,
        postIds: selectedPrograms.join(',')
      }
    })
  }

  const handleExport = async () => {
    if (selectedIds.length === 0) return
    setIsExporting(true)
    
    try {
      const selectedData = submissions.filter(s => selectedIds.includes(s.id))
      const response = await fetch('/api/admin/export-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: selectedData,
          fileName: `Exportación Consultas (${selectedIds.length}) - ${new Date().toLocaleDateString()}`
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

  const handleDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`¿Estás seguro de que quieres eliminar definitivamente ${selectedIds.length} registros? Esta acción no se puede deshacer.`)) return
    
    try {
      const response = await fetch('/api/admin/delete-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      })

      const result = await response.json()
      if (result.success) {
        alert(result.message)
        setSelectedIds([])
        router.reload()
      } else {
        alert('Error: ' + result.message)
      }
    } catch (error) {
      alert('Error al eliminar registros')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Administración - Consultas</title>
      </Head>
      
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Panel de Consultas</h1>
            <p className="text-sm text-gray-600 mt-1">
              Mostrando {submissions.length} de {totalCount} registros encontrados
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/analytics" className="px-3 py-1.5 text-sm font-medium bg-white text-green-600 border border-green-200 rounded-lg hover:bg-green-50">
              📊 Ver Gráficos
            </Link>
            <Link href="/" className="px-3 py-1.5 text-sm font-medium bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              🏠 Inicio
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-gray-400">Rango de fechas</label>
            <div className="flex gap-2">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500" 
              />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500" 
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
              className="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500" 
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase text-gray-400">Filtrar por Programa</label>
              <button 
                onClick={() => {
                  if (selectedPrograms.length === programs.length) setSelectedPrograms([])
                  else setSelectedPrograms(programs.map(p => p.wpId))
                }}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-500 uppercase"
              >
                {selectedPrograms.length === programs.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
            </div>
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
                    className="rounded text-blue-600 h-3 w-3" 
                  />
                  <span className="text-gray-700 truncate">{p.name}</span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 text-right">{selectedPrograms.length} seleccionadas</p>
          </div>

          <div className="flex items-end">
            <button 
              onClick={handleFilter}
              className="w-full py-2 bg-blue-600 text-white text-sm font-bold rounded-lg shadow hover:bg-blue-700 transition-colors"
            >
              🔍 Aplicar Filtros
            </button>
          </div>
        </div>

        {/* Selection Actions */}
        {selectedIds.length > 0 && (
          <div className="mb-4 bg-blue-600 p-4 rounded-lg shadow-lg flex justify-between items-center animate-in fade-in slide-in-from-top-2">
            <div className="text-sm text-white font-medium">
              {selectedIds.length} registros seleccionados
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-lg shadow hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                🗑️ Eliminar Seleccionados
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-2 bg-white text-blue-600 text-sm font-bold rounded-lg shadow hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                {isExporting ? 'Exportando...' : 'Exportar a Drive →'}
              </button>
            </div>
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
                      className="rounded border-gray-300 text-blue-600 h-4 w-4"
                      checked={selectedIds.length === submissions.length && submissions.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Programa</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">País / Nivel</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Profesión</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">
                      No se encontraron resultados con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub) => (
                    <tr key={sub.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.includes(sub.id) ? 'bg-blue-50/50' : ''}`}>
                      <td className="px-4 py-4 text-left">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-blue-600 h-4 w-4"
                          checked={selectedIds.includes(sub.id)}
                          onChange={() => toggleSelect(sub.id)}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="font-medium text-gray-900">{new Date(sub.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs">{new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">
                          {sub.firstName || ''} {sub.lastName || ''}
                          {(!sub.firstName && !sub.lastName) && <span className="text-gray-400 font-normal italic">Sin nombre</span>}
                        </div>
                        <div className="text-xs text-blue-500">{sub.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-gray-700 max-w-xs leading-tight">
                          {sub.postTitle || <span className="text-gray-400">ID: {sub.postId || 'N/A'}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-gray-600">{sub.country || 'N/A'}</span>
                          <span className="text-[10px] text-gray-400">{sub.educationLevel || ''}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 italic">
                        {sub.profession || 'N/A'}
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
    const programs = await prisma.program.findMany({
      select: { wpId: true, name: true, legacyId: true },
      orderBy: { abbreviation: 'asc' }
    })

    // Resolve Expanded IDs (WP ID + Legacy ID)
    let expandedPostIds = [...targetPostIds]
    if (targetPostIds.length > 0) {
      const selectedProgs = programs.filter(p => targetPostIds.includes(p.wpId))
      selectedProgs.forEach(p => {
        if (p.legacyId && !expandedPostIds.includes(p.legacyId)) {
          expandedPostIds.push(p.legacyId)
        }
      })
    }

    const where = {
      AND: [
        ...(startDate ? [{ createdAt: { gte: startDate } }] : []),
        ...(endDate ? [{ createdAt: { lte: endDate } }] : []),
        ...(expandedPostIds.length > 0 ? [{ postId: { in: expandedPostIds } }] : []),
        ...(searchTerm ? [
          {
            OR: [
              { email: { contains: searchTerm, mode: 'insensitive' as any } },
              { firstName: { contains: searchTerm, mode: 'insensitive' as any } },
              { lastName: { contains: searchTerm, mode: 'insensitive' as any } },
            ]
          }
        ] : []),
      ]
    }

    const totalCount = await prisma.submission.count({ where })

    const submissions = await prisma.submission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200, // Limitamos a 200 para el panel interactivo
    })

    return {
      props: {
        submissions: JSON.parse(JSON.stringify(submissions)),
        programs: JSON.parse(JSON.stringify(programs)),
        totalCount,
        query: context.query
      },
    }
  } catch (error) {
    console.error('Error fetching submissions:', error)
    return {
      props: {
        submissions: [],
        programs: [],
        query: {}
      },
    }
  }
}
