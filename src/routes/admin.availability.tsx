import { createFileRoute } from '@tanstack/react-router'
import { AvailabilityPage } from '#/components/admin-pages'
import { getAdminSettings } from '#/lib/scheduling.functions'

export const Route = createFileRoute('/admin/availability')({
  loader: () => getAdminSettings(),
  component: () => <AvailabilityPage data={Route.useLoaderData()}/>,
})
