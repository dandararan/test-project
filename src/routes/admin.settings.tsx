import { createFileRoute } from '@tanstack/react-router'
import { AccountSettingsPage } from '#/components/admin-pages'
import { getAdminProfile } from '#/lib/scheduling.functions'

export const Route = createFileRoute('/admin/settings')({
  loader: () => getAdminProfile(),
  component: () => <AccountSettingsPage profile={Route.useLoaderData()}/>,
})
