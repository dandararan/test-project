import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { prisma } from '#/db'
import { auth } from '#/lib/auth'

const times = Array.from({ length: 14 }, (_, index) => { const minute = 9 * 60 + index * 30 + (index >= 6 ? 60 : 0); const hour24 = Math.floor(minute / 60); const hour = hour24 % 12 || 12; return `${hour}:${String(minute % 60).padStart(2, '0')} ${hour24 >= 12 ? 'PM' : 'AM'}` })
const pad = (value: number) => String(value).padStart(2, '0')
const minutes = (time: string) => {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(time)
  if (!match) return -1
  let hour = Number(match[1]) % 12
  if (match[3] === 'PM') hour += 12
  return hour * 60 + Number(match[2])
}
const conflicts = (start: number, duration: number, buffer: number, booking: { startMinute: number; duration: number }, bookingBuffer: number) => {
  const end = start + duration
  const bookingEnd = booking.startMinute + booking.duration
  if (end <= booking.startMinute) return end + buffer > booking.startMinute
  if (start >= bookingEnd) return start < bookingEnd + bookingBuffer
  return true
}
const localDate = (instant: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant)
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`
}
const addCalendarDays = (date: string, offset: number) => {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + offset)
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
}
const isValidDateLabel = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}
const localMinute = (instant: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant)
  return Number(parts.find((part) => part.type === 'hour')?.value) * 60 + Number(parts.find((part) => part.type === 'minute')?.value)
}
const zonedDateTimeToUtc = (date: string, time: string, timezone: string) => {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const guess = new Date(Date.UTC(year!, month! - 1, day!, hour!, minute!))
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(guess)
  const localAsUtc = Date.UTC(Number(parts.find((part) => part.type === 'year')?.value), Number(parts.find((part) => part.type === 'month')?.value) - 1, Number(parts.find((part) => part.type === 'day')?.value), Number(parts.find((part) => part.type === 'hour')?.value), Number(parts.find((part) => part.type === 'minute')?.value))
  return new Date(guess.getTime() + Date.UTC(year!, month! - 1, day!, hour!, minute!) - localAsUtc)
}

let initialization: Promise<void> | undefined
async function initialize() {
  if (!initialization) initialization = prisma.$transaction(async (tx) => {
    await tx.appointmentType.createMany({ skipDuplicates: true, data: [
      { id: 'initial-consultation', title: 'Initial consultation', description: 'A first conversation to understand your goals and how we can help.', duration: 30 },
      { id: 'talent-discussion', title: 'Talent discussion', description: 'Explore the right people and possibilities for your team.', duration: 30 },
      { id: 'career-consultation', title: 'Career consultation', description: 'Talk through your next move with a people-first advisor.', duration: 45 },
      { id: 'general-inquiry', title: 'General inquiry', description: 'A quick conversation to get the right answer.', duration: 15 },
    ] })
    await tx.workingDay.createMany({ skipDuplicates: true, data: Array.from({ length: 7 }, (_, weekday) => ({ id: `weekday-${weekday}`, weekday, enabled: weekday > 0 && weekday < 6, periods: [{ start: 540, end: 720 }, { start: 780, end: 1020 }] })) })
    await tx.schedulingSettings.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {} })
  }).then(() => undefined)
  try { await initialization } catch (error) { initialization = undefined; throw error }
}

async function assertAdmin() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!session?.user || !adminEmail || session.user.email.toLowerCase() !== adminEmail) throw new Error('Administrator access required')
  return session.user
}

export const getAdminProfile = createServerFn().handler(async () => {
  const sessionUser = await assertAdmin()
  return prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id }, select: { id: true, name: true, email: true, createdAt: true } })
})

export const updateAdminProfile = createServerFn({ method: 'POST' }).validator(z.object({ name: z.string().trim().min(2).max(120) })).handler(async ({ data }) => {
  const sessionUser = await assertAdmin()
  return prisma.user.update({ where: { id: sessionUser.id }, data: { name: data.name }, select: { id: true, name: true, email: true, createdAt: true } })
})

export const getPublicSchedule = createServerFn().handler(async () => {
  await initialize()
  const [types, settings] = await Promise.all([
    prisma.appointmentType.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.schedulingSettings.findUnique({ where: { id: 'default' } }),
  ])
  return { types, settings: { timezone: settings?.timezone ?? 'Asia/Manila', bufferMinutes: settings?.bufferMinutes ?? 10, minimumNoticeHour: settings?.minimumNoticeHour ?? 3, bookingWindowDays: settings?.bookingWindowDays ?? 60 } }
})

type ScheduleType = { id: string; active: boolean; duration: number; maxBookingDays: number | null; dailyLimit: number | null; bufferMinutes: number | null }
type ScheduleRules = { timezone: string; bookingWindowDays: number; minimumNoticeHour: number; dailyLimit: number; bufferMinutes: number } | null
type ScheduleDay = { enabled: boolean; periods: unknown } | null
type ScheduleException = { blocked: boolean; periods: unknown | null } | null
function calculateAvailableTimes(date: string, type: ScheduleType, day: ScheduleDay, exception: ScheduleException, settings: ScheduleRules, bookings: { reference: string; typeId: string; startMinute: number; duration: number }[], bufferByType: Map<string, number>, excludeReference?: string, now = new Date()) {
  if (!type.active || exception?.blocked || (!exception && !day?.enabled)) return []
  const timezone = settings?.timezone ?? 'Asia/Manila'
  const today = localDate(now, timezone)
  const daysOut = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000
  if (daysOut < 0 || daysOut > (type.maxBookingDays ?? settings?.bookingWindowDays ?? 60)) return []
  const occupied = bookings.filter((booking) => booking.reference !== excludeReference)
  const countForLimit = type.dailyLimit == null ? occupied.length : occupied.filter((booking) => booking.typeId === type.id).length
  if (countForLimit >= (type.dailyLimit ?? settings?.dailyLimit ?? 10)) return []
  const workPeriods = exception && exception.periods !== null ? exception.periods as { start: number; end: number }[] : day?.periods as { start: number; end: number }[] ?? []
  if (!workPeriods.length) return []
  const buffer = type.bufferMinutes ?? settings?.bufferMinutes ?? 10
  return times.filter((time) => {
    const start = minutes(time)
    if (!workPeriods.some((period) => start >= period.start && start + type.duration <= period.end)) return false
    if (date === today && start < localMinute(now, timezone) + (settings?.minimumNoticeHour ?? 3) * 60) return false
    return !occupied.some((booking) => conflicts(start, type.duration, buffer, booking, bufferByType.get(booking.typeId) ?? settings?.bufferMinutes ?? 10))
  })
}

export const getAvailableTimes = createServerFn().validator(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), typeId: z.string().min(1), excludeReference: z.string().optional() })).handler(async ({ data }) => {
  await initialize()
  const weekday = new Date(`${data.date}T12:00:00Z`).getUTCDay()
  const [day, exception, type, settings, bookings] = await Promise.all([
    prisma.workingDay.findUnique({ where: { weekday }, select: { enabled: true, periods: true } }),
    prisma.availabilityException.findUnique({ where: { date: data.date }, select: { blocked: true, periods: true } }),
    prisma.appointmentType.findUnique({ where: { id: data.typeId }, select: { id: true, active: true, duration: true, maxBookingDays: true, dailyLimit: true, bufferMinutes: true } }),
    prisma.schedulingSettings.findUnique({ where: { id: 'default' }, select: { timezone: true, bookingWindowDays: true, minimumNoticeHour: true, dailyLimit: true, bufferMinutes: true } }),
    prisma.booking.findMany({ where: { date: data.date, status: 'CONFIRMED' }, select: { reference: true, typeId: true, startMinute: true, duration: true } }),
  ])
  if (!type) return []
  const existingTypes = await prisma.appointmentType.findMany({ where: { id: { in: [...new Set(bookings.map((booking) => booking.typeId))] } }, select: { id: true, bufferMinutes: true } })
  const bufferByType = new Map(existingTypes.map((item) => [item.id, item.bufferMinutes ?? settings?.bufferMinutes ?? 10]))
  return calculateAvailableTimes(data.date, type, day, exception, settings, bookings, bufferByType, data.excludeReference)
})

export const getAvailableDates = createServerFn().validator(z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(0).max(11), typeId: z.string().min(1) })).handler(async ({ data }) => {
  await initialize()
  const firstDate = `${data.year}-${pad(data.month + 1)}-01`
  const lastDate = `${data.year}-${pad(data.month + 1)}-${pad(new Date(data.year, data.month + 1, 0).getDate())}`
  const [workingDays, exceptions, type, settings, bookings] = await Promise.all([
    prisma.workingDay.findMany({ select: { weekday: true, enabled: true, periods: true } }),
    prisma.availabilityException.findMany({ where: { date: { gte: firstDate, lte: lastDate } }, select: { date: true, blocked: true, periods: true } }),
    prisma.appointmentType.findUnique({ where: { id: data.typeId }, select: { id: true, active: true, duration: true, maxBookingDays: true, dailyLimit: true, bufferMinutes: true } }),
    prisma.schedulingSettings.findUnique({ where: { id: 'default' }, select: { timezone: true, bookingWindowDays: true, minimumNoticeHour: true, dailyLimit: true, bufferMinutes: true } }),
    prisma.booking.findMany({ where: { date: { gte: firstDate, lte: lastDate }, status: 'CONFIRMED' }, select: { reference: true, typeId: true, date: true, startMinute: true, duration: true } }),
  ])
  if (!type) return []
  const existingTypes = await prisma.appointmentType.findMany({ where: { id: { in: [...new Set(bookings.map((booking) => booking.typeId))] } }, select: { id: true, bufferMinutes: true } })
  const bufferByType = new Map(existingTypes.map((item) => [item.id, item.bufferMinutes ?? settings?.bufferMinutes ?? 10]))
  const daysByWeekday = new Map(workingDays.map((day) => [day.weekday, day]))
  const exceptionsByDate = new Map(exceptions.map((item) => [item.date, item]))
  const bookingsByDate = new Map<string, typeof bookings>()
  for (const booking of bookings) bookingsByDate.set(booking.date, [...(bookingsByDate.get(booking.date) ?? []), booking])
  const dates = Array.from({ length: new Date(data.year, data.month + 1, 0).getDate() }, (_, index) => `${data.year}-${pad(data.month + 1)}-${pad(index + 1)}`)
  return dates.filter((date) => calculateAvailableTimes(date, type, daysByWeekday.get(new Date(`${date}T12:00:00Z`).getUTCDay()) ?? null, exceptionsByDate.get(date) ?? null, settings, bookingsByDate.get(date) ?? [], bufferByType).length > 0)
})

export const createBooking = createServerFn({ method: 'POST' })
  .validator(z.object({ name: z.string().trim().min(2).max(120), email: z.email().max(254), phone: z.string().max(40).optional(), company: z.string().max(120).optional(), message: z.string().max(1000).optional(), typeId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().min(1) }))
  .handler(async ({ data }) => {
    try {
      await initialize()
      const type = await prisma.appointmentType.findFirst({ where: { id: data.typeId, active: true } })
      if (!type || !(await getAvailableTimes({ data: { date: data.date, typeId: data.typeId } })).includes(data.time)) throw new Error('That time is no longer available. Please choose another.')
      const startMinute = minutes(data.time)
      const reference = `TB-${new Date().getFullYear()}-${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.date}))::text AS locked`
        const settings = await tx.schedulingSettings.findUnique({ where: { id: 'default' } })
        const bookings = await tx.booking.findMany({ where: { date: data.date, status: 'CONFIRMED' } })
        const buffer = type.bufferMinutes ?? settings?.bufferMinutes ?? 10
        const countForLimit = type.dailyLimit == null ? bookings.length : bookings.filter((booking) => booking.typeId === type.id).length
        const existingTypes = await tx.appointmentType.findMany({ where: { id: { in: [...new Set(bookings.map((booking) => booking.typeId))] } }, select: { id: true, bufferMinutes: true } })
        const bufferByType = new Map(existingTypes.map((item) => [item.id, item.bufferMinutes ?? settings?.bufferMinutes ?? 10]))
        if (countForLimit >= (type.dailyLimit ?? settings?.dailyLimit ?? 10) || bookings.some((booking) => conflicts(startMinute, type.duration, buffer, booking, bufferByType.get(booking.typeId) ?? settings?.bufferMinutes ?? 10))) throw new Error('That time was just reserved. Please choose another.')
        return tx.booking.create({ data: { id: crypto.randomUUID(), reference, name: data.name, email: data.email.toLowerCase(), phone: data.phone || null, company: data.company || null, message: data.message || null, typeId: type.id, typeTitle: type.title, duration: type.duration, date: data.date, time: data.time, startMinute } })
      })
    } catch (error) {
      if (error instanceof Error && /That time (?:is no longer available|was just reserved)/i.test(error.message)) throw error
      throw new Error('We could not save your booking right now. Please try again.')
    }
  })

export const getAdminBookings = createServerFn().handler(async () => {
  await assertAdmin()
  await initialize()
  return prisma.booking.findMany({ orderBy: { createdAt: 'desc' }, take: 500 })
})

export const cancelAdminBooking = createServerFn({ method: 'POST' }).validator(z.object({ id: z.string().min(1) })).handler(async ({ data }) => {
  await assertAdmin()
  return prisma.booking.updateMany({ where: { reference: data.id, status: 'CONFIRMED' }, data: { status: 'CANCELLED' } })
})

export const updateAdminBooking = createServerFn({ method: 'POST' }).validator(z.object({ reference: z.string().min(8).max(40), name: z.string().trim().min(2).max(120), email: z.email().max(254), phone: z.string().max(40).nullable(), company: z.string().max(120).nullable(), message: z.string().max(1000).nullable() })).handler(async ({ data }) => {
  await assertAdmin()
  return prisma.booking.update({ where: { reference: data.reference }, data: { name: data.name, email: data.email.toLowerCase(), phone: data.phone || null, company: data.company || null, message: data.message || null } })
})

export const rescheduleAdminBooking = createServerFn({ method: 'POST' }).validator(z.object({ reference: z.string().min(8).max(40), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().min(1) })).handler(async ({ data }) => {
  await assertAdmin()
  const booking = await prisma.booking.findFirst({ where: { reference: data.reference, status: 'CONFIRMED' } })
  if (!booking) return false
  const slots = await getAvailableTimes({ data: { date: data.date, typeId: booking.typeId, excludeReference: booking.reference } })
  const startMinute = minutes(data.time)
  if (!slots.includes(data.time) || startMinute < 0) return false
  const dates = [...new Set([booking.date, data.date])].sort()
  return prisma.$transaction(async (tx) => {
    for (const date of dates) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${date}))::text AS locked`
    const [conflictBookings, type, settings] = await Promise.all([
      tx.booking.findMany({ where: { date: data.date, status: 'CONFIRMED', NOT: { reference: booking.reference } } }),
      tx.appointmentType.findUnique({ where: { id: booking.typeId } }),
      tx.schedulingSettings.findUnique({ where: { id: 'default' } }),
    ])
    const buffer = type?.bufferMinutes ?? settings?.bufferMinutes ?? 10
    const existingTypes = await tx.appointmentType.findMany({ where: { id: { in: [...new Set(conflictBookings.map((item) => item.typeId))] } }, select: { id: true, bufferMinutes: true } })
    const bufferByType = new Map(existingTypes.map((item) => [item.id, item.bufferMinutes ?? settings?.bufferMinutes ?? 10]))
    const countForLimit = type?.dailyLimit == null ? conflictBookings.length : conflictBookings.filter((item) => item.typeId === type.id).length
    if (countForLimit >= (type?.dailyLimit ?? settings?.dailyLimit ?? 10) || conflictBookings.some((conflict) => conflicts(startMinute, booking.duration, buffer, conflict, bufferByType.get(conflict.typeId) ?? settings?.bufferMinutes ?? 10))) return false
    const updated = await tx.booking.updateMany({ where: { reference: booking.reference, status: 'CONFIRMED' }, data: { date: data.date, time: data.time, startMinute } })
    return updated.count === 1
  })
})

export const updateScheduleSettings = createServerFn({ method: 'POST' }).validator(z.object({ timezone: z.string().min(1), bufferMinutes: z.number().int().min(0).max(60), minimumNoticeHour: z.number().int().min(0).max(72), bookingWindowDays: z.number().int().min(1).max(365), dailyLimit: z.number().int().min(1).max(100) })).handler(async ({ data }) => {
  await assertAdmin()
  return prisma.schedulingSettings.upsert({ where: { id: 'default' }, create: { id: 'default', ...data }, update: data })
})

export const getAdminSettings = createServerFn().handler(async () => {
  await assertAdmin()
  await initialize()
  const [settings, days, exceptions, types] = await Promise.all([prisma.schedulingSettings.findUnique({ where: { id: 'default' } }), prisma.workingDay.findMany({ orderBy: { weekday: 'asc' } }), prisma.availabilityException.findMany({ orderBy: { date: 'asc' } }), prisma.appointmentType.findMany({ orderBy: { createdAt: 'asc' } })])
  return { settings, days, exceptions, types }
})

const periodSchema = z.object({ start: z.number().int().min(0).max(1439), end: z.number().int().min(1).max(1440) }).refine((period) => period.start < period.end)
const appointmentSchema = z.object({ id: z.string().optional(), title: z.string().trim().min(3).max(80), description: z.string().trim().min(5).max(500), duration: z.number().int().min(15).max(180), meetingType: z.enum(['Video call', 'In person']), preparation: z.string().max(500), bufferMinutes: z.number().int().min(0).max(60).nullable(), maxBookingDays: z.number().int().min(1).max(365).nullable(), dailyLimit: z.number().int().min(1).max(100).nullable(), active: z.boolean() })

export const saveWorkingDay = createServerFn({ method: 'POST' }).validator(z.object({ weekday: z.number().int().min(0).max(6), enabled: z.boolean(), periods: z.array(periodSchema).max(4) })).handler(async ({ data }) => {
  await assertAdmin()
  return prisma.workingDay.upsert({ where: { weekday: data.weekday }, create: { id: `weekday-${data.weekday}`, ...data }, update: data })
})

export const saveAvailabilityException = createServerFn({ method: 'POST' }).validator(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), blocked: z.boolean(), description: z.string().trim().min(2).max(120), periods: z.array(periodSchema).max(4).optional() })).handler(async ({ data }) => {
  await assertAdmin()
  return prisma.availabilityException.upsert({ where: { date: data.date }, create: { id: crypto.randomUUID(), ...data }, update: data })
})

export const removeAvailabilityException = createServerFn({ method: 'POST' }).validator(z.object({ id: z.string().min(1) })).handler(async ({ data }) => {
  await assertAdmin()
  return prisma.availabilityException.delete({ where: { id: data.id } })
})

export const saveAppointmentType = createServerFn({ method: 'POST' }).validator(appointmentSchema).handler(async ({ data }) => {
  await assertAdmin()
  const { id, ...fields } = data
  if (id) return prisma.appointmentType.update({ where: { id }, data: fields })
  return prisma.appointmentType.create({ data: { id: crypto.randomUUID(), ...fields } })
})

export const removeAppointmentType = createServerFn({ method: 'POST' }).validator(z.object({ id: z.string().min(1) })).handler(async ({ data }) => {
  await assertAdmin()
  const type = await prisma.appointmentType.findUniqueOrThrow({ where: { id: data.id } })
  if (type.active) return prisma.appointmentType.update({ where: { id: data.id }, data: { active: false } })
  const history = await prisma.booking.count({ where: { typeId: data.id } })
  if (history) throw new Error('This appointment type has booking history and cannot be deleted. Historical appointments are preserved.')
  return prisma.appointmentType.delete({ where: { id: data.id } })
})

export const lookupVisitorBooking = createServerFn().validator(z.object({ reference: z.string().trim().min(8).max(40), email: z.email().max(254) })).handler(async ({ data }) => {
  const booking = await prisma.booking.findFirst({ where: { reference: data.reference, email: data.email.toLowerCase() } })
  if (!booking) return null
  return { reference: booking.reference, name: booking.name, email: booking.email, kind: booking.typeTitle, typeId: booking.typeId, date: booking.date, time: booking.time, duration: booking.duration, status: booking.status, created: booking.createdAt.toISOString() }
})

export const cancelVisitorBooking = createServerFn({ method: 'POST' }).validator(z.object({ reference: z.string().min(8), email: z.email() })).handler(async ({ data }) => {
  const timezone = (await prisma.schedulingSettings.findUnique({ where: { id: 'default' }, select: { timezone: true } }))?.timezone ?? 'Asia/Manila'
  const today = localDate(new Date(), timezone)
  const updated = await prisma.booking.updateMany({ where: { reference: data.reference, email: data.email.toLowerCase(), status: 'CONFIRMED', date: { gte: today } }, data: { status: 'CANCELLED' } })
  return updated.count === 1
})

export const rescheduleVisitorBooking = createServerFn({ method: 'POST' }).validator(z.object({ reference: z.string().min(8), email: z.email(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().min(1) })).handler(async ({ data }) => {
  const booking = await prisma.booking.findFirst({ where: { reference: data.reference, email: data.email.toLowerCase(), status: 'CONFIRMED' } })
  if (!booking) return false
  const slots = await getAvailableTimes({ data: { date: data.date, typeId: booking.typeId, excludeReference: booking.reference } })
  const startMinute = minutes(data.time)
  if (!slots.includes(data.time) || startMinute < 0) return false
  const dates = [...new Set([booking.date, data.date])].sort()
  return prisma.$transaction(async (tx) => {
    for (const date of dates) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${date}))::text AS locked`
    const [conflictBookings, type, settings] = await Promise.all([
      tx.booking.findMany({ where: { date: data.date, status: 'CONFIRMED', NOT: { reference: booking.reference } } }),
      tx.appointmentType.findUnique({ where: { id: booking.typeId } }),
      tx.schedulingSettings.findUnique({ where: { id: 'default' } }),
    ])
    const buffer = type?.bufferMinutes ?? settings?.bufferMinutes ?? 10
    const existingTypes = await tx.appointmentType.findMany({ where: { id: { in: [...new Set(conflictBookings.map((item) => item.typeId))] } }, select: { id: true, bufferMinutes: true } })
    const bufferByType = new Map(existingTypes.map((item) => [item.id, item.bufferMinutes ?? settings?.bufferMinutes ?? 10]))
    const countForLimit = type?.dailyLimit == null ? conflictBookings.length : conflictBookings.filter((item) => item.typeId === type.id).length
    if (countForLimit >= (type?.dailyLimit ?? settings?.dailyLimit ?? 10) || conflictBookings.some((conflict) => conflicts(startMinute, booking.duration, buffer, conflict, bufferByType.get(conflict.typeId) ?? settings?.bufferMinutes ?? 10))) return false
    const updated = await tx.booking.updateMany({ where: { reference: booking.reference, email: data.email.toLowerCase(), status: 'CONFIRMED' }, data: { date: data.date, time: data.time, startMinute } })
    return updated.count === 1
  })
})

export const getBookingAnalytics = createServerFn().validator(z.object({ days: z.number().int().min(1).max(365).default(30), from: z.string().refine(isValidDateLabel, 'Choose a valid start date.').optional(), to: z.string().refine(isValidDateLabel, 'Choose a valid end date.').optional() }).refine((range) => !range.from || !range.to || range.from <= range.to, 'Start date must be before end date.').refine((range) => !range.from || !range.to || (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86400000 < 365, 'Choose a date range of 365 days or less.')).handler(async ({ data }) => {
  await assertAdmin()
  const timezone = (await prisma.schedulingSettings.findUnique({ where: { id: 'default' }, select: { timezone: true } }))?.timezone ?? 'Asia/Manila'
  const now = new Date()
  const today = localDate(now, timezone)
  const startLabel = data.from ?? addCalendarDays(today, 1 - data.days)
  const endLabel = data.to ?? today
  if (startLabel > endLabel) throw new Error('The selected date range cannot end before it starts.')
  const since = zonedDateTimeToUtc(startLabel, '00:00', timezone)
  const untilExclusive = zonedDateTimeToUtc(addCalendarDays(endLabel, 1), '00:00', timezone)
  const all = await prisma.booking.findMany({ where: { createdAt: { gte: since, lt: untilExclusive } }, select: { typeTitle: true, status: true, createdAt: true, date: true } })
  const typeCounts = new Map<string, number>()
  const dailyCounts = new Map<string, number>()
  let confirmed = 0
  let cancelled = 0
  for (const booking of all) {
    typeCounts.set(booking.typeTitle, (typeCounts.get(booking.typeTitle) ?? 0) + 1)
    const label = localDate(booking.createdAt, timezone)
    dailyCounts.set(label, (dailyCounts.get(label) ?? 0) + 1)
    if (booking.status === 'CONFIRMED') confirmed++
    if (booking.status === 'CANCELLED') cancelled++
  }
  const completed = all.filter((booking) => booking.status === 'CONFIRMED' && booking.date < today).length
  const rangeDays = Math.floor((Date.parse(`${endLabel}T00:00:00Z`) - Date.parse(`${startLabel}T00:00:00Z`)) / 86400000) + 1
  const byDay = Array.from({ length: rangeDays }, (_, index) => {
    const label = addCalendarDays(startLabel, index)
    return { label, value: dailyCounts.get(label) ?? 0 }
  })
  const byType = [...typeCounts].map(([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value)
  return { total: all.length, confirmed, cancelled, upcoming: all.filter((booking) => booking.status === 'CONFIRMED' && booking.date >= today).length, completed, byType, byDay }
})
