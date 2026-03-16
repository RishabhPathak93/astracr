import React, { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar.jsx'
import Topbar from '@/components/layout/Topbar.jsx'
import { useAuthStore } from '@/stores/authStore.js'
import { authApi, notificationsApi } from '@/api/index.js'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const setUser    = useAuthStore(s => s.setUser)
  const user       = useAuthStore(s => s.user)
  const qc         = useQueryClient()

  // Fetch current user on mount
  useEffect(() => {
    if (!user) {
      authApi.me().then(r => setUser(r.data)).catch(() => {})
    }
  }, [])

  // Poll unread notification count every 15 seconds
  const { data: unreadData, refetch: refetchUnread } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.unreadCount().then(r => r.data),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })

  const sideW = collapsed ? 64 : 240

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        unreadCount={unreadData?.unread_count || 0}
      />
      <div style={{
        flex: 1, marginLeft: sideW,
        display: 'flex', flexDirection: 'column',
        transition: 'margin-left var(--t-slow)',
        minWidth: 0,
      }}>
        <Topbar sideW={sideW} unreadCount={unreadData?.unread_count || 0} />
        <main style={{
          flex: 1, marginTop: 60,
          padding: 'var(--sp-8)',
          maxWidth: 1400, width: '100%', margin: '60px auto 0',
          animation: 'fadeIn 0.3s ease both',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
