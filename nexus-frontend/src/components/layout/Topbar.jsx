import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Sun, Moon } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore.js'
import { Avatar } from '@/components/ui/index.jsx'

const BREADCRUMBS = {
  '/dashboard': 'Dashboard', '/clients': 'Clients', '/projects': 'Projects',
  '/timelines': 'Timelines', '/resources': 'Resources', '/chat': 'Chat',
  '/notifications': 'Notifications', '/profile': 'Profile', '/settings': 'Settings',
}

export default function Topbar({ sideW, unreadCount = 0 }) {
  const location = useNavigate() // keep for future
  const loc      = useLocation()
  const navigate = useNavigate()
  const user     = useAuthStore(s => s.user)

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const label = Object.entries(BREADCRUMBS).find(([k]) => loc.pathname.startsWith(k))?.[1] || ''
  const isLight = theme === 'light'

  return (
    <header style={{
      position: 'fixed', top: 0, left: sideW, right: 0,
      height: 60,
      background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(10,10,10,0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 var(--sp-8)', zIndex: 90,
      transition: 'left var(--t-slow)',
    }}>
      {/* Left: breadcrumb */}
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-0)' }}>
        {label}
      </span>

      {/* Right: actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>

        {/* Theme toggle */}
        <button onClick={toggleTheme}
          title={isLight ? 'Switch to dark' : 'Switch to light'}
          style={{
            background: isLight ? 'var(--bg-3)' : 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-full)',
            cursor: 'pointer', padding: '5px 10px',
            display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--text-2)', fontSize: '12px', fontWeight: 500,
            transition: 'all var(--t-fast)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}>
          {isLight ? <Moon size={14} /> : <Sun size={14} />}
          {isLight ? 'Dark' : 'Light'}
        </button>

        {/* Bell */}
        <button onClick={() => navigate('/notifications')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: unreadCount > 0 ? 'var(--accent)' : 'var(--text-2)',
            padding: 8, lineHeight: 0, borderRadius: 'var(--r-md)',
            transition: 'all var(--t-fast)', position: 'relative',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-0)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = unreadCount > 0 ? 'var(--accent)' : 'var(--text-2)' }}>
          <Bell size={18} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              minWidth: 16, height: 16, borderRadius: 8,
              background: 'var(--accent)', color: isLight ? '#fff' : '#0a0a0a',
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
