import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Upload, FileText, MessageSquare, Users, Calendar, DollarSign, TrendingUp, Edit2, Trash2, X, Save, Building2, GitBranch, CheckCircle, Circle } from 'lucide-react'
import { projectsApi, authApi, clientsApi, resourcesApi, timelinesApi } from '@/api/index.js'
import { Btn, Badge, ProgressBar, Tabs, Modal, Input, Textarea, Spinner, Avatar } from '@/components/ui/index.jsx'
import { STATUS_COLOR, STATUS_LABEL, PRIORITY_COLOR, PRIORITY_LABEL, formatDate, formatCurrency, formatBytes, timeAgo, extractError } from '@/utils/index.js'
import { useAuthStore } from '@/stores/authStore.js'

const TABS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'timelines',  label: 'Timelines', icon: GitBranch },
  { id: 'updates',    label: 'Updates',   icon: MessageSquare },
  { id: 'documents',  label: 'Documents', icon: FileText },
  { id: 'team',       label: 'Team',      icon: Users },
]

const sel = { width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-1)', fontSize: '13px', padding: '8px 12px', outline: 'none' }

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState('overview')
  const [showUpdate, setShowUpdate] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)

  const user = useAuthStore(s => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'resource'

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id).then(r => r.data),
  })

  // For edit dropdowns
  const { data: clients } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => clientsApi.list({ page_size: 200 }).then(r => r.data.results || r.data),
    enabled: editing,
  })
  const { data: managers } = useQuery({
    queryKey: ['managers-list'],
    queryFn: () => authApi.users({ page_size: 200, role: 'manager' }).then(r => r.data.results || r.data),
    enabled: editing,
  })
  const { data: adminsList } = useQuery({
    queryKey: ['admins-list'],
    queryFn: () => authApi.users({ page_size: 200, role: 'admin' }).then(r => r.data.results || r.data),
    enabled: editing,
  })

  function startEdit() {
    const p = project
    setForm({
      name:        p.name || '',
      description: p.description || '',
      client:      p.client || '',
      manager:     p.manager || '',
      status:      p.status || 'planning',
      priority:    p.priority || 'medium',
      start_date:  p.start_date || '',
      end_date:    p.end_date || '',
      budget:      p.budget || '',
      spent:       p.spent || '',
    })
    setEditing(true)
    setError('')
  }

  async function saveEdit() {
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, budget: form.budget ? parseFloat(form.budget) : 0, spent: form.spent ? parseFloat(form.spent) : 0 }
      if (!payload.client) delete payload.client
      if (!payload.manager) delete payload.manager
      await projectsApi.update(id, payload)
      await qc.invalidateQueries(['project', id])
      await qc.invalidateQueries(['projects'])
      setEditing(false)
      setForm(null)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  async function deleteProject() {
    try {
      await projectsApi.delete(id)
      qc.invalidateQueries(['projects'])
      navigate('/projects')
    } catch (err) {
      setError(extractError(err))
    }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-16)' }}>
      <Spinner size={32} />
    </div>
  )
  if (!project) return <div style={{ color: 'var(--text-2)' }}>Project not found.</div>

  const p = project
  const managerOptions = [...(adminsList || []), ...(managers || [])]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>

      {/* Back */}
      <button onClick={() => navigate('/projects')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', width: 'fit-content' }}>
        <ArrowLeft size={14} /> Back to Projects
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 6 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-0.02em' }}>{p.name}</h1>
            <Badge color={STATUS_COLOR[p.status]}>{STATUS_LABEL[p.status]}</Badge>
            <Badge color={PRIORITY_COLOR[p.priority]}>{PRIORITY_LABEL[p.priority]}</Badge>
          </div>
          <div style={{ color: 'var(--text-2)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {p.client_detail?.name
              ? <><Building2 size={12} /><span style={{ color: 'var(--accent)' }}>{p.client_detail.name}</span> · </>
              : <span style={{ color: 'var(--text-3)' }}>No client · </span>
            }
            Managed by {p.manager_detail?.name || <span style={{ color: 'var(--danger)', fontSize: '12px' }}>⚠ No manager assigned</span>}
          </div>
        </div>

        {canEdit && !editing && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <Btn variant="ghost" size="sm" onClick={() => setShowUpdate(true)} icon={<Plus size={14} />}>Add Update</Btn>
            <Btn variant="ghost" size="sm" onClick={startEdit} icon={<Edit2 size={14} />}>Edit</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setShowDelete(true)}
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              icon={<Trash2 size={14} />}>Delete</Btn>
          </div>
        )}
        {canEdit && editing && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <Btn variant="ghost" size="sm" onClick={() => { setEditing(false); setForm(null) }} icon={<X size={14} />}>Cancel</Btn>
            <Btn size="sm" loading={saving} onClick={saveEdit} icon={<Save size={14} />}>Save Changes</Btn>
          </div>
        )}
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: '13px', background: 'rgba(248,113,113,0.1)', padding: '10px 14px', borderRadius: 'var(--r-md)' }}>{error}</div>}

      {/* Edit Form */}
      {editing && form && (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--accent)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Editing Project</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <Input label="Project Name" value={form.name} onChange={e => f('name', e.target.value)} required />
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Client</div>
              <select value={form.client} onChange={e => f('client', e.target.value)} style={sel}>
                <option value="">No client</option>
                {(clients || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Status</div>
              <select value={form.status} onChange={e => f('status', e.target.value)} style={sel}>
                <option value="planning">Planning</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Priority</div>
              <select value={form.priority} onChange={e => f('priority', e.target.value)} style={sel}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Manager</div>
            <select value={form.manager} onChange={e => f('manager', e.target.value)} style={sel}>
              <option value="">No manager</option>
              {managerOptions.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <Input label="Start Date" type="date" value={form.start_date} onChange={e => f('start_date', e.target.value)} />
            <Input label="End Date" type="date" value={form.end_date} onChange={e => f('end_date', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <Input label="Budget (USD)" type="number" min="0" value={form.budget} onChange={e => f('budget', e.target.value)} placeholder="0" />
            <Input label="Spent (USD)" type="number" min="0" value={form.spent} onChange={e => f('spent', e.target.value)} placeholder="0" />
          </div>
          <Textarea label="Description" value={form.description} onChange={e => f('description', e.target.value)} placeholder="Project overview…" />
        </div>
      )}

      {/* Metric Boxes */}
      {!editing && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--sp-4)' }}>
          <MetricBox icon={Calendar}    label="Start"    value={formatDate(p.start_date)} />
          <MetricBox icon={Calendar}    label="End"      value={formatDate(p.end_date)} />
          <MetricBox icon={DollarSign}  label="Budget"   value={formatCurrency(p.budget)} />
          <MetricBox icon={DollarSign}  label="Spent"    value={formatCurrency(p.spent)}
            accent={p.is_over_budget ? 'var(--danger)' : undefined}
            sub={p.budget > 0 ? `${Math.min(Math.round((p.spent / p.budget) * 100), 100)}% used${p.is_over_budget ? ' — OVER' : ''}` : undefined}
          />
          <MetricBox icon={TrendingUp}  label="Progress" value={`${p.progress}%`} />
          <MetricBox icon={Users}       label="Team"     value={p.resource_details?.length || p.resources?.length || 0} />
        </div>
      )}

      {/* Progress bar — interactive */}
      {!editing && <ProjectProgressBar project={p} canEdit={canEdit} onRefresh={() => qc.invalidateQueries(['project', id])} />}

      {/* Tabs */}
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--sp-4) var(--sp-5) 0', borderBottom: '1px solid var(--border)' }}>
          <Tabs
            tabs={TABS.map(t => ({ ...t, count: t.id === 'updates' ? p.updates?.length : t.id === 'documents' ? p.documents?.length : undefined }))}
            active={tab} onChange={setTab}
          />
        </div>
        <div style={{ padding: 'var(--sp-6)' }}>
          {tab === 'overview'   && <OverviewTab project={p} />}
          {tab === 'timelines'  && <TimelinesTab projectId={p.id} canEdit={canEdit} />}
          {tab === 'updates'    && <UpdatesTab updates={p.updates || []} />}
          {tab === 'documents'  && <DocumentsTab documents={p.documents || []} projectId={p.id} canEdit={canEdit} onRefresh={() => qc.invalidateQueries(['project', id])} />}
          {tab === 'team'       && <TeamTab resources={p.resource_details || []} manager={p.manager_detail} projectId={p.id} canEdit={canEdit} onRefresh={() => { qc.invalidateQueries(['project', id]); qc.invalidateQueries(['resources']) }} />}
        </div>
      </div>

      {/* Delete Confirm */}
      {showDelete && (
        <Modal open onClose={() => setShowDelete(false)} title="Delete Project" width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
            <p style={{ color: 'var(--text-2)', fontSize: '14px' }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text-0)' }}>{p.name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setShowDelete(false)}>Cancel</Btn>
              <Btn onClick={deleteProject} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>Delete Project</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showUpdate && (
        <AddUpdateModal projectId={p.id} onClose={() => setShowUpdate(false)} onDone={() => { setShowUpdate(false); qc.invalidateQueries(['project', id]) }} />
      )}
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────── */

function MetricBox({ icon: Icon, label, value, accent, sub }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={12} color="var(--text-3)" />
        <span style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 600, color: accent || 'var(--text-0)' }}>{value || '—'}</div>
      {sub && <div style={{ fontSize: '10px', color: accent || 'var(--text-3)', fontWeight: accent ? 600 : 400 }}>{sub}</div>}
    </div>
  )
}

function ProjectProgressBar({ project: p, canEdit, onRefresh }) {
  const [localVal, setLocalVal] = useState(p.progress ?? 0)
  const [saving, setSaving]     = useState(false)
  const [dirty, setDirty]       = useState(false)

  React.useEffect(() => { setLocalVal(p.progress ?? 0); setDirty(false) }, [p.progress])

  async function save() {
    setSaving(true)
    try { await projectsApi.updateProgress(p.id, localVal); setDirty(false); onRefresh() }
    finally { setSaving(false) }
  }

  const color = localVal === 100 ? 'var(--success)' : localVal >= 60 ? 'var(--accent)' : localVal >= 30 ? 'var(--warning)' : 'var(--danger)'

  return (
    <div style={{
      background: 'var(--bg-1)',
      border: `1px solid ${dirty ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 'var(--r-lg)', padding: 'var(--sp-5)',
      transition: 'border-color 0.2s',
    }}>
      {/* Label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Overall Progress</span>
          {p.timelines_count > 0 && (
            <span style={{ fontSize: '10px', color: 'var(--text-3)', background: 'var(--bg-3)', padding: '2px 7px', borderRadius: 'var(--r-full)' }}>
              auto-synced from {p.timelines_count} phase{p.timelines_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '22px', fontFamily: 'var(--font-mono)', fontWeight: 800, color }}>{localVal}%</span>
          {dirty && (
            <button onClick={save} disabled={saving}
              style={{
                background: color, border: 'none', borderRadius: 'var(--r-md)',
                color: '#0a0a0a', fontSize: '12px', fontWeight: 700,
                padding: '5px 14px', cursor: 'pointer', transition: 'opacity 0.15s',
                opacity: saving ? 0.6 : 1,
              }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* Single combined bar — shows progress + acts as slider */}
      <div style={{ position: 'relative', height: 20, borderRadius: 99, background: 'var(--bg-3)', overflow: 'hidden', cursor: canEdit ? 'pointer' : 'default' }}>
        {/* Fill */}
        <div style={{ height: '100%', width: `${localVal}%`, background: color, borderRadius: 99, transition: dirty ? 'none' : 'width 0.3s ease', pointerEvents: 'none' }} />
        {/* Invisible range input overlaid */}
        {canEdit && (
          <input type="range" min="0" max="100" value={localVal}
            onChange={e => { setLocalVal(parseInt(e.target.value)); setDirty(true) }}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              opacity: 0, cursor: 'pointer', margin: 0,
            }}
          />
        )}
      </div>
    </div>
  )
}

function OverviewTab({ project: p }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      {p.description && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-2)' }}>Description</div>
          <p style={{ fontSize: '14px', color: 'var(--text-1)', lineHeight: 1.7 }}>{p.description}</p>
        </div>
      )}
      {p.client_detail && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-2)' }}>Client</div>
          <div style={{ fontSize: '14px', color: 'var(--accent)', fontWeight: 600 }}>{p.client_detail.name}</div>
          {p.client_detail.email && <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{p.client_detail.email}</div>}
        </div>
      )}
      {p.tags?.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-2)' }}>Tags</div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            {p.tags.map(tag => (
              <span key={tag} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-full)', padding: '3px 10px', fontSize: '12px', color: 'var(--text-2)' }}>{tag}</span>
            ))}
          </div>
        </div>
      )}
      {!p.description && !p.client_detail && !p.tags?.length && (
        <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>No additional details.</p>
      )}
    </div>
  )
}

function UpdatesTab({ updates }) {
  if (!updates.length) return <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>No updates yet.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {updates.map(u => (
        <div key={u.id} style={{ display: 'flex', gap: 'var(--sp-4)' }}>
          <Avatar name={u.author?.name} size={32} />
          <div style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', padding: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{u.author?.name || 'Unknown'}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{timeAgo(u.created_at)}</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-1)', lineHeight: 1.6 }}>{u.content}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function DocumentsTab({ documents, projectId, canEdit, onRefresh }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', file.name)
    formData.append('project', projectId)
    try {
      await projectsApi.uploadDocument(projectId, formData)
      onRefresh()
    } catch (err) {
      const data = err?.response?.data
      const msg = data?.file?.[0] || data?.name?.[0] || data?.detail || data?.non_field_errors?.[0]
        || (typeof data === 'string' ? data : null)
        || `Upload failed (${err?.response?.status || 'no response'}) — check file type/size`
      setUploadError(msg)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-3)', border: `1px solid ${uploadError ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', padding: '7px 14px', fontSize: '13px', fontWeight: 600, color: 'var(--text-1)', cursor: 'pointer' }}>
            {uploading ? <Spinner size={14} /> : <Upload size={14} />} Upload document
            <input type="file" hidden onChange={handleUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.zip" />
          </label>
          {uploadError && <span style={{ fontSize: '12px', color: 'var(--danger)' }}>{uploadError}</span>}
          {!uploadError && <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>PDF, Word, Excel, images, ZIP</span>}
        </div>
      )}
      {documents.length === 0 ? (
        <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>No documents uploaded.</p>
      ) : documents.map(doc => (
        <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
          <FileText size={16} color="var(--text-3)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{formatBytes(doc.file_size)} · {timeAgo(doc.uploaded_at)}</div>
          </div>
          {(doc.file_url || doc.file) && <a href={doc.file_url || doc.file} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}>Download</a>}
        </div>
      ))}
    </div>
  )
}

function TeamTab({ resources, manager, projectId, canEdit, onRefresh }) {
  const [showAssign, setShowAssign] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {manager && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-3)' }}>Project Manager</div>
          <TeamMemberRow user={manager} />
        </div>
      )}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Resources ({resources.length})</div>
          {canEdit && <Btn size="sm" variant="secondary" icon={<Plus size={12} />} onClick={() => setShowAssign(true)}>Assign</Btn>}
        </div>
        {resources.length === 0
          ? <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>No resources assigned.</p>
          : resources.map(r => <TeamMemberRow key={r.id} user={r} projectId={canEdit ? projectId : null} onRemove={canEdit ? onRefresh : null} />)
        }
      </div>
      {showAssign && <AssignResourceModal projectId={projectId} assignedIds={resources.map(r => r.id)} onClose={() => setShowAssign(false)} onDone={() => { setShowAssign(false); onRefresh() }} />}
    </div>
  )
}

function TeamMemberRow({ user, projectId, onRemove }) {
  const [removing, setRemoving] = useState(false)
  async function handleRemove() {
    if (!projectId || !onRemove) return
    setRemoving(true)
    try { await projectsApi.removeResource(projectId, user.id); onRemove() } finally { setRemoving(false) }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <Avatar name={user.name} src={user.avatar} size={36} role={user.role} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-0)' }}>{user.name || '—'}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'capitalize' }}>{user.role || 'Member'}{user.department ? ` · ${user.department}` : ''}</div>
      </div>
      {projectId && onRemove && (
        <button onClick={handleRemove} disabled={removing}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', padding: '3px 8px', fontSize: '11px', color: 'var(--text-3)', transition: 'all var(--t-fast)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)' }}>
          {removing ? '…' : 'Remove'}
        </button>
      )}
    </div>
  )
}

function AssignResourceModal({ projectId, assignedIds, onClose, onDone }) {
  const [loading, setLoading] = useState(false)
  const { data } = useQuery({
    queryKey: ['resources-assign'],
    queryFn: () => resourcesApi.list({ page_size: 200 }).then(r => r.data.results || r.data),
  })
  const available = (data || []).filter(r => r.user_detail?.is_active && !assignedIds.includes(r.user_detail?.id))

  async function assign(userId) {
    setLoading(true)
    try { await projectsApi.assignResource(projectId, userId); onDone() } finally { setLoading(false) }
  }

  return (
    <Modal open onClose={onClose} title="Assign Resource" width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {available.length === 0
          ? <div style={{ color: 'var(--text-3)', fontSize: '13px', textAlign: 'center', padding: 'var(--sp-6)' }}>All resources already assigned</div>
          : available.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-2)' }}>
              <Avatar name={r.user_detail?.name} size={34} role="resource" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{r.user_detail?.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{r.job_title || 'No title'}</div>
              </div>
              <Btn size="sm" loading={loading} onClick={() => assign(r.user_detail?.id)}>Assign</Btn>
            </div>
          ))
        }
      </div>
    </Modal>
  )
}

function AddUpdateModal({ projectId, onClose, onDone }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    try { await projectsApi.addUpdate(projectId, { content }); onDone() }
    catch (err) { setError(extractError(err)) }
    finally { setLoading(false) }
  }
  return (
    <Modal open onClose={onClose} title="Add Project Update">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {error && <div style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</div>}
        <Textarea label="Update" value={content} onChange={e => setContent(e.target.value)} placeholder="What's the latest on this project?" style={{ minHeight: 120 }} required />
        <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" loading={loading}>Post Update</Btn>
        </div>
      </form>
    </Modal>
  )
}

// ─── Timelines Tab ──────────────────────────────────────────────────────────
const sel2 = { width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-1)', fontSize: '13px', padding: '8px 12px', outline: 'none' }

function TimelinesTab({ projectId, canEdit }) {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editPhase, setEditPhase] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['timelines-project', projectId],
    queryFn: () => timelinesApi.list({ project: projectId, page_size: 100 }).then(r => r.data.results || r.data),
  })

  const phases = data || []
  const ef = (k, v) => setEditForm(p => ({ ...p, [k]: v }))

  function startEdit(phase) {
    setEditPhase(phase.id)
    setEditForm({ name: phase.name, status: phase.status, progress: phase.progress ?? 0, start_date: phase.start_date || '', end_date: phase.end_date || '', description: phase.description || '' })
  }

  async function saveEdit(phaseId) {
    setSaving(true)
    try {
      await timelinesApi.update(phaseId, { ...editForm, progress: parseInt(editForm.progress) })
      setEditPhase(null)
      qc.invalidateQueries(['timelines-project', projectId])
      qc.invalidateQueries(['project', String(projectId)])
    } finally { setSaving(false) }
  }

  async function deletePhase(phaseId) {
    if (!window.confirm('Delete this phase?')) return
    await timelinesApi.delete(phaseId)
    qc.invalidateQueries(['timelines-project', projectId])
    qc.invalidateQueries(['project', String(projectId)])
  }

  async function completeMilestone(milestoneId, phaseId) {
    await timelinesApi.completeMilestone(milestoneId)
    qc.invalidateQueries(['timelines-project', projectId])
  }

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={24} /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>{phases.length} phase{phases.length !== 1 ? 's' : ''} · {phases.filter(p => p.status === 'completed').length} completed</div>
        {canEdit && <Btn size="sm" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Phase</Btn>}
      </div>

      {phases.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-3)', fontSize: '13px' }}>
          No timeline phases yet.{canEdit ? ' Click "Add Phase" to create one.' : ''}
        </div>
      ) : (
        phases.map(phase => {
          const isEditing = editPhase === phase.id
          return (
            <div key={phase.id} style={{ background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: `1px solid ${isEditing ? 'var(--accent)' : 'var(--border)'}`, overflow: 'hidden' }}>
              {/* Phase header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: '12px 14px' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: phase.color || 'var(--accent)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{phase.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>
                    {formatDate(phase.start_date)} → {formatDate(phase.end_date)}
                    {phase.assignee_details?.length > 0 && ` · ${phase.assignee_details.map(a => a.name).join(', ')}`}
                  </div>
                </div>
                <Badge color={STATUS_COLOR[phase.status]}>{STATUS_LABEL[phase.status]}</Badge>
                {/* Progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--bg-3)', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${phase.progress}%`, background: phase.color || 'var(--accent)', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600, minWidth: 30, textAlign: 'right' }}>{phase.progress}%</span>
                </div>
                {canEdit && !isEditing && (
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => startEdit(phase)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => deletePhase(phase.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Description */}
              {!isEditing && phase.description && (
                <div style={{ padding: '0 14px 10px', fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6 }}>{phase.description}</div>
              )}

              {/* Inline edit form */}
              {isEditing && editForm && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '14px', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
                    <Input label="Phase Name" value={editForm.name} onChange={e => ef('name', e.target.value)} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Status</div>
                      <select value={editForm.status} onChange={e => ef('status', e.target.value)} style={sel2}>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="on_hold">On Hold</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
                    <Input label="Start Date" type="date" value={editForm.start_date} onChange={e => ef('start_date', e.target.value)} />
                    <Input label="End Date" type="date" value={editForm.end_date} onChange={e => ef('end_date', e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                      Progress — <span style={{ color: 'var(--accent)' }}>{editForm.progress}% complete</span>
                    </div>
                    <input type="range" min="0" max="100" value={editForm.progress}
                      onChange={e => ef('progress', e.target.value)}
                      style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  </div>
                  <Textarea label="Description" value={editForm.description} onChange={e => ef('description', e.target.value)} placeholder="Phase details…" />
                  <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end' }}>
                    <Btn variant="ghost" size="sm" onClick={() => setEditPhase(null)} icon={<X size={13} />}>Cancel</Btn>
                    <Btn size="sm" loading={saving} onClick={() => saveEdit(phase.id)} icon={<Save size={13} />}>Save & Sync Progress</Btn>
                  </div>
                </div>
              )}

              {/* Milestones */}
              {!isEditing && phase.milestones?.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px 12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Milestones — {phase.milestones.filter(m => m.completed).length}/{phase.milestones.length}
                  </div>
                  {phase.milestones.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                      <button onClick={() => !m.completed && canEdit && completeMilestone(m.id, phase.id)}
                        style={{ background: 'none', border: 'none', cursor: !m.completed && canEdit ? 'pointer' : 'default', padding: 0, color: m.completed ? 'var(--success)' : 'var(--text-3)' }}>
                        {m.completed ? <CheckCircle size={13} /> : <Circle size={13} />}
                      </button>
                      <span style={{ fontSize: '12px', flex: 1, textDecoration: m.completed ? 'line-through' : 'none', color: m.completed ? 'var(--text-3)' : 'var(--text-1)' }}>{m.title}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>Due {formatDate(m.due_date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}

      {showCreate && (
        <CreatePhaseModal projectId={projectId} onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); qc.invalidateQueries(['timelines-project', projectId]) }} />
      )}
    </div>
  )
}

function CreatePhaseModal({ projectId, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', status: 'pending', color: '#6366f1', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try { await timelinesApi.create({ ...form, project: projectId }); onCreated() }
    catch (err) { setError(extractError(err)) }
    finally { setLoading(false) }
  }
  return (
    <Modal open onClose={onClose} title="Add Timeline Phase">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {error && <div style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</div>}
        <Input label="Phase name" value={form.name} onChange={e => f('name', e.target.value)} required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
          <Input label="Start date" type="date" value={form.start_date} onChange={e => f('start_date', e.target.value)} required />
          <Input label="End date" type="date" value={form.end_date} onChange={e => f('end_date', e.target.value)} required />
        </div>
        <Textarea label="Description" value={form.description} onChange={e => f('description', e.target.value)} placeholder="What does this phase cover?" />
        <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" loading={loading}>Create Phase</Btn>
        </div>
      </form>
    </Modal>
  )
}
