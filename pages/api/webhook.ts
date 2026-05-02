import type { NextApiRequest, NextApiResponse } from 'next'
import { handleWebhook } from '../../src/server/handlers/webhook'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await handleWebhook(req.body)
    if (result && result.success) {
      return res.status(200).json(result)
    }
    return res.status(400).json(result)
  } catch (err: any) {
    console.error('Error en /api/webhook:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
}
