import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
import { getAdminProfile } from '#/lib/scheduling.functions'

export const Route = createFileRoute('/admin/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    reason: search.reason === 'admin-config' || search.reason === 'unauthorized' ? search.reason : undefined,
  }),
  component: AdminLoginPage,
})

function AdminLoginPage() {
  const { reason } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (reason === 'admin-config') setMessage('Admin access is not configured for this deployment. Set ADMIN_EMAIL in Vercel to the administrator account and redeploy.')
    else if (reason === 'unauthorized') setMessage('This account is not authorized for the admin workspace. Use the administrator account.')
  }, [reason])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage('')

    try {
      const result = await authClient.signIn.email({ email: email.trim(), password })
      if (result.error) {
        setMessage(result.error.message || 'Those sign-in details could not be verified.')
        return
      }

      try {
        await getAdminProfile()
        window.location.assign('/admin')
      } catch (error) {
        const detail = error instanceof Error ? error.message : ''
        setMessage(detail.includes('Administrator access is not configured')
          ? 'Your sign-in worked, but admin access is not configured. Set ADMIN_EMAIL in Vercel to this account and redeploy.'
          : detail.includes('Administrator access required')
            ? 'Your sign-in worked, but this account is not on the admin allowlist. Use the account configured in ADMIN_EMAIL.'
            : 'Your sign-in worked, but we could not verify admin access. Check the production auth and database settings.')
      }
    } catch {
      setMessage('We could not reach the sign-in service. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="admin-login-page"><Card className="admin-login-card"><CardHeader className="admin-login-header"><Link to="/" search={{ admin: false, reason: undefined }} className="admin-login-brand"><span className="brand-mark">tb</span><span>Talent Bridging<small>ADMIN WORKSPACE</small></span></Link><Badge variant="outline"><ShieldCheck data-icon="inline-start"/> Secure sign in</Badge><CardTitle>Welcome back</CardTitle><CardDescription>Sign in with the administrator account for this workspace.</CardDescription></CardHeader><CardContent><form className="admin-login-form" onSubmit={(event) => void submit(event)}><Label htmlFor="admin-login-email">Email address<Input id="admin-login-email" type="email" required autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)}/></Label><Label htmlFor="admin-login-password">Password<Input id="admin-login-password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}/></Label>{message && <p className="admin-login-message" role="alert">{message}</p>}<Button type="submit" disabled={busy}>{busy ? 'Checking access…' : 'Sign in to workspace'}</Button></form></CardContent><CardFooter className="admin-login-footer"><Link to="/" search={{ admin: false, reason: undefined }}><ArrowLeft data-icon="inline-start"/>Return to booking</Link></CardFooter></Card></main>
}
