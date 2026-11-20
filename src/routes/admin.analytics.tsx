import { createFileRoute } from '@tanstack/react-router'
import { AnalyticsPage } from '#/components/admin-pages'
import { getBookingAnalytics } from '#/lib/scheduling.functions'

export const Route = createFileRoute('/admin/analytics')({
  loader: () => getBookingAnalytics({ data: { days: 30 } }),
  component: () => <AnalyticsPage initial={Route.useLoaderData()}/>,
})
