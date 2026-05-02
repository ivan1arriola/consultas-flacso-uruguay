import { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../src/lib/prisma'

const WP_API_URL = 'https://flacso.edu.uy/wp-json/flacso/v1/oferta-academica'

const ID_MAPPING: Record<string, string> = {
  "24160": "12330", // EDUTIC
  "24161": "12336", // MESYP
  "24162": "12343", // MG
  "24163": "12310", // EAPET
  "24164": "12316", // EGCCD
  "24165": "12278", // DEPPI
  "24166": "14444", // DESI
  "24167": "12282", // DEVBG
  "24168": "12288", // DEVNNA
  "24169": "13202", // DCCH
  "24170": "12295", // DAVIA
  "24171": "12299", // DG
  "24172": "20668", // IAPE
  "24173": "12302", // DIDYP
  "24174": "14657", // DSMSYT
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const response = await fetch(WP_API_URL)
    if (!response.ok) throw new Error(`WP API error: ${response.status}`)
    
    const wpPrograms = await response.json()
    let count = 0

    for (const wp of wpPrograms) {
      const wpId = String(wp.id)
      const legacyId = ID_MAPPING[wpId] || null

      await prisma.program.upsert({
        where: { wpId },
        update: {
          name: wp.titulo || 'Sin título',
          abbreviation: wp.abreviacion || null,
          email: wp.correo || null,
          legacyId,
          updatedAt: new Date()
        },
        create: {
          wpId,
          name: wp.titulo || 'Sin título',
          abbreviation: wp.abreviacion || null,
          email: wp.correo || null,
          legacyId
        }
      })
      count++
    }

    return res.status(200).json({ success: true, count, message: `${count} programas sincronizados correctamente.` })
  } catch (error: any) {
    console.error('Sync Error:', error)
    return res.status(500).json({ success: false, message: error.message || 'Error durante la sincronización' })
  }
}
