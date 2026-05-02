import { NextApiRequest, NextApiResponse } from 'next'
import { google } from 'googleapis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
    let privateKey = process.env.GOOGLE_PRIVATE_KEY
    if (privateKey) privateKey = privateKey.replace(/\\n/g, '\n')
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    const registrosId = process.env.SPREADSHEET_REGISTROS_ID

    if (!clientEmail || !privateKey || !folderId || !registrosId) {
      return res.status(400).json({ success: false, message: 'Faltan variables de entorno (Email, Key, Folder o Sheet ID)' })
    }

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.metadata.readonly'],
    })

    const drive = google.drive({ version: 'v3', auth })

    // 1. Verificar Carpeta de Drive
    const folder = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, capabilities'
    })

    // 2. Verificar Spreadsheet de Registros
    const spreadsheet = await drive.files.get({
      fileId: registrosId,
      fields: 'id, name'
    })

    const canAddChildren = folder.data.capabilities?.canAddChildren

    return res.status(200).json({ 
      success: true, 
      folderName: folder.data.name,
      spreadsheetName: spreadsheet.data.name,
      canWrite: !!canAddChildren,
      message: canAddChildren 
        ? `Acceso total verificado.` 
        : `Acceso de lectura confirmado, pero NO tiene permisos de escritura en la carpeta.`
    })

  } catch (error: any) {
    console.error('Permission Check Error:', error)
    return res.status(500).json({ 
      success: false, 
      message: `Error de Google Drive: ${error.message}` 
    })
  }
}
