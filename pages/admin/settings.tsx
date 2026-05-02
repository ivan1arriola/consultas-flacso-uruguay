import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { GetServerSideProps } from 'next'
import prisma from '../../src/lib/prisma'

interface Props {
  stats: {
    totalSubmissions: number
    totalPrograms: number
    lastSubmissionDate: string | null
  }
  config: {
    serviceEmail: string
    registrosSheetId: string
    driveFolderId: string
  }
  initialExcludedEmails: any[]
}

export default function SettingsPage({ stats, config, initialExcludedEmails }: Props) {
  const [excludedEmails, setExcludedEmails] = useState(initialExcludedEmails)
  const [newEmail, setNewEmail] = useState('')
  const [newReason, setNewReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<{ 
    loading: boolean, 
    status: 'ok' | 'error' | null, 
    message: string,
    folderName?: string,
    spreadsheetName?: string
  }>({
    loading: false,
    status: null,
    message: ''
  })

  const rules = [
    { id: 1, text: 'Solo se consideran filas dentro del rango seleccionado.' },
    { id: 2, text: 'Se excluyen filas sin correo, correos internos @flacso.edu.uy y correos de prueba conocidos.' },
    { id: 3, text: 'Se excluyen filas sin oferta consultada.' },
    { id: 4, text: 'Se excluyen filas sin país de residencia.' },
    { id: 5, text: 'Uruguay se identifica por Uruguay, UY o URU; el resto va a exterior.' },
    { id: 6, text: 'La consulta única se deduplica por correo + oferta.' },
    { id: 7, text: 'Si una misma consulta cambia de país, se usa la fila más reciente.' },
  ]

  const checkPermissions = async () => {
    setPermissionStatus({ loading: true, status: null, message: 'Verificando...' })
    try {
      const res = await fetch('/api/admin/check-permissions')
      const data = await res.json()
      if (data.success) {
        setPermissionStatus({ 
          loading: false, 
          status: 'ok', 
          message: data.message,
          folderName: data.folderName,
          spreadsheetName: data.spreadsheetName
        })
      } else {
        setPermissionStatus({ loading: false, status: 'error', message: data.message || 'Error de permisos' })
      }
    } catch (err) {
      setPermissionStatus({ loading: false, status: 'error', message: 'No se pudo conectar con la API.' })
    }
  }

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/excluded-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, reason: newReason })
      })
      if (!res.ok) throw new Error('Error al agregar email')
      const data = await res.json()
      setExcludedEmails([data, ...excludedEmails])
      setNewEmail('')
      setNewReason('')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteEmail = async (id: number) => {
    if (!confirm('¿Seguro que quieres eliminar este correo de la lista?')) return
    try {
      const res = await fetch(`/api/admin/excluded-emails?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar email')
      setExcludedEmails(excludedEmails.filter(e => e.id !== id))
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Configuración - Sistema Analytics</title>
      </Head>

      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configuración del Sistema</h1>
            <p className="text-gray-600 mt-2">Parámetros técnicos y criterios de analítica</p>
          </div>
          <Link href="/admin/analytics" className="px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
            ← Volver al Panel
          </Link>
        </div>

        <div className="space-y-8">
          {/* Rules Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-blue-600 px-6 py-4">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                📜 Criterios de Cálculo (Las 7 Reglas)
              </h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-6 italic">
                Estos criterios garantizan que los reportes de Postgres coincidan exactamente con los reportes históricos de Google Sheets.
              </p>
              <div className="space-y-4">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border-l-4 border-blue-100">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                      {rule.id}
                    </span>
                    <p className="text-sm text-gray-700 leading-relaxed">{rule.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Excluded Emails Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-900 px-6 py-4">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                🚫 Correos de Prueba Excluidos
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Añadir nuevo correo</h3>
                  <form onSubmit={handleAddEmail} className="space-y-3">
                    <input 
                      type="email" 
                      placeholder="correo@ejemplo.com"
                      className="w-full text-sm border-gray-200 rounded-lg"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="Razón (ej: Desarrollador)"
                      className="w-full text-sm border-gray-200 rounded-lg"
                      value={newReason}
                      onChange={e => setNewReason(e.target.value)}
                    />
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors disabled:bg-gray-300"
                    >
                      {isSubmitting ? 'Añadiendo...' : 'Añadir a la lista'}
                    </button>
                  </form>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Correos actuales</h3>
                  <div className="max-h-[250px] overflow-y-auto border border-gray-100 rounded-xl bg-gray-50 p-2 space-y-2">
                    {excludedEmails.map((e) => (
                      <div key={e.id} className="bg-white p-3 rounded-lg border border-gray-100 flex justify-between items-center group">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{e.email}</p>
                          {e.reason && <p className="text-[10px] text-gray-500 uppercase font-bold">{e.reason}</p>}
                        </div>
                        <button 
                          onClick={() => handleDeleteEmail(e.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    {excludedEmails.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4 italic">No hay correos excluidos.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* System Info */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-gray-900 font-bold mb-4 flex items-center gap-2">
                ⚙️ Información de Google Cloud
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400">Correo de Servicio</label>
                  <p className="text-xs font-mono bg-gray-50 p-2 rounded mt-1 border border-gray-100 break-all">
                    {config.serviceEmail}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 flex justify-between items-center">
                    <span>ID Spreadsheet (Registros)</span>
                    {permissionStatus.spreadsheetName && <span className="text-blue-600 normal-case italic">{permissionStatus.spreadsheetName}</span>}
                  </label>
                  <p className="text-xs font-mono bg-gray-50 p-2 rounded mt-1 border border-gray-100 break-all">
                    {config.registrosSheetId}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 flex justify-between items-center">
                    <span>Carpeta Google Drive (Exportaciones)</span>
                    {permissionStatus.folderName && <span className="text-blue-600 normal-case italic">{permissionStatus.folderName}</span>}
                  </label>
                  <p className="text-xs font-mono bg-gray-50 p-2 rounded mt-1 border border-gray-100 break-all">
                    {config.driveFolderId}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-50">
                  <button 
                    onClick={checkPermissions}
                    disabled={permissionStatus.loading}
                    className={`w-full py-2 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      permissionStatus.status === 'ok' ? 'bg-green-100 text-green-700' :
                      permissionStatus.status === 'error' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {permissionStatus.loading ? '⏳ Verificando...' : '🔍 Verificar Acceso Drive'}
                  </button>
                  {permissionStatus.message && (
                    <p className={`mt-2 text-xs font-medium text-center ${
                      permissionStatus.status === 'ok' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {permissionStatus.message}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Database Stats */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-gray-900 font-bold mb-4 flex items-center gap-2">
                🗄️ Estado de la Base de Datos
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">Consultas en DB</span>
                  <span className="text-sm font-bold text-blue-600">{stats.totalSubmissions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">Ofertas Académicas</span>
                  <span className="text-sm font-bold text-purple-600">{stats.totalPrograms}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">Último registro</span>
                  <span className="text-xs text-gray-500 font-medium">
                    {stats.lastSubmissionDate ? new Date(stats.lastSubmissionDate).toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-100 flex items-center gap-2 text-green-700 text-xs font-medium">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Conexión PostgreSQL Activa
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async () => {
  const [totalSubmissions, totalPrograms, lastSubmission, excludedEmails] = await Promise.all([
    prisma.submission.count(),
    prisma.program.count(),
    prisma.submission.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.excludedEmail.findMany({ orderBy: { createdAt: 'desc' } })
  ])

  return {
    props: {
      stats: {
        totalSubmissions,
        totalPrograms,
        lastSubmissionDate: lastSubmission?.createdAt?.toISOString() || null
      },
      config: {
        serviceEmail: process.env.GOOGLE_CLIENT_EMAIL || 'No configurado',
        registrosSheetId: process.env.SPREADSHEET_REGISTROS_ID || 'No configurado',
        driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || 'No configurado',
      },
      initialExcludedEmails: JSON.parse(JSON.stringify(excludedEmails))
    }
  }
}
