import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, FolderKanban, GitBranch,
  MessageSquare, Bell, Settings, LogOut, ChevronLeft,
  UserCircle, Wrench, ChevronRight, Building2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore.js'
import { Avatar } from '@/components/ui/index.jsx'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', perm: 'dashboard' },
  { to: '/clients',   icon: Building2,       label: 'Clients',   perm: 'clients' },
  { to: '/projects',  icon: FolderKanban,    label: 'Projects',  perm: 'projects' },
  { to: '/timelines', icon: GitBranch,       label: 'Timelines', perm: 'timelines' },
  { to: '/resources', icon: Wrench,          label: 'Resources', perm: 'resources' },
  { to: '/chat',      icon: MessageSquare,   label: 'Chat',      perm: 'chat' },
]

const BOTTOM_NAV = [
  { to: '/notifications', icon: Bell,     label: 'Notifications' },
  { to: '/profile',       icon: UserCircle, label: 'Profile' },
  { to: '/settings',      icon: Settings, label: 'Settings', perm: 'access_control' },
]

export default function Sidebar({ collapsed, onToggle, unreadCount }) {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const hasPermission = useAuthStore(s => s.hasPermission)

  const w = collapsed ? 64 : 240

  return (
    <aside style={{
      width: w, minHeight: '100vh', background: 'var(--bg-1)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      transition: 'width var(--t-slow)',
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '20px 0' : '20px 20px',
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: '1px solid var(--border)', minHeight: 64,
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NexusLogo />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em', color: 'var(--text-0)' }}>
              AstraTSM
            </span>
          </div>
        )}
        {collapsed && <NexusLogo />}
        {!collapsed && (
          <button onClick={onToggle} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', padding: 4, borderRadius: 'var(--r-sm)',
            lineHeight: 0, transition: 'color var(--t-fast)',
          }}>
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Main nav */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {NAV.map(item => {
          if (item.perm && !hasPermission(item.perm) && !hasPermission(item.perm + '_view')) return null
          return <NavItem key={item.to} {...item} collapsed={collapsed} />
        })}
      </nav>

      {/* Bottom nav */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 0' }}>
        {BOTTOM_NAV.map(item => {
          if (item.perm && !hasPermission(item.perm)) return null
          return (
            <NavItem key={item.to} {...item} collapsed={collapsed}
              badge={item.to === '/notifications' && unreadCount > 0 ? unreadCount : null}
            />
          )
        })}
        <button
          onClick={logout}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
            padding: collapsed ? '10px 0' : '10px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--danger)', fontSize: '13px', fontWeight: 500,
            transition: 'background var(--t-fast)', borderRadius: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <LogOut size={16} />
          {!collapsed && 'Sign out'}
        </button>
      </div>

      {/* User chip */}
      {!collapsed && user && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Avatar name={user.name} src={user.avatar} size={32} role={user.role} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'capitalize' }}>{user.role}</div>
          </div>
        </div>
      )}

      {/* Collapsed toggle */}
      {collapsed && (
        <button onClick={onToggle} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '12px 0', color: 'var(--text-3)', lineHeight: 0,
          display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border)',
        }}>
          <ChevronRight size={16} />
        </button>
      )}
    </aside>
  )
}

function NavItem({ to, icon: Icon, label, collapsed, badge }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 12,
        padding: collapsed ? '10px 0' : '10px 16px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: isActive ? 'var(--accent)' : 'var(--text-2)',
        fontSize: '13px', fontWeight: isActive ? 600 : 400,
        background: isActive ? 'var(--accent-dim)' : 'transparent',
        borderRight: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'all var(--t-fast)',
        position: 'relative',
        textDecoration: 'none',
      })}
      onMouseEnter={e => {
        if (!e.currentTarget.classList.contains('active'))
          e.currentTarget.style.background = 'var(--bg-2)'
      }}
      onMouseLeave={e => {
        if (!e.currentTarget.classList.contains('active'))
          e.currentTarget.style.background = ''
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Icon size={16} />
        {badge && collapsed && (
          <span style={{
            position: 'absolute', top: -4, right: -4, width: 8, height: 8,
            background: 'var(--danger)', borderRadius: '50%',
          }} />
        )}
      </div>
      {!collapsed && label}
      {!collapsed && badge && (
        <span style={{
          marginLeft: 'auto', background: 'var(--danger)', color: '#fff',
          fontSize: '10px', fontWeight: 700, padding: '1px 6px',
          borderRadius: 'var(--r-full)', minWidth: 18, textAlign: 'center',
        }}>{badge > 99 ? '99+' : badge}</span>
      )}
    </NavLink>
  )
}

function NexusLogo() {
  return <img src="/logo.png" style={{ width: 28, height: 28, objectFit: 'contain' }} />
}