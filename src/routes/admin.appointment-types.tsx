import { createFileRoute } from '@tanstack/react-router'
import { AppointmentTypesPage } from '#/components/admin-pages'
import { getAdminSettings } from '#/lib/scheduling.functions'

export const Route = createFileRoute('/admin/appointment-types')({
  loader: () => getAdminSettings(),
  component: () => <AppointmentTypesPage types={Route.useLoaderData().types}/>,
})
