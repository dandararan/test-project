import { createFileRoute } from '@tanstack/react-router'
import { AdminOverviewPage } from '#/components/admin-pages'
import { getAdminBookings, getBookingAnalytics } from '#/lib/scheduling.functions'

export const Route = createFileRoute('/admin/')({
  loader: async () => Promise.all([getAdminBookings(), getBookingAnalytics({ data: { days: 30 } })]).then(([bookings, analytics]) => ({ bookings, analytics })),
  component: () => { const data = Route.useLoaderData(); return <AdminOverviewPage bookings={data.bookings} analytics={data.analytics}/> },
})
