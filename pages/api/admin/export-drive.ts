import { NextApiRequest, NextApiResponse } from 'next'
import { google } from 'googleapis'
import prisma from '../../../src/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { startDate: start, endDate: end, postIds, fileName } = req.body

  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
    let privateKey = process.env.GOOGLE_PRIVATE_KEY
    privateKey = privateKey?.replace(/\\n/g, '\n')

    if (!clientEmail || !privateKey) {
      throw new Error('Google credentials not configured')
    }

    // 1. Fetch and Merge data (Server-side)
    const startDate = start ? new Date(start) : null
    const endDate = end ? new Date(end) : null
    if (endDate) endDate.setHours(23, 59, 59, 999)
    const targetPostIds = postIds && Array.isArray(postIds) ? postIds : []

    // Resolve Expanded IDs (WP ID + Legacy ID)
    const programs = await prisma.program.findMany({
      select: { wpId: true, legacyId: true }
    })
    
    let expandedPostIds = [...targetPostIds]
    if (targetPostIds.length > 0) {
      const selectedPrograms = programs.filter(p => targetPostIds.includes(p.wpId))
      selectedPrograms.forEach(p => {
        if (p.legacyId && !expandedPostIds.includes(p.legacyId)) {
          expandedPostIds.push(p.legacyId)
        }
      })
    }

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
      }
    })

    // 2. Normalize data
    const normalizedData = dbSubmissions.map(s => ({
      email: s.email.toLowerCase().trim(),
      name: s.firstName || '',
      lastName: s.lastName || '',
      offer: s.postTitle || '',
      country: s.country || '',
      date: new Date(s.createdAt),
      profession: s.profession || '',
      postId: s.postId
    }))

    // 3. Filter (Exclude internal emails)
    const filteredData = normalizedData.filter(d => {
      if (!d.email || d.email.includes('flacso.edu.uy') || ['ivan.arriola.t@gmail.com', 'francolaviano@gmail.com'].includes(d.email)) return false
      return true
    })

    // Setup Google API for Export (Drive only)
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const drive = google.drive({ version: 'v3', auth })

    const deduplicated = new Map()
    filteredData.forEach(item => {
      const key = `${item.email}|${item.offer}`
      if (!deduplicated.has(key)) deduplicated.set(key, item)
    })

    const finalRecords = Array.from(deduplicated.values())

    // 2. Create Spreadsheet
    const title = fileName || `Exportación Filtrada - ${new Date().toLocaleDateString()}`
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: { properties: { title } },
    })

    const spreadsheetId = spreadsheet.data.spreadsheetId
    if (!spreadsheetId) throw new Error('Failed to create spreadsheet')

    const values = [
      ['Email', 'Nombre', 'Apellido', 'Oferta Consultada', 'País', 'Fecha', 'Profesión'],
      ...finalRecords.map(item => [
        item.email,
        item.name,
        item.lastName,
        item.offer,
        item.country,
        item.date ? item.date.toLocaleDateString() : '',
        item.profession
      ])
    ]

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      requestBody: { values },
    })

    if (folderId) {
      const file = await drive.files.get({ fileId: spreadsheetId, fields: 'parents' })
      const previousParents = file.data.parents?.join(',')
      await drive.files.update({
        fileId: spreadsheetId,
        addParents: folderId,
        removeParents: previousParents,
      })
    }

    const fileUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`

    return res.status(200).json({ 
      success: true, 
      url: fileUrl,
      message: `Exportado exitosamente (${finalRecords.length} registros).`
    })

  } catch (error: any) {
    console.error('Export Error:', error)
    return res.status(500).json({ success: false, message: error.message || 'Error durante la exportación' })
  }
}
