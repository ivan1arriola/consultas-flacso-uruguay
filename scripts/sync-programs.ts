import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
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

async function syncPrograms() {
  console.log('Iniciando sincronización de ofertas académicas con mapeo...')
  
  try {
    const response = await fetch(WP_API_URL)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    
    const wpPrograms = await response.json()
    console.log(`Recibidas ${wpPrograms.length} ofertas de WordPress.`)

    let upsertedCount = 0

    for (const wp of wpPrograms) {
      const wpId = String(wp.id)
      const name = wp.titulo || 'Sin título'
      const abbreviation = wp.abreviacion || null
      const email = wp.correo || null
      const legacyId = ID_MAPPING[wpId] || null

      await prisma.program.upsert({
        where: { wpId },
        update: {
          name,
          abbreviation,
          email,
          legacyId,
          updatedAt: new Date()
        },
        create: {
          wpId,
          name,
          abbreviation,
          email,
          legacyId
        }
      })
      upsertedCount++
    }

    console.log(`Sincronización completada. ${upsertedCount} programas procesados.`)
  } catch (error) {
    console.error('Error durante la sincronización:', error)
  } finally {
    await prisma.$disconnect()
  }
}

syncPrograms()
