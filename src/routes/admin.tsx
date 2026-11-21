import { createFileRoute, redirect } from '@tanstack/react-router'
import { AdminShell } from '#/components/admin-shell'
import { getAdminProfile } from '#/lib/scheduling.functions'

export const Route = createFileRoute('/admin')({
  loader: async () => {
    try {
      return await getAdminProfile()
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('Administrator access is not configured')) {
        throw redirect({ to: '/', search: { admin: true, reason: 'admin-config' } })
      }
      if (message === 'Authentication required' || message.includes('Administrator access required')) {
        throw redirect({ to: '/', search: { admin: true, reason: 'unauthorized' } })
      }
      throw error
    }
  },
  component: () => <AdminShell profile={Route.useLoaderData()} />,
})
