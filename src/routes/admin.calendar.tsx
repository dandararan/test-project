import { createFileRoute } from '@tanstack/react-router'
import { AdminCalendarPage } from '#/components/admin-pages'
import { getAdminBookings, getAdminSettings } from '#/lib/scheduling.functions'

export const Route = createFileRoute('/admin/calendar')({
  loader: async () => Promise.all([getAdminBookings(), getAdminSettings()]).then(([bookings, settings]) => ({ bookings, settings })),
  component: () => { const data = Route.useLoaderData(); return <AdminCalendarPage bookings={data.bookings} timezone={data.settings.settings?.timezone ?? 'Asia/Manila'}/> },
})
