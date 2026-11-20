import { createContext, useContext, useState } from 'react'
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { CalendarDays, ChartNoAxesColumnIncreasing, Clock3, LogOut, Menu, Settings, UsersRound, Video, X } from 'lucide-react'
import { toast } from 'sonner'
import { authClient } from '#/lib/auth-client'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'

export type AdminProfile = { id: string; name: string; email: string; createdAt: Date }
const AdminProfileContext = createContext<AdminProfile | null>(null)
const navigation = [
  { to: '/admin', label: 'Overview', icon: ChartNoAxesColumnIncreasing, exact: true },
  { to: '/admin/appointments', label: 'Appointments', icon: UsersRound, exact: false },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays, exact: false },
  { to: '/admin/availability', label: 'Availability', icon: Clock3, exact: false },
  { to: '/admin/appointment-types', label: 'Appointment types', icon: Video, exact: false },
  { to: '/admin/analytics', label: 'Analytics', icon: ChartNoAxesColumnIncreasing, exact: false },
  { to: '/admin/settings', label: 'Account settings', icon: Settings, exact: false },
] as const

export function useAdminProfile() {
  const profile = useContext(AdminProfileContext)
  if (!profile) throw new Error('Admin profile is missing from the protected layout.')
  return profile
}

export function AdminShell({ profile }: { profile: AdminProfile }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const titles: Record<string, string> = {
    '/admin/': 'Overview', '/admin': 'Overview', '/admin/appointments': 'Appointments', '/admin/calendar': 'Calendar',
    '/admin/availability': 'Availability', '/admin/appointment-types': 'Appointment types', '/admin/analytics': 'Analytics', '/admin/settings': 'Account settings',
  }
  const signOut = async () => {
    const result = await authClient.signOut()
    if (result.error) { toast.error(result.error.message ?? 'Could not sign out.'); return }
    toast.success('You are signed out.')
    await navigate({ to: '/', search: { admin: false, reason: undefined } })
  }
  const links = (onNavigate?: () => void) => navigation.map(({ to, label, icon: Icon, exact }) => <Link key={to} to={to} activeOptions={{ exact }} activeProps={{ 'data-active': 'true' }} className="admin-nav-link" onClick={onNavigate}><Icon aria-hidden="true"/><span>{label}</span></Link>)
  return <AdminProfileContext.Provider value={profile}><div className="admin-app"><header className="admin-topbar"><Link to="/" search={{ admin: false, reason: undefined }} className="admin-brand"><span className="brand-mark">tb</span><span>talent<span className="brand-light">bridging</span><small>ADMIN WORKSPACE</small></span></Link><div className="admin-topbar-actions"><Badge variant="outline" className="admin-role">Workspace admin</Badge><Button variant="ghost" size="sm" onClick={() => void signOut()}><LogOut data-icon="inline-start"/>Sign out</Button><Button variant="outline" size="icon" className="mobile-menu-trigger" aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}>{mobileMenuOpen ? <X/> : <Menu/>}</Button></div></header><div className="admin-layout"><aside className="admin-sidebar"><div className="admin-sidebar-label">WORKSPACE</div>{links()}<Separator/><Link to="/admin/settings" className="admin-account-link"><span className="admin-avatar">{profile.name.trim().slice(0, 1).toUpperCase()}</span><span><b>{profile.name}</b><small>{profile.email}</small></span><Settings aria-hidden="true"/></Link></aside>{mobileMenuOpen && <nav className="admin-mobile-nav" aria-label="Admin navigation">{links(() => setMobileMenuOpen(false))}<Separator/><Button variant="ghost" onClick={() => void signOut()}><LogOut data-icon="inline-start"/>Sign out</Button></nav>}<main className="admin-content"><div className="admin-page-heading"><div><div className="admin-breadcrumb">Talent Bridging <span>/</span> Workspace</div><h1>{titles[pathname] ?? 'Workspace'}</h1></div><Badge variant="secondary">{new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}</Badge></div><Outlet/></main></div></div></AdminProfileContext.Provider>
}
