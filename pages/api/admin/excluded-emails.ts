import { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../src/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      try {
        const emails = await prisma.excludedEmail.findMany({
          orderBy: { createdAt: 'desc' }
        })
        return res.status(200).json(emails)
      } catch (error: any) {
        return res.status(500).json({ message: error.message })
      }

    case 'POST':
      try {
        const { email, reason } = req.body
        if (!email) return res.status(400).json({ message: 'Email es requerido' })
        
        // Normalización básica antes de guardar
        const normalizedEmail = email.trim().toLowerCase()

        const newEmail = await prisma.excludedEmail.create({
          data: { email: normalizedEmail, reason }
        })
        return res.status(201).json(newEmail)
      } catch (error: any) {
        if (error.code === 'P2002') {
          return res.status(400).json({ message: 'El correo ya está en la lista' })
        }
        return res.status(500).json({ message: error.message })
      }

    case 'DELETE':
      try {
        const { id } = req.query
        if (!id) return res.status(400).json({ message: 'ID es requerido' })
        
        await prisma.excludedEmail.delete({
          where: { id: parseInt(id as string) }
        })
        return res.status(200).json({ success: true })
      } catch (error: any) {
        return res.status(500).json({ message: error.message })
      }

    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
      return res.status(405).end(`Method ${method} Not Allowed`)
  }
}
