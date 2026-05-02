import { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../src/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { ids } = req.body

  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ message: 'IDs invalidos' })
  }

  try {
    const result = await prisma.submission.deleteMany({
      where: {
        id: { in: ids }
      }
    })

    return res.status(200).json({ 
      success: true, 
      count: result.count,
      message: `${result.count} registros eliminados correctamente.` 
    })
  } catch (error: any) {
    console.error('Delete Error:', error)
    return res.status(500).json({ success: false, message: error.message || 'Error al eliminar registros' })
  }
}
