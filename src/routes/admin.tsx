import { createFileRoute, redirect } from '@tanstack/react-router'
import { AdminShell } from '#/components/admin-shell'
import { getAdminProfile } from '#/lib/scheduling.functions'

export const Route = createFileRoute('/admin')({
  loader: async () => {
    try {
      return await getAdminProfile()
    } catch (error) {
      if (error instanceof Error && error.message.includes('Administrator access required')) {
        throw redirect({ to: '/', search: { admin: true, reason: 'unauthorized' } })
      }
      throw error
    }
  },
  component: () => <AdminShell profile={Route.useLoaderData()} />,
})
