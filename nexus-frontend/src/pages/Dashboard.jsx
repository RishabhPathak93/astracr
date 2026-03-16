import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban, Building2, TrendingUp, Clock, CheckCircle2, AlertTriangle, CalendarClock, Bell, Users } from 'lucide-react'
import { projectsApi, clientsApi, resourcesApi, timelinesApi, notificationsApi } from '@/api/index.js'
import { StatCard, ProgressBar, Badge, Skeleton } from '@/components/ui/index.jsx'
import { STATUS_COLOR, STATUS_LABEL, PRIORITY_COLOR, PRIORITY_LABEL, formatDate, timeAgo } from '@/utils/index.js'
import { useAuthStore } from '@/stores/authStore.js'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'

export default function DashboardPage() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager'

  const { data: projects, isLoading: pLoad } = useQuery({
    queryKey: ['projects-summary'],
    queryFn: () => projectsApi.list({ page_size: 100 }).then(r => r.data.results || r.data),
  })
  const { data: clients, isLoading: cLoad } = useQuery({
    queryKey: ['clients-summary'],
    queryFn: () => clientsApi.list({ page_size: 100 }).then(r => r.data.results || r.data),
  })
  const { data: timelines } = useQuery({
    queryKey: ['timelines-dashboard'],
    queryFn: () => timelinesApi.list({ page_size: 200 }).then(r => r.data.results || r.data),
  })
  const { data: resources } = useQuery({
    queryKey: ['resources-dashboard'],
    queryFn: () => resourcesApi.list({ page_size: 100 }).then(r => r.data.results || r.data),
    enabled: isAdminOrManager,
  })
  const { data: recentNotifs } = useQuery({
    queryKey: ['notifications-dashboard'],
    queryFn: () => notificationsApi.list().then(r => r.data.results || r.data),
  })

  const projs = projects || []
  const clts = clients || []
  const phases = timelines || []
  const res = resources || []
  const notifs = (recentNotifs || []).slice(0, 8)

  // ── Derived stats ────────────────────────────────────────
  const byStatus = {
    planning:    projs.filter(p => p.status === 'planning').length,
    in_progress: projs.filter(p => p.status === 'in_progress').length,
    review:      projs.filter(p => p.status === 'review').length,
    completed:   projs.filter(p => p.status === 'completed').length,
    on_hold:     projs.filter(p => p.status === 'on_hold').length,
  }
  const pieData = Object.entries(byStatus).filter(([, v]) => v > 0).map(([k, v]) => ({
    name: STATUS_LABEL[k], value: v, color: STATUS_COLOR[k],
  }))
  const overBudget   = projs.filter(p => p.is_over_budget || (p.spent > p.budget && p.budget > 0))
  const highPriority = projs.filter(p => p.priority === 'high' && p.status !== 'completed')
  const avgProgress  = projs.length ? Math.round(projs.reduce((a, p) => a + (p.progress || 0), 0) / projs.length) : 0
  const recentProjects = [...projs].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 6)

  // ── Real chart 1: Progress area chart — each project as a data point over their timeline ─────
  // Show projects sorted by end_date with their progress
  const progressChartData = [...projs]
    .filter(p => p.end_date)
    .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))
    .slice(0, 8)
    .map(p => ({
      name: p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name,
      progress: p.progress || 0,
      target: 100,
      color: STATUS_COLOR[p.status],
    }))

  // ── Real chart 2: Phase completion by month (last 6 months) ──
  const now = new Date()
  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    return { label: d.toLocaleString('default', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() }
  })
  const phaseByMonth = monthLabels.map(({ label, year, month }) => {
    const total     = phases.filter(p => { const d = new Date(p.start_date); return d.getFullYear() === year && d.getMonth() === month }).length
    const completed = phases.filter(p => { const d = new Date(p.end_date); return p.status === 'completed' && d.getFullYear() === year && d.getMonth() === month }).length
    return { month: label, total, completed }
  })

  // ── Real chart 3: Resource utilization ──────────────────
  const resChartData = [
    { name: 'Active',   value: res.filter(r => (r.active_project_count || 0) > 0).length,  color: 'var(--success)' },
    { name: 'On Bench', value: res.filter(r => (r.active_project_count || 0) === 0).length, color: 'var(--accent)' },
  ].filter(d => d.value > 0)

  // ── Upcoming deadlines (projects + phases ending in 7 days) ──
  const today = new Date(); today.setHours(0,0,0,0)
  const in7   = new Date(today); in7.setDate(today.getDate() + 7)

  const deadlineProjects = projs
    .filter(p => p.end_date && p.status !== 'completed')
    .map(p => ({ ...p, _type: 'project', _date: new Date(p.end_date) }))
    .filter(p => p._date >= today && p._date <= in7)

  const deadlinePhases = phases
    .filter(p => p.end_date && p.status !== 'completed')
    .map(p => ({ ...p, _type: 'phase', _date: new Date(p.end_date) }))
    .filter(p => p._date >= today && p._date <= in7)

  const allDeadlines = [...deadlineProjects, ...deadlinePhases]
    .sort((a, b) => a._date - b._date)

  const isDueToday = (d) => d.toDateString() === today.toDateString()
  const isDueTomorrow = (d) => { const t = new Date(today); t.setDate(t.getDate()+1); return d.toDateString() === t.toDateString() }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-8)' }}>

      {/* Greeting */}
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Good {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}.
        </h1>
        <p style={{ color: 'var(--text-2)', marginTop: 4, fontSize: '14px' }}>
          Here's what's happening across your workspace.
        </p>
      </div>

      {/* Stat cards — clickable */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
        <StatCard label="Total Projects" value={pLoad ? '—' : projs.length} icon={FolderKanban} accent="var(--info)" sub={`${byStatus.in_progress} in progress`} onClick={() => navigate('/projects')} />
        <StatCard label="Clients" value={cLoad ? '—' : clts.length} icon={Building2} accent="var(--accent)" sub={`${clts.filter(c => c.status === 'active').length} active`} onClick={() => navigate('/clients')} />
        <StatCard label="Avg Progress" value={pLoad ? '—' : `${avgProgress}%`} icon={TrendingUp} accent="var(--success)" tooltip="Average completion across all active projects" hoverOnly />
        {isAdminOrManager && <StatCard label="Over Budget" value={pLoad ? '—' : overBudget.length} icon={AlertTriangle} accent="var(--danger)" sub={overBudget.length > 0 ? 'Needs attention' : 'All clear'} onClick={() => navigate('/projects?filter=over_budget')} />}
        <StatCard label="High Priority" value={pLoad ? '—' : highPriority.length} icon={Clock} accent="var(--warning)" sub="Active projects" onClick={() => navigate('/projects?priority=high')} />
        <StatCard label="Completed" value={pLoad ? '—' : byStatus.completed} icon={CheckCircle2} accent="var(--success)" onClick={() => navigate('/projects?status=completed')} />
      </div>

      {/* Upcoming Deadlines — collapsed after 3 */}
      {allDeadlines.length > 0 && <DeadlineSection deadlines={allDeadlines} isDueToday={isDueToday} isDueTomorrow={isDueTomorrow} navigate={navigate} />}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--sp-6)' }}>

        {/* Chart 1: Project Progress area chart (real data) */}
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-6)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 4, fontSize: '1rem' }}>Project Progress</h3>
          <p style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: 'var(--sp-4)' }}>Completion % across all projects</p>
          {progressChartData.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: '13px', textAlign: 'center', marginTop: 40 }}>No projects yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={progressChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gProgress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gTarget" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, name) => [`${v}%`, name === 'progress' ? 'Progress' : 'Target']}
                />
                <Area type="monotone" dataKey="target"   stroke="#60a5fa" strokeWidth={1} strokeDasharray="4 4" fill="url(#gTarget)"   dot={false} name="target" />
                <Area type="monotone" dataKey="progress" stroke="var(--accent)" strokeWidth={2.5} fill="url(#gProgress)" dot={{ fill: 'var(--accent)', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} name="progress" />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--text-3)' }}>
              <div style={{ width: 16, height: 2, background: 'var(--accent)', borderRadius: 2 }} /> Actual progress
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--text-3)' }}>
              <div style={{ width: 16, height: 2, background: '#60a5fa', borderRadius: 2, borderTop: '1px dashed #60a5fa' }} /> Target (100%)
            </div>
          </div>
        </div>

        {/* By Status pie */}
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-6)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 'var(--sp-5)', fontSize: '1rem' }}>By Status</h3>
          {pLoad ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[80, 60, 50].map((w, i) => <Skeleton key={i} width={`${w}%`} height={14} />)}
            </div>
          ) : pieData.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: '13px', textAlign: 'center', marginTop: 40 }}>No project data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '12px', color: 'var(--text-2)' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{d.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-1)', fontWeight: 500 }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2: Phase activity + Resource utilization */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-6)' }}>

        {/* Chart 2: Phase completion by month (real) */}
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-6)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 4, fontSize: '1rem' }}>Timeline Activity</h3>
          <p style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: 'var(--sp-4)' }}>Phases started vs completed per month</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={phaseByMonth} barGap={2} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" fill="#60a5fa" radius={[3, 3, 0, 0]} name="Started" />
              <Bar dataKey="completed" fill="#4ade80" radius={[3, 3, 0, 0]} name="Completed" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--text-3)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#60a5fa' }} /> Started
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--text-3)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#4ade80' }} /> Completed
            </div>
          </div>
        </div>

        {/* Chart 3: Resource utilization (real) */}
        {isAdminOrManager && (
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-6)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 4, fontSize: '1rem' }}>Resource Utilization</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: 'var(--sp-4)' }}>Active vs on bench</p>
            {resChartData.length === 0 ? (
              <p style={{ color: 'var(--text-3)', fontSize: '13px', textAlign: 'center', marginTop: 40 }}>No resources found</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={resChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                      {resChartData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {resChartData.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-2)', flex: 1 }}>{d.name}</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>{d.value}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 4 }}>
                    {res.length > 0 ? `${Math.round((resChartData.find(d=>d.name==='Active')?.value||0)/res.length*100)}% utilization rate` : ''}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom row: Recent projects + Activity feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 'var(--sp-6)' }}>

        {/* Recent Projects */}
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-5)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>Recent Projects</h3>
            <button onClick={() => navigate('/projects')}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: 'var(--r-md)', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}>
              View all →
            </button>
          </div>
          {pLoad ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3].map(i => <Skeleton key={i} height={60} />)}
            </div>
          ) : recentProjects.length === 0 ? (
            <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: 'var(--sp-8)', fontSize: '14px' }}>No projects yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {recentProjects.map((p, i) => (
                <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 80px', gap: 'var(--sp-4)', alignItems: 'center', padding: '12px 0', cursor: 'pointer', borderBottom: i < recentProjects.length - 1 ? '1px solid var(--border)' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>{p.client_name || p.client_detail?.name || '—'}</div>
                  </div>
                  <Badge color={STATUS_COLOR[p.status]}>{STATUS_LABEL[p.status] || p.status}</Badge>
                  <ProgressBar value={p.progress || 0} showLabel />
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{timeAgo(p.updated_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
            <Bell size={15} color="var(--text-2)" />
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>Recent Activity</h3>
          </div>
          {notifs.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: '13px', textAlign: 'center', padding: 'var(--sp-6)' }}>No recent activity</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
              {notifs.map(n => (
                <div key={n.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.is_read ? 'var(--text-3)' : 'var(--accent)', flexShrink: 0, marginTop: 5 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: n.is_read ? 'var(--text-2)' : 'var(--text-1)', fontWeight: n.is_read ? 400 : 600, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/notifications')}
            style={{ width: '100%', marginTop: 'var(--sp-3)', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '7px', fontSize: '12px', color: 'var(--text-2)', cursor: 'pointer', transition: 'all var(--t-fast)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}>
            View all notifications →
          </button>
        </div>
      </div>

    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function DeadlineSection({ deadlines, isDueToday, isDueTomorrow, navigate }) {
  const [expanded, setExpanded] = React.useState(false)
  const SHOW = 3
  const urgent = deadlines.filter(d => isDueToday(d._date) || isDueTomorrow(d._date))
  const visible = expanded ? deadlines : deadlines.slice(0, SHOW)
  const hidden  = deadlines.length - SHOW

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-5)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
        <CalendarClock size={16} color="var(--danger)" />
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--danger)' }}>Upcoming Deadlines</h3>
        <span style={{ fontSize: '11px', background: 'rgba(248,113,113,0.15)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 'var(--r-full)', fontWeight: 600 }}>
          {deadlines.length} due this week
        </span>
        {urgent.length > 0 && (
          <span style={{ fontSize: '11px', background: 'rgba(248,113,113,0.25)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 'var(--r-full)', fontWeight: 700, marginLeft: 'auto' }}>
            🚨 {urgent.length} urgent
          </span>
        )}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        {visible.map((item) => {
          const isToday    = isDueToday(item._date)
          const isTomorrow = isDueTomorrow(item._date)
          const urgency    = isToday ? 'var(--danger)' : isTomorrow ? 'var(--warning)' : 'var(--text-3)'
          const label      = isToday ? 'DUE TODAY' : isTomorrow ? 'TOMORROW' : item._date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
          return (
            <div key={`${item._type}-${item.id}`}
              onClick={() => item._type === 'project' && navigate(`/projects/${item.id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', padding: '9px 12px', background: isToday ? 'rgba(248,113,113,0.06)' : 'var(--bg-2)', borderRadius: 'var(--r-md)', border: `1px solid ${isToday ? 'rgba(248,113,113,0.2)' : 'var(--border)'}`, cursor: item._type === 'project' ? 'pointer' : 'default', transition: 'background var(--t-fast)' }}
              onMouseEnter={e => { if (item._type === 'project') e.currentTarget.style.background = isToday ? 'rgba(248,113,113,0.1)' : 'var(--bg-3)' }}
              onMouseLeave={e => e.currentTarget.style.background = isToday ? 'rgba(248,113,113,0.06)' : 'var(--bg-2)'}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: urgency, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-3)', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 'var(--r-full)', flexShrink: 0 }}>
                  {item._type === 'phase' ? `phase · ${item.project_name || ''}` : `project · ${item.client_name || item.client_detail?.name || 'No client'}`}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexShrink: 0 }}>
                <div style={{ width: 50, height: 4, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${item.progress || 0}%`, background: urgency === 'var(--text-3)' ? 'var(--accent)' : urgency, borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', minWidth: 28, textAlign: 'right' }}>{item.progress || 0}%</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: urgency, letterSpacing: '0.04em', minWidth: 60, textAlign: 'right' }}>{label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Show more / less */}
      {deadlines.length > SHOW && (
        <button onClick={() => setExpanded(e => !e)}
          style={{ width: '100%', marginTop: 'var(--sp-3)', background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--r-md)', padding: '7px', fontSize: '12px', color: 'var(--text-3)', cursor: 'pointer', transition: 'all var(--t-fast)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)' }}>
          {expanded ? '▲ Show less' : `▼ Show ${hidden} more deadline${hidden !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  )
}
