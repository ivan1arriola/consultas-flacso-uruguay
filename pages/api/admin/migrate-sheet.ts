import { NextApiRequest, NextApiResponse } from 'next'
import { google } from 'googleapis'
import prisma from '../../../src/lib/prisma'

function normalizeEmailLegacy(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[,;]+/g, '')
    .replace(/\s+/g, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { forceReset } = req.body

  try {
    console.log('Iniciando migración desde API...')

    if (forceReset) {
      console.log('Borrando base de datos por solicitud forceReset...')
      await prisma.submission.deleteMany({})
    }
    
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
    let privateKey = process.env.GOOGLE_PRIVATE_KEY
    if (privateKey) privateKey = privateKey.replace(/\\n/g, '\n')

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = process.env.SPREADSHEET_REGISTROS_ID
    const sheetName = 'Datos registrados'

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z30000`, 
    })

    const allValues = response.data.values || []
    if (allValues.length < 2) {
      return res.status(200).json({ success: true, count: 0, message: 'No hay datos para migrar.' })
    }

    const headers = allValues[0].map((h: any) => String(h).trim().toLowerCase())
    const rows = allValues.slice(1)

    const getCol = (row: any[], name: string) => {
      const idx = headers.indexOf(name.toLowerCase())
      return idx !== -1 ? String(row[idx] || '').trim() : ''
    }

    const parseDateTime = (dayStr: string, hourStr: string) => {
      if (!dayStr) return new Date()
      const dayParts = dayStr.split('/')
      let date: Date
      if (dayParts.length === 3) {
        date = new Date(parseInt(dayParts[2]), parseInt(dayParts[1]) - 1, parseInt(dayParts[0]))
      } else {
        date = new Date(dayStr)
      }
      if (hourStr && hourStr.includes(':')) {
        const hourParts = hourStr.split(':')
        date.setHours(parseInt(hourParts[0]), parseInt(hourParts[1]), 0, 0)
      }
      return date
    }

    // Optimization: Fetch all existing submissions once (if not reset)
    const existingSubmissions = forceReset ? [] : await prisma.submission.findMany({
      select: { email: true, postTitle: true, createdAt: true }
    })
    
    const existingMap = new Set(
      existingSubmissions.map(s => {
        const dateStr = s.createdAt.toISOString().split('T')[0]
        const hourStr = s.createdAt.getHours().toString().padStart(2, '0') + ':' + s.createdAt.getMinutes().toString().padStart(2, '0')
        return `${normalizeEmailLegacy(s.email)}|${s.postTitle}|${dateStr}|${hourKey(s.createdAt)}`
      })
    )

    function hourKey(date: Date) {
      return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0')
    }

    let count = 0
    let skipped = 0
    const toCreate = []

    for (const row of rows) {
      const emailRaw = getCol(row, 'Tu correo electrónico')
      const email = normalizeEmailLegacy(emailRaw)
      if (!email) continue

      const day = getCol(row, 'Día')
      const hour = getCol(row, 'Hora')
      const createdAt = parseDateTime(day, hour)
      const postId = getCol(row, 'Post_ID')

      const dateStr = createdAt.toISOString().split('T')[0]
      const hKey = hourKey(createdAt)
      const offer = getCol(row, 'Oferta Consultada')
      const key = `${email}|${offer}|${dateStr}|${hKey}`

      if (existingMap.has(key)) {
        skipped++
        continue
      }

      toCreate.push({
        email,
        firstName: getCol(row, 'Nombre'),
        lastName: getCol(row, 'Apellido'),
        profession: getCol(row, 'Profesión'),
        postTitle: getCol(row, 'Oferta Consultada'),
        country: getCol(row, 'País de residencia'),
        educationLevel: getCol(row, 'Nivel educativo'),
        postId,
        createdAt: new Date(createdAt),
        meta: 'Migrado de Spreadsheet (Re-formateado)'
      })
      
      existingMap.add(key)
      
      if (toCreate.length >= 200) {
        await prisma.submission.createMany({ data: toCreate })
        count += toCreate.length
        toCreate.length = 0
      }
    }

    if (toCreate.length > 0) {
      await prisma.submission.createMany({ data: toCreate })
      count += toCreate.length
    }

    return res.status(200).json({ 
      success: true, 
      count, 
      skipped, 
      message: `Migración completada. ${count} registros insertados, ${skipped} omitidos.` 
    })

  } catch (error: any) {
    console.error('Migration Error:', error)
    return res.status(500).json({ success: false, message: error.message || 'Error durante la migración' })
  }
}
