import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import { AdminShell } from '#/components/admin-shell'
import { getAdminProfile } from '#/lib/scheduling.functions'

export const Route = createFileRoute('/admin')({
  loader: async ({ location }) => {
    if (location.pathname === '/admin/login') return null
    try {
      return await getAdminProfile()
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('Administrator access is not configured')) {
        throw redirect({ to: '/admin/login', search: { reason: 'admin-config' } })
      }
      if (message === 'Authentication required' || message.includes('Administrator access required')) {
        throw redirect({ to: '/admin/login', search: { reason: 'unauthorized' } })
      }
      throw error
    }
  },
  component: () => {
    const profile = Route.useLoaderData()
    const pathname = useRouterState({ select: (state) => state.location.pathname })
    return pathname === '/admin/login' ? <Outlet/> : profile ? <AdminShell profile={profile}/> : null
  },
})
