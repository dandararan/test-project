import { createFileRoute } from '@tanstack/react-router'
import { AppointmentsPage } from '#/components/admin-pages'
import { getAdminBookings } from '#/lib/scheduling.functions'

export const Route = createFileRoute('/admin/appointments')({
  loader: () => getAdminBookings(),
  component: () => <AppointmentsPage bookings={Route.useLoaderData()}/>,
})
