import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Placeholder: in producción este servicio usará Google Sheets API.
// Por ahora ofrece helpers que persisten metadatos en Postgres.

export async function recordSubmission(data: { name?: string; email?: string; raw?: any }) {
  const res = await prisma.program.create({
    data: { name: data.name || 'submission' },
  })
  return res
}

export default { recordSubmission }
