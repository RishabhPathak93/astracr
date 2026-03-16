import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell, Trash2, FolderKanban, MessageSquare, AlertTriangle,
  CheckCircle, User, Calendar, Wrench, Shield, Users,
} from 'lucide-react'
import { notificationsApi, resourcesApi, authApi } from '@/api/index.js'
import { Btn, Badge, EmptyState, Spinner, Avatar, Input, Textarea, Modal } from '@/components/ui/index.jsx'
import { timeAgo, extractError } from '@/utils/index.js'
import { useAuthStore } from '@/stores/authStore.js'

/* ─────────────────────────────────────────────────
   NOTIFICATIONS PAGE
───────────────────────────────────────────────── */
const NOTIF_ICON = {
  project_assigned: FolderKanban,
  status_change: AlertTriangle,
  deadline: Calendar,
  timeline_complete: CheckCircle,
  message: MessageSquare,
  update: FolderKanban,
  mention: User,
}

export function NotificationsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then(r => r.data.results || r.data),
  })

  const notifications = data || []
  const unread = notifications.filter(n => !n.is_read)

  // Auto-mark all as read after 2 seconds of viewing
  useEffect(() => {
    if (unread.length === 0) return
    const timer = setTimeout(async () => {
      await notificationsApi.markAllRead()
      qc.invalidateQueries(['notifications'])
      qc.invalidateQueries(['unread-count'])
    }, 2000)
    return () => clearTimeout(timer)
  }, [unread.length])

  async function markRead(id) {
    await notificationsApi.markRead(id)
    qc.invalidateQueries(['notifications'])
    qc.invalidateQueries(['unread-count'])
  }

  async function markAll() {
    await notificationsApi.markAllRead()
    qc.invalidateQueries(['notifications'])
    qc.invalidateQueries(['unread-count'])
  }

  async function clearAll() {
    await notificationsApi.clearAll()
    qc.invalidateQueries(['notifications'])
    qc.invalidateQueries(['unread-count'])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-0.02em' }}>Notifications</h1>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', marginTop: 4 }}>{unread.length} unread</p>
        </div>
        {notifications.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            {unread.length > 0 && <Btn variant="secondary" size="sm" onClick={markAll}>Mark all read</Btn>}
            <Btn variant="ghost" size="sm" icon={<Trash2 size={12} />} onClick={clearAll}>Clear all</Btn>
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-8)' }}><Spinner /></div>
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} title="All caught up!" description="No notifications to show." />
        ) : (
          notifications.map((n, i) => {
            const Icon = NOTIF_ICON[n.notif_type] || Bell
            return (
              <div key={n.id} style={{
                display: 'flex', gap: 'var(--sp-4)', padding: 'var(--sp-4) var(--sp-5)',
                borderBottom: i < notifications.length - 1 ? '1px solid var(--border)' : 'none',
                background: !n.is_read ? 'rgba(232,255,71,0.02)' : 'transparent',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--r-md)', flexShrink: 0,
                  background: !n.is_read ? 'var(--accent-dim)' : 'var(--bg-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} color={!n.is_read ? 'var(--accent)' : 'var(--text-3)'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: n.is_read ? 400 : 600, fontSize: '13px', marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5 }}>{n.message}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{timeAgo(n.created_at)}</div>
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} style={{
                    background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                    cursor: 'pointer', padding: '4px 8px', color: 'var(--text-3)', fontSize: '11px',
                    flexShrink: 0, alignSelf: 'flex-start', transition: 'all var(--t-fast)',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)' }}
                  >
                    Mark read
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────
   RESOURCES PAGE
───────────────────────────────────────────────── */
export function ResourcesPage() {
  const qc = useQueryClient()
  const canCreate = useAuthStore(s => s.hasPermission('resources'))
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: () => resourcesApi.list({ page_size: 100 }).then(r => r.data.results || r.data),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  })

  const resources = data || []
  const bench  = resources.filter(r => (r.active_project_count ?? 0) === 0)
  const active = resources.filter(r => (r.active_project_count ?? 0) > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-0.02em' }}>Resources</h1>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', marginTop: 4 }}>
            {resources.length} team members · <span style={{ color: 'var(--success)' }}>{active.length} active</span> · <span style={{ color: 'var(--danger)' }}>{bench.length} on bench</span>
          </p>
        </div>
        {canCreate && <Btn icon={<Users size={14} />} onClick={() => setShowCreate(true)}>New Resource</Btn>}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-8)' }}><Spinner /></div>
      ) : resources.length === 0 ? (
        <EmptyState icon={Wrench} title="No resources" description="Add your first resource to get started." />
      ) : (
        <>
          {/* Active Resources Table */}
          <ResourceTable
            title="Active"
            badge={{ text: `${active.length} assigned`, color: 'var(--success)', bg: 'rgba(74,222,128,0.12)' }}
            resources={active}
            emptyText="No active resources right now."
          />

          {/* On Bench Table */}
          <ResourceTable
            title="On Bench"
            badge={{ text: `${bench.length} unassigned`, color: 'var(--danger)', bg: 'rgba(248,113,113,0.12)' }}
            resources={bench}
            emptyText="Everyone is assigned to a project."
            borderColor="rgba(248,113,113,0.25)"
          />
        </>
      )}

      {showCreate && (
        <CreateResourceModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); qc.invalidateQueries(['resources']) }}
        />
      )}
    </div>
  )
}

function ResourceTable({ title, badge, resources, emptyText, borderColor }) {
  return (
    <div>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</span>
        <span style={{ background: badge.bg, color: badge.color, borderRadius: 'var(--r-full)', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
          {badge.text}
        </span>
      </div>

      <div style={{ background: 'var(--bg-1)', border: `1px solid ${borderColor || 'var(--border)'}`, borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {resources.length === 0 ? (
          <p style={{ padding: 'var(--sp-5)', color: 'var(--text-3)', fontSize: '13px' }}>{emptyText}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Member', 'Department', 'Job Title', 'Active Projects', 'Availability'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < resources.length - 1 ? '1px solid var(--border)' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                      <Avatar name={r.user_detail?.name} src={r.user_detail?.avatar} size={34} role={r.user_detail?.role} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{r.user_detail?.name || '—'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{r.user_detail?.email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-2)' }}>{r.user_detail?.department || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-2)' }}>{r.job_title || '—'}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: badge.color, fontWeight: 600 }}>
                    {r.active_project_count ?? 0}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                      <div style={{ flex: 1, maxWidth: 80, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${r.availability}%`, height: '100%', background: r.availability > 50 ? 'var(--success)' : r.availability > 20 ? 'var(--warning, #f59e0b)' : 'var(--danger)', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>{r.availability}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function CreateResourceModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', job_title: '', department: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      // Step 1 — User create with role=resource
      await authApi.createUser({
        name: form.name,
        email: form.email,
        password: form.password,
        password2: form.password,
        role: 'resource',
        department: form.department,
      })
      onCreated()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="New Resource" width={520}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {error && <div style={{ color: 'var(--danger)', fontSize: '13px', background: 'rgba(248,113,113,0.1)', padding: '8px 12px', borderRadius: 'var(--r-md)' }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          <Input label="Full name" value={form.name} onChange={e => f('name', e.target.value)} required />
          <Input label="Email" type="email" value={form.email} onChange={e => f('email', e.target.value)} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          <Input label="Password" type="password" value={form.password} onChange={e => f('password', e.target.value)} required />
          <Input label="Job title" value={form.job_title} onChange={e => f('job_title', e.target.value)} placeholder="e.g. Frontend Developer" />
        </div>
        <Input label="Department" value={form.department} onChange={e => f('department', e.target.value)} placeholder="e.g. Engineering" />
        <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" loading={loading}>Create Resource</Btn>
        </div>
      </form>
    </Modal>
  )
}

/* ─────────────────────────────────────────────────
   PROFILE PAGE
───────────────────────────────────────────────── */
export function ProfilePage() {
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    department: user?.department || '',
    bio: user?.bio || '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')

  async function saveProfile(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
      const { data } = await authApi.updateMe(fd)
      setUser(data)
      setMsg('Profile updated!')
    } catch (err) {
      setMsg(extractError(err))
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm) { setPwMsg('Passwords do not match'); return }
    setPwSaving(true)
    try {
      await authApi.changePassword({ old_password: pwForm.old_password, new_password: pwForm.new_password })
      setPwMsg('Password changed!')
      setPwForm({ old_password: '', new_password: '', confirm: '' })
    } catch (err) {
      setPwMsg(extractError(err))
    } finally {
      setPwSaving(false)
      setTimeout(() => setPwMsg(''), 3000)
    }
  }

  if (!user) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', maxWidth: 600 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-0.02em' }}>Profile</h1>

      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)', marginBottom: 'var(--sp-6)' }}>
          <Avatar name={user.name} src={user.avatar} size={64} role={user.role} />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem' }}>{user.name}</div>
            <div style={{ color: 'var(--text-2)', fontSize: '13px' }}>{user.email}</div>
            <div style={{ marginTop: 6 }}><Badge>{user.role}</Badge></div>
          </div>
        </div>

        <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <Input label="Department" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
          <Textarea label="Bio" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell your team about yourself…" />
          {msg && <div style={{ fontSize: '12px', color: msg.includes('!') ? 'var(--success)' : 'var(--danger)' }}>{msg}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn type="submit" loading={saving}>Save Changes</Btn>
          </div>
        </form>
      </div>

      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-6)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 'var(--sp-5)', fontSize: '1rem' }}>Change Password</h3>
        <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <Input label="Current password" type="password" value={pwForm.old_password} onChange={e => setPwForm(f => ({ ...f, old_password: e.target.value }))} />
          <Input label="New password" type="password" value={pwForm.new_password} onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} />
          <Input label="Confirm new password" type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
          {pwMsg && <div style={{ fontSize: '12px', color: pwMsg.includes('!') ? 'var(--success)' : 'var(--danger)' }}>{pwMsg}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn type="submit" loading={pwSaving}>Update Password</Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────
   SETTINGS PAGE
───────────────────────────────────────────────── */
export function SettingsPage() {
  const hasPermission = useAuthStore(s => s.hasPermission)
  const qc = useQueryClient()

  const { data: users, isLoading: uLoad } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => authApi.users({ page_size: 200 }).then(r => r.data.results || r.data),
    enabled: hasPermission('access_control'),
  })

  const { data: rolePerms, isLoading: rpLoad } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: () => authApi.rolePermissions().then(r => r.data.results || r.data),
    enabled: hasPermission('access_control'),
  })

  async function toggleStatus(userId) {
    await authApi.toggleStatus(userId)
    qc.invalidateQueries(['users-all'])
  }

  async function changeRole(userId, role) {
    await authApi.changeRole(userId, role)
    qc.invalidateQueries(['users-all'])
  }

  if (!hasPermission('access_control')) {
    return <div style={{ color: 'var(--text-2)', padding: 'var(--sp-8)' }}>You don't have permission to view settings.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-0.02em' }}>Settings</h1>

      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <Users size={16} color="var(--text-2)" />
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>User Management</h3>
        </div>
        {uLoad ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-8)' }}><Spinner /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['User', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(users || []).map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < (users?.length || 0) - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                      <Avatar name={u.name} src={u.avatar} size={28} role={u.role} />
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-2)' }}>{u.email}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                      style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--text-1)', fontSize: '12px', padding: '4px 8px', cursor: 'pointer', outline: 'none' }}>
                      {['admin', 'manager', 'resource', 'client'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge color={u.is_active ? 'var(--success)' : 'var(--text-3)'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <button onClick={() => toggleStatus(u.id)} style={{
                      background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                      cursor: 'pointer', padding: '4px 10px', fontSize: '11px', color: 'var(--text-2)',
                      transition: 'all var(--t-fast)',
                    }}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <NotificationPreferencesSection />

      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <Shield size={16} color="var(--text-2)" />
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>Role Permissions</h3>
        </div>
        {rpLoad ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-8)' }}><Spinner /></div>
        ) : (
          <div style={{ padding: 'var(--sp-5)' }}>
            {(rolePerms || []).map(rp => (
              <div key={rp.id} style={{ marginBottom: 'var(--sp-5)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-3)' }}>{rp.role}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                  {Object.entries(rp.permissions || {}).map(([key, val]) => (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                      background: val ? 'rgba(74,222,128,0.1)' : 'var(--bg-3)',
                      border: `1px solid ${val ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
                      borderRadius: 'var(--r-full)', fontSize: '11px',
                      color: val ? 'var(--success)' : 'var(--text-3)',
                    }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: val ? 'var(--success)' : 'var(--text-3)' }} />
                      {key}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────
   NOTIFICATION PREFERENCES SECTION (used in Settings)
───────────────────────────────────────────────── */
// All notification types — hardcoded to avoid extra API call
const NOTIF_TYPES = [
  { value: 'project_assigned', label: 'Project Assigned' },
  { value: 'status_change',    label: 'Status Change' },
  { value: 'deadline',         label: 'Deadline' },
  { value: 'timeline_complete',label: 'Timeline Complete' },
  { value: 'update',           label: 'Project Update' },
  { value: 'mention',          label: 'Mention' },
]

export function NotificationPreferencesSection() {
  const qc = useQueryClient()

  const { data: resources, isLoading: rLoad } = useQuery({
    queryKey: ['users-resources'],
    queryFn: () => authApi.users({ page_size: 200, role: 'resource' }).then(r => r.data.results || r.data),
  })

  const { data: existingPrefs } = useQuery({
    queryKey: ['notif-prefs'],
    queryFn: () => notificationsApi.listPrefs().then(r => r.data.results || r.data),
  })

  // Build a map: userId → { id, allowed_types }
  const prefsMap = {}
  ;(existingPrefs || []).forEach(p => {
    prefsMap[p.resource] = { id: p.id, allowed_types: p.allowed_types }
  })

  async function toggleType(resourceId, notifType, currentAllowed) {
    const isAllowed = currentAllowed.includes(notifType)
    const newTypes = isAllowed
      ? currentAllowed.filter(t => t !== notifType)
      : [...currentAllowed, notifType]
    const existing = prefsMap[resourceId]
    if (existing?.id) {
      await notificationsApi.updatePrefs(existing.id, { allowed_types: newTypes })
    } else {
      await notificationsApi.createPrefs({ resource: resourceId, allowed_types: newTypes })
    }
    qc.invalidateQueries(['notif-prefs'])
  }

  const resourceList = (resources || []).filter(u => u.role === 'resource')

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <Bell size={16} color="var(--text-2)" />
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>Resource Notification Permissions</h3>
          <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>Control which notifications each resource receives. Admins and managers always receive all notifications.</p>
        </div>
      </div>
      <div style={{ padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
        {rLoad ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-6)' }}><Spinner /></div>
        ) : resourceList.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>No resources found.</p>
        ) : resourceList.map(resource => {
          const prefs = prefsMap[resource.id]
          // Default: all types allowed if no pref record yet
          const allowed = prefs?.allowed_types ?? NOTIF_TYPES.map(t => t.value)
          return (
            <div key={resource.id} style={{ paddingBottom: 'var(--sp-4)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                <Avatar name={resource.name} size={28} role={resource.role} />
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{resource.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{resource.department || 'Resource'}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', paddingLeft: 40 }}>
                {NOTIF_TYPES.map(type => {
                  const on = allowed.includes(type.value)
                  return (
                    <button
                      key={type.value}
                      onClick={() => toggleType(resource.id, type.value, allowed)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', borderRadius: 'var(--r-full)',
                        border: `1px solid ${on ? 'rgba(232,255,71,0.4)' : 'var(--border)'}`,
                        background: on ? 'rgba(232,255,71,0.08)' : 'var(--bg-3)',
                        color: on ? 'var(--accent)' : 'var(--text-3)',
                        fontSize: '11px', fontWeight: on ? 600 : 400,
                        cursor: 'pointer', transition: 'all var(--t-fast)',
                      }}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: on ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0 }} />
                      {type.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
