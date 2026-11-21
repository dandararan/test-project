const clockPattern = /^(\d{1,2}):(\d{2}) (AM|PM)$/

function formatClock(totalMinutes: number) {
  const minutesInDay = ((totalMinutes % 1440) + 1440) % 1440
  const hour24 = Math.floor(minutesInDay / 60)
  const minute = minutesInDay % 60
  const hour12 = hour24 % 12 || 12
  const period = hour24 >= 12 ? 'PM' : 'AM'
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
}

export function formatTimeRange(startTime: string, durationMinutes: number) {
  const match = clockPattern.exec(startTime)
  if (!match || !Number.isInteger(durationMinutes) || durationMinutes <= 0) return startTime

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 1 || hour > 12 || minute > 59) return startTime

  const startMinutes = (hour % 12 + (match[3] === 'PM' ? 12 : 0)) * 60 + minute
  return `${formatClock(startMinutes)} \u2013 ${formatClock(startMinutes + durationMinutes)}`
}
