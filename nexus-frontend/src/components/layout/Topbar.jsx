import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore.js'
import { Avatar } from '@/components/ui/index.jsx'

const BREADCRUMBS = {
  '/dashboard': 'Dashboard', '/clients': 'Clients', '/projects': 'Projects',
  '/timelines': 'Timelines', '/resources': 'Resources', '/chat': 'Chat',
  '/notifications': 'Notifications', '/profile': 'Profile', '/settings': 'Settings',
}

export default function Topbar({ sideW, unreadCount = 0 }) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  const label = Object.entries(BREADCRUMBS).find(([k]) => location.pathname.startsWith(k))?.[1] || ''

  return (
    <header style={{
      position: 'fixed', top: 0, left: sideW, right: 0,
      height: 60, background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 var(--sp-8)', zIndex: 90,
      transition: 'left var(--t-slow)',
    }}>
      {/* Left: breadcrumb */}
      <div>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-0)' }}>
          {label}
        </span>
      </div>

      {/* Right: actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        {/* Bell with unread badge */}
        <button
          onClick={() => navigate('/notifications')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: unreadCount > 0 ? 'var(--accent)' : 'var(--text-2)',
            padding: 8, lineHeight: 0, borderRadius: 'var(--r-md)',
            transition: 'all var(--t-fast)', position: 'relative',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-0)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = unreadCount > 0 ? 'var(--accent)' : 'var(--text-2)' }}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              minWidth: 16, height: 16, borderRadius: 8,
              background: 'var(--accent)', color: '#0a0a0a',
              fontSize: '10px', fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, padding: '0 3px',
              boxShadow: '0 0 0 2px var(--bg-0)',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {user && (
          <button onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0, borderRadius: '50%' }}>
            <Avatar name={user.name} src={user.avatar} size={34} role={user.role} />
          </button>
        )}
      </div>
    </header>
  )
}
