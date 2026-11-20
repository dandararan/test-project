import { createRouter as createTanStackRouter, Link } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import { getContext } from './integrations/tanstack-query/root-provider'

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: () => (
      <main className="not-found-page">
        <span className="eyebrow">TALENT BRIDGING</span>
        <h1>This page isn’t on the calendar.</h1>
        <p>The link may have moved. Head back to the booking page to find your way.</p>
        <Link className="primary-btn" to="/" search={{ admin: false, reason: undefined }}>Return to booking</Link>
      </main>
    ),
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
