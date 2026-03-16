import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, FolderKanban, Search, Filter } from 'lucide-react'
import { projectsApi, clientsApi, authApi, resourcesApi } from '@/api/index.js'
import { Btn, Badge, ProgressBar, EmptyState, Modal, Input, Select, Textarea, Spinner } from '@/components/ui/index.jsx'
import { STATUS_COLOR, STATUS_LABEL, PRIORITY_COLOR, PRIORITY_LABEL, formatDate, extractError } from '@/utils/index.js'
import { useAuthStore } from '@/stores/authStore.js'

export default function ProjectsPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const qc        = useQueryClient()
  const hasPermission = useAuthStore(s => s.hasPermission)
  const canCreate = hasPermission('projects')

  // Read URL params — dashboard cards set these
  const params = new URLSearchParams(location.search)
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState(params.get('status') || '')
  const [priorityFilter, setPriorityFilter] = useState(params.get('priority') || '')
  const [overBudgetOnly, setOverBudgetOnly] = useState(params.get('filter') === 'over_budget')
  const [showCreate, setShowCreate]       = useState(false)

  // Sync when URL changes (e.g. clicking dashboard cards)
  useEffect(() => {
    const p = new URLSearchParams(location.search)
    setStatusFilter(p.get('status') || '')
    setPriorityFilter(p.get('priority') || '')
    setOverBudgetOnly(p.get('filter') === 'over_budget')
  }, [location.search])

  const { data, isLoading } = useQuery({
    queryKey: ['projects', search, statusFilter, priorityFilter, overBudgetOnly],
    queryFn: () => projectsApi.list({
      search: search || undefined,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      page_size: 100,
    }).then(r => r.data.results || r.data),
  })

  const allProjects = data || []
  // Client-side over budget filter
  const projects = overBudgetOnly
    ? allProjects.filter(p => p.is_over_budget || (p.spent > p.budget && p.budget > 0))
    : allProjects

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-0.02em' }}>Projects</h1>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', marginTop: 4 }}>{projects.length} total</p>
        </div>
        {canCreate && (
          <Btn icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>New Project</Btn>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…"
            style={{
              width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', color: 'var(--text-0)', fontSize: '13px',
              padding: '8px 12px 8px 32px', outline: 'none',
            }}
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setOverBudgetOnly(false) }} style={filterSelectStyle}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setOverBudgetOnly(false) }} style={filterSelectStyle}>
          <option value="">All priorities</option>
          {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {/* Over budget toggle chip */}
        <button
          onClick={() => { setOverBudgetOnly(o => !o); setStatusFilter(''); setPriorityFilter('') }}
          style={{
            background: overBudgetOnly ? 'rgba(248,113,113,0.15)' : 'var(--bg-2)',
            border: `1px solid ${overBudgetOnly ? 'var(--danger)' : 'var(--border)'}`,
            color: overBudgetOnly ? 'var(--danger)' : 'var(--text-2)',
            borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: '13px',
            cursor: 'pointer', fontWeight: overBudgetOnly ? 600 : 400,
            transition: 'all var(--t-fast)',
          }}>
          ⚠ Over Budget
        </button>
        {/* Active filter indicator */}
        {(statusFilter || priorityFilter || overBudgetOnly || search) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setPriorityFilter(''); setOverBudgetOnly(false) }}
            style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '12px', cursor: 'pointer', padding: '4px 8px' }}>
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--sp-4)' }}>
          {Array.from({ length: 6 }).map((_, i) => <ProjectCardSkeleton key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects found" description="Create your first project to get started." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--sp-4)' }}>
          {projects.map(p => <ProjectCard key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />)}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); qc.invalidateQueries(['projects']) }} />}
    </div>
  )
}

function ProjectCard({ project: p, onClick }) {
  const budgetPct = p.budget > 0 ? Math.min(100, Math.round((p.spent / p.budget) * 100)) : 0
  const isOverBudget = p.is_over_budget || (p.spent > p.budget && p.budget > 0)

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
        padding: 'var(--sp-5)', cursor: 'pointer', transition: 'all var(--t-mid)',
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: 2 }}>{p.client?.name || '—'}</div>
        </div>
        <Badge color={PRIORITY_COLOR[p.priority]}>{PRIORITY_LABEL[p.priority]}</Badge>
      </div>

      {/* Status + dates */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Badge color={STATUS_COLOR[p.status]}>{STATUS_LABEL[p.status]}</Badge>
        {p.end_date && (
          <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Due {formatDate(p.end_date, 'MMM d')}</span>
        )}
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Progress</span>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>{p.progress}%</span>
        </div>
        <ProgressBar value={p.progress} />
      </div>

      {/* Budget */}
      {p.budget > 0 && (
        <div style={{ paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Budget</span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: isOverBudget ? 'var(--danger)' : 'var(--text-2)' }}>
              {budgetPct}%{isOverBudget ? ' OVER' : ''}
            </span>
          </div>
          <ProgressBar value={budgetPct} color={isOverBudget ? 'var(--danger)' : undefined} />
        </div>
      )}

      {/* Resources */}
      {p.resources?.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <div style={{ display: 'flex' }}>
            {p.resources.slice(0, 4).map((r, i) => (
              <div key={r.id} style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--bg-3)', border: '2px solid var(--bg-1)',
                marginLeft: i > 0 ? -8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: 700, color: 'var(--text-2)',
              }}>
                {(r.name || '?')[0].toUpperCase()}
              </div>
            ))}
          </div>
          {p.resources.length > 4 && (
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>+{p.resources.length - 4}</span>
          )}
        </div>
      )}
    </div>
  )
}

function ProjectCardSkeleton() {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ height: 16, background: 'var(--bg-3)', borderRadius: 4, width: '60%', animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, var(--bg-3) 25%, var(--bg-4) 50%, var(--bg-3) 75%)' }} />
      <div style={{ height: 12, background: 'var(--bg-3)', borderRadius: 4, width: '40%', animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, var(--bg-3) 25%, var(--bg-4) 50%, var(--bg-3) 75%)' }} />
      <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 4, animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, var(--bg-3) 25%, var(--bg-4) 50%, var(--bg-3) 75%)' }} />
    </div>
  )
}

function CreateProjectModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', client: '', status: 'planning', priority: 'medium', start_date: '', end_date: '', budget: '' })
  const [selectedResources, setSelectedResources] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: clients } = useQuery({ queryKey: ['clients-all'], queryFn: () => clientsApi.list({ page_size: 200 }).then(r => r.data.results || r.data) })
  const { data: resourcesData } = useQuery({ queryKey: ['resources-dropdown'], queryFn: () => resourcesApi.list({ page_size: 200 }).then(r => r.data.results || r.data) })
  // Only show active resources that are on bench (not assigned to any project)
  const allResources = (resourcesData || []).filter(r => r.user_detail?.is_active && (r.active_project_count ?? 0) === 0)

  function toggleResource(id) {
    setSelectedResources(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = { ...form, budget: form.budget ? parseFloat(form.budget) : 0, resources: selectedResources }
      if (!payload.client) delete payload.client
      if (!payload.start_date) delete payload.start_date
      if (!payload.end_date) delete payload.end_date
      await projectsApi.create(payload)
      onCreated()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Modal open onClose={onClose} title="New Project" width={580}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {error && <div style={{ color: 'var(--danger)', fontSize: '13px', background: 'rgba(248,113,113,0.1)', padding: '8px 12px', borderRadius: 'var(--r-md)' }}>{error}</div>}
        <Input label="Project name" value={form.name} onChange={e => f('name', e.target.value)} required placeholder="e.g. Website Redesign" />
        <Textarea label="Description" value={form.description} onChange={e => f('description', e.target.value)} placeholder="Project overview…" />
        <Select label="Client" value={form.client} onChange={e => f('client', e.target.value)}>
          <option value="">No client</option>
          {(clients || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          <Select label="Status" value={form.status} onChange={e => f('status', e.target.value)}>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select label="Priority" value={form.priority} onChange={e => f('priority', e.target.value)}>
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          <Input label="Start date" type="date" value={form.start_date} onChange={e => f('start_date', e.target.value)} />
          <Input label="End date" type="date" value={form.end_date} onChange={e => f('end_date', e.target.value)} />
        </div>
        <Input label="Budget (USD)" type="number" min="0" value={form.budget} onChange={e => f('budget', e.target.value)} placeholder="0" />

        {/* Resources multi-select */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', marginBottom: 'var(--sp-2)' }}>
            Assign Resources {selectedResources.length > 0 && <span style={{ color: 'var(--accent)' }}>({selectedResources.length} selected)</span>}
          </div>
          {allResources.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-3)', padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 'var(--r-md)' }}>No resources available</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
              {allResources.map(r => {
                const selected = selectedResources.includes(r.user)
                return (
                  <div key={r.user} onClick={() => toggleResource(r.user)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 'var(--r-full)', cursor: 'pointer',
                    border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                    background: selected ? 'var(--accent-dim)' : 'var(--bg-2)',
                    color: selected ? 'var(--accent)' : 'var(--text-2)',
                    fontSize: '12px', fontWeight: selected ? 600 : 400,
                    transition: 'all var(--t-fast)',
                  }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: selected ? 'var(--accent)' : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: selected ? '#0a0a0a' : 'var(--text-3)' }}>
                      {(r.user_detail?.name || '?')[0].toUpperCase()}
                    </div>
                    {r.user_detail?.name}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" loading={loading}>Create Project</Btn>
        </div>
      </form>
    </Modal>
  )
}

const filterSelectStyle = {
  background: 'var(--bg-2)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-md)', color: 'var(--text-1)', fontSize: '13px',
  padding: '8px 12px', outline: 'none', cursor: 'pointer',
}
