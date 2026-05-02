import { PrismaClient } from '@prisma/client'
import { google } from 'googleapis'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

async function migrateSheetToDb() {
  console.log('Iniciando migración de Spreadsheet a Base de Datos...')

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

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z30000`, 
    })

    const allValues = response.data.values || []
    if (allValues.length < 2) {
      console.log('No hay datos suficientes para migrar.')
      return
    }

    const headers = allValues[0].map((h: string) => h.trim().toLowerCase())
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

    // Optimization: Fetch all existing submissions first to check duplicates in memory
    console.log('Cargando registros existentes para evitar duplicados...')
    const existingSubmissions = await prisma.submission.findMany({
      select: { email: true, postTitle: true, createdAt: true }
    })
    const existingMap = new Set(
      existingSubmissions.map(s => {
        const dateStr = s.createdAt.toISOString().split('T')[0]
        const hourStr = s.createdAt.getHours().toString().padStart(2, '0') + ':' + s.createdAt.getMinutes().toString().padStart(2, '0')
        return `${s.email.toLowerCase()}|${s.postTitle}|${dateStr}|${hourStr}`
      })
    )

    let count = 0
    let skipped = 0
    const toCreate = []

    for (const row of rows) {
      const email = getCol(row, 'Tu correo electrónico').toLowerCase().trim()
      if (!email) continue

      const day = getCol(row, 'Día')
      const hour = getCol(row, 'Hora')
      const createdAt = parseDateTime(day, hour)
      const postId = getCol(row, 'Post_ID')

      const dateKey = createdAt.toISOString().split('T')[0]
      const hourKey = createdAt.getHours().toString().padStart(2, '0') + ':' + createdAt.getMinutes().toString().padStart(2, '0')
      const offer = getCol(row, 'Oferta Consultada')
      const key = `${email}|${offer}|${dateKey}|${hourKey}`

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
        meta: 'Migrado de Spreadsheet'
      })
      
      // Add to set to avoid duplicates within the spreadsheet itself
      existingMap.add(key)
      
      if (toCreate.length >= 100) {
        await prisma.submission.createMany({ data: toCreate })
        count += toCreate.length
        console.log(`Procesados ${count} registros...`)
        toCreate.length = 0
      }
    }

    if (toCreate.length > 0) {
      await prisma.submission.createMany({ data: toCreate })
      count += toCreate.length
    }

    console.log(`Migración completada.`)
    console.log(`Insertados: ${count}`)
    console.log(`Omitidos (duplicados): ${skipped}`)

  } catch (error) {
    console.error('Error durante la migración:', error)
  } finally {
    await prisma.$disconnect()
  }
}

migrateSheetToDb()
