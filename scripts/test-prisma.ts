import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function test() {
  try {
    const programs = await prisma.program.findMany({
      select: { wpId: true, legacyId: true }
    })
    console.log('Query exitosa. Programas encontrados:', programs.length)
    if (programs.length > 0) {
      console.log('Primer programa legacyId:', programs[0].legacyId)
    }
  } catch (err) {
    console.error('Error en la query:', err)
  } finally {
    await prisma.$disconnect()
  }
}

test()
