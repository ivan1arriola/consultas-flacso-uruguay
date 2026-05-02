import type { NextApiRequest, NextApiResponse } from 'next'
import { handleFormSubmission } from '../../src/server/handlers/formSubmission'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await handleFormSubmission(req.body)
    if (result && result.success) {
      return res.status(200).json(result)
    }
    return res.status(400).json(result)
  } catch (err: any) {
    console.error('Error en /api/submit:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
}
