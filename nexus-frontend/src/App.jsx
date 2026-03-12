import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore.js'

import AppLayout from '@/components/layout/AppLayout.jsx'
import LoginPage from '@/pages/Login.jsx'
import DashboardPage from '@/pages/Dashboard.jsx'
import ProjectsPage from '@/pages/Projects.jsx'
import ProjectDetailPage from '@/pages/ProjectDetail.jsx'
import ClientsPage from '@/pages/Clients.jsx'
import ClientDetailPage from '@/pages/ClientDetail.jsx'
import TimelinesPage from '@/pages/Timelines.jsx'
import ChatPage from '@/pages/Chat.jsx'
import { NotificationsPage, ResourcesPage, ProfilePage, SettingsPage } from '@/pages/Other.jsx'

function ProtectedRoute({ children }) {
  const isAuth = useAuthStore(s => s.isAuthenticated)
  return isAuth ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const isAuth = useAuthStore(s => s.isAuthenticated)
  return !isAuth ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="timelines" element={<TimelinesPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
