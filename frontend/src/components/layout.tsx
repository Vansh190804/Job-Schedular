import { useState, type ReactNode } from 'react'
import { Activity, LayoutDashboard, LogOut, Menu, Plus, Settings, Sparkles, Zap } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <Sparkles size={17} />
      </div>
      <span>Scheduler</span>
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { logout, user } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const links = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/jobs', label: 'All jobs', icon: Zap },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <Brand />
        <div className="workspace-label">Workspace</div>
        <nav>
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={location.pathname === to ? 'active' : ''}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar">{(user?.email?.[0] || 'U').toUpperCase()}</div>
            <div>
              <strong>{user?.username || 'Account'}</strong>
              <small>{user?.email || 'Signed in'}</small>
            </div>
          </div>
          <button className="ghost-button full" onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Close menu"
          className="mobile-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="crumb">
            Workspace <span>/</span>{' '}
            {location.pathname.includes('jobs')
              ? 'Jobs'
              : location.pathname.replace('/', '') || 'Overview'}
          </div>
          <div className="topbar-actions">
            <span className="connection">
              <span className="dot" /> API connected
            </span>
            <Link className="button primary compact" to="/jobs/new">
              <Plus size={16} /> New job
            </Link>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <div className="auth-aside">
        <Brand />
        <div className="auth-pitch">
          <p className="eyebrow">AUTOMATE WITH CONFIDENCE</p>
          <h1>
            Your jobs,
            <br />
            <em>right on time.</em>
          </h1>
          <p className="muted">A focused control room for scheduling dependable background work.</p>
          <div className="mini-stats">
            <span><Activity size={16} /> Backend-authoritative</span>
            <span><Activity size={16} /> Live execution state</span>
          </div>
        </div>
      </div>
      <div className="auth-main">{children}</div>
    </div>
  )
}
