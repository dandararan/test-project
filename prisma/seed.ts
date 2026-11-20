import { PrismaClient } from '../src/generated/prisma/client.js'
import { getDatabaseUrl } from '../src/database-url.js'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) })

async function main() {
  const types = [
    { id: 'initial-consultation', title: 'Initial consultation', description: 'A first conversation to understand your goals and how we can help.', duration: 30 },
    { id: 'talent-discussion', title: 'Talent discussion', description: 'Explore the right people and possibilities for your team.', duration: 30 },
    { id: 'career-consultation', title: 'Career consultation', description: 'Talk through your next move with a people-first advisor.', duration: 45 },
    { id: 'general-inquiry', title: 'General inquiry', description: 'A quick conversation to get the right answer.', duration: 15 },
  ].map((type) => ({ ...type, bufferMinutes: null }))
  for (const type of types) await prisma.appointmentType.upsert({ where: { id: type.id }, create: type, update: {} })
  const periods = [{ start: 540, end: 720 }, { start: 780, end: 1020 }]
  for (let weekday = 0; weekday < 7; weekday++) await prisma.workingDay.upsert({ where: { weekday }, create: { id: `weekday-${weekday}`, weekday, enabled: weekday > 0 && weekday < 6, periods }, update: {} })
  await prisma.schedulingSettings.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {} })
}

main().finally(() => prisma.$disconnect())
