import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, GitBranch, CheckCircle, Circle, Edit2, Trash2, X, Save } from 'lucide-react'
import { timelinesApi, projectsApi } from '@/api/index.js'
import { Btn, Badge, ProgressBar, EmptyState, Modal, Input, Select, Textarea, Spinner } from '@/components/ui/index.jsx'
import { STATUS_COLOR, STATUS_LABEL, formatDate, extractError } from '@/utils/index.js'
import { useAuthStore } from '@/stores/authStore.js'

const sel = { width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-1)', fontSize: '13px', padding: '8px 12px', outline: 'none' }

export default function TimelinesPage() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'resource'
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['timelines'],
    queryFn: () => timelinesApi.list({ page_size: 100 }).then(r => r.data.results || r.data),
  })

  const timelines = data || []

  // Group by project id — use project_id or project (raw id)
  const byProject = timelines.reduce((acc, t) => {
    const key = t.project || 'unknown'
    if (!acc[key]) acc[key] = { projectId: t.project, projectName: t.project_name || 'Unknown Project', phases: [] }
    acc[key].phases.push(t)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-0.02em' }}>Timelines</h1>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', marginTop: 4 }}>{timelines.length} phases across {Object.keys(byProject).length} projects</p>
        </div>
        {canEdit && <Btn icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>New Phase</Btn>}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-12)' }}><Spinner size={28} /></div>
      ) : timelines.length === 0 ? (
        <EmptyState icon={GitBranch} title="No timelines yet" description="Create your first project phase to visualize progress." />
      ) : (
        Object.values(byProject).map(({ projectId, projectName, phases }) => (
          <ProjectTimeline
            key={projectId}
            projectName={projectName}
            phases={phases}
            canEdit={canEdit}
            onRefresh={() => qc.invalidateQueries(['timelines'])}
          />
        ))
      )}

      {showCreate && <CreateTimelineModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); qc.invalidateQueries(['timelines']) }} />}
    </div>
  )
}

function ProjectTimeline({ projectName, phases, canEdit, onRefresh }) {
  const [expanded, setExpanded] = useState(true)
  const minDate = phases.reduce((a, p) => p.start_date < a ? p.start_date : a, phases[0]?.start_date || '')
  const maxDate = phases.reduce((a, p) => p.end_date > a ? p.end_date : a, phases[0]?.end_date || '')
  const span = Math.max(1, Math.ceil((new Date(maxDate) - new Date(minDate)) / 86400000))

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', padding: 'var(--sp-4) var(--sp-5)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: expanded ? '1px solid var(--border)' : 'none', textAlign: 'left' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ fontSize: '12px', color: 'var(--text-3)', transform: expanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform var(--t-fast)' }}>▶</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--accent)' }}>{projectName}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>
            {phases.length} phases · {formatDate(minDate)} → {formatDate(maxDate)}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          {phases.filter(p => p.status === 'completed').length}/{phases.length} done
        </div>
      </button>

      {expanded && (
        <div style={{ padding: 'var(--sp-4) var(--sp-5)' }}>
          {/* Gantt */}
          <div style={{ overflowX: 'auto', marginBottom: 'var(--sp-5)' }}>
            <div style={{ minWidth: 600 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                <div />
                <div style={{ position: 'relative', height: 20 }}>
                  <span style={{ position: 'absolute', left: 0, fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{formatDate(minDate, 'MMM d')}</span>
                  <span style={{ position: 'absolute', right: 0, fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{formatDate(maxDate, 'MMM d')}</span>
                </div>
              </div>
              {phases.map(phase => {
                const startOffset = Math.max(0, (new Date(phase.start_date) - new Date(minDate)) / 86400000)
                const duration = phase.duration_days || 1
                const leftPct = (startOffset / span) * 100
                const widthPct = Math.max(2, (duration / span) * 100)
                return (
                  <div key={phase.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 'var(--sp-3)', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phase.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{phase.progress}%</div>
                    </div>
                    <div style={{ position: 'relative', height: 28, background: 'var(--bg-3)', borderRadius: 4 }}>
                      <div style={{ position: 'absolute', left: `${leftPct}%`, width: `${widthPct}%`, height: '100%', borderRadius: 4, background: phase.color || STATUS_COLOR[phase.status] || 'var(--accent)', opacity: phase.status === 'completed' ? 1 : 0.7, overflow: 'hidden', display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
                        <div style={{ height: '100%', width: `${phase.progress}%`, background: 'rgba(255,255,255,0.15)', position: 'absolute', left: 0, top: 0, borderRadius: 4 }} />
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#fff', position: 'relative', zIndex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90%' }}>{phase.name}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Phase list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {phases.map(phase => (
              <PhaseRow key={phase.id} phase={phase} canEdit={canEdit} onRefresh={onRefresh} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PhaseRow({ phase, canEdit, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function startEdit(e) {
    e.stopPropagation()
    setForm({
      name:       phase.name || '',
      status:     phase.status || 'pending',
      progress:   phase.progress ?? 0,
      start_date: phase.start_date || '',
      end_date:   phase.end_date || '',
      description: phase.description || '',
      color:      phase.color || '#6366f1',
    })
    setEditing(true)
    setExpanded(true)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      await timelinesApi.update(phase.id, { ...form, progress: parseInt(form.progress) })
      setEditing(false)
      setForm(null)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  async function deletePhase() {
    await timelinesApi.delete(phase.id)
    onRefresh()
  }

  async function completeMilestone(milestoneId) {
    await timelinesApi.completeMilestone(milestoneId)
    onRefresh()
  }

  return (
    <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: `1px solid ${editing ? 'var(--accent)' : 'var(--border)'}` }}>
      {/* Phase header row */}
      <div
        onClick={() => !editing && setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: '10px 14px', cursor: editing ? 'default' : 'pointer' }}
      >
        <div style={{ width: 10, height: 10, borderRadius: 2, background: form?.color || phase.color || 'var(--accent)', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', minWidth: 0 }}>
          <span style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phase.name}</span>
          <Badge color={STATUS_COLOR[phase.status]}>{STATUS_LABEL[phase.status]}</Badge>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {formatDate(phase.start_date, 'MMM d')} → {formatDate(phase.end_date, 'MMM d')}
          </span>
          <div style={{ width: 80 }}><ProgressBar value={phase.progress} height={3} /></div>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>{phase.progress}%</span>
          {canEdit && !editing && (
            <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
              <button onClick={startEdit}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 3 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                <Edit2 size={12} />
              </button>
              <button onClick={e => { e.stopPropagation(); setShowDelete(true) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 3 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline edit form */}
      {editing && form && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <Input label="Phase Name" value={form.name} onChange={e => f('name', e.target.value)} />
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Status</div>
              <select value={form.status} onChange={e => f('status', e.target.value)} style={sel}>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <Input label="Start Date" type="date" value={form.start_date} onChange={e => f('start_date', e.target.value)} />
            <Input label="End Date" type="date" value={form.end_date} onChange={e => f('end_date', e.target.value)} />
          </div>
          {/* Progress slider */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
              Progress — <span style={{ color: 'var(--accent)' }}>{form.progress}%</span>
            </div>
            <input type="range" min="0" max="100" value={form.progress} onChange={e => f('progress', e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
          </div>
          <Textarea label="Description" value={form.description} onChange={e => f('description', e.target.value)} placeholder="Phase details…" />
          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" size="sm" onClick={() => { setEditing(false); setForm(null) }} icon={<X size={13} />}>Cancel</Btn>
            <Btn size="sm" loading={saving} onClick={saveEdit} icon={<Save size={13} />}>Save</Btn>
          </div>
        </div>
      )}

      {/* Expanded detail view */}
      {!editing && expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

          {/* Description */}
          {phase.description ? (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Description</div>
              <p style={{ fontSize: '13px', color: 'var(--text-1)', lineHeight: 1.7, margin: 0 }}>{phase.description}</p>
            </div>
          ) : null}

          {/* Assignees */}
          {phase.assignee_details?.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Assigned To</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                {phase.assignee_details.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-full)', padding: '4px 10px 4px 6px' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#0a0a0a' }}>
                      {(u.name || '?')[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-1)' }}>{u.name}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'capitalize' }}>{u.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress bar detail */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Progress</div>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>{phase.progress}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${phase.progress}%`, background: phase.color || 'var(--accent)', borderRadius: 99, transition: 'width 0.4s ease' }} />
            </div>
          </div>

          {/* Milestones */}
          {phase.milestones?.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Milestones — {phase.milestones.filter(m => m.completed).length}/{phase.milestones.length} done
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {phase.milestones.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: '6px 10px', background: 'var(--bg-3)', borderRadius: 'var(--r-sm)', border: `1px solid ${m.completed ? 'rgba(74,222,128,0.2)' : 'var(--border)'}` }}>
                    <button
                      onClick={() => !m.completed && canEdit && completeMilestone(m.id)}
                      style={{ background: 'none', border: 'none', cursor: canEdit && !m.completed ? 'pointer' : 'default', padding: 0, lineHeight: 0, color: m.completed ? 'var(--success)' : 'var(--text-3)', flexShrink: 0 }}
                    >
                      {m.completed ? <CheckCircle size={14} /> : <Circle size={14} />}
                    </button>
                    <span style={{ fontSize: '12px', color: m.completed ? 'var(--text-3)' : 'var(--text-1)', textDecoration: m.completed ? 'line-through' : 'none', flex: 1 }}>{m.title}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>Due {formatDate(m.due_date, 'MMM d')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!phase.description && !phase.assignee_details?.length && !phase.milestones?.length && (
            <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>No additional details. Click ✏️ to add description or assignees.</p>
          )}
        </div>
      )}

      {/* Delete confirm */}
      {showDelete && (
        <Modal open onClose={() => setShowDelete(false)} title="Delete Phase" width={400}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
            <p style={{ color: 'var(--text-2)', fontSize: '14px' }}>
              Delete phase <strong style={{ color: 'var(--text-0)' }}>{phase.name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setShowDelete(false)}>Cancel</Btn>
              <Btn onClick={deletePhase} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>Delete Phase</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CreateTimelineModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', project: '', start_date: '', end_date: '', status: 'pending', color: '#6366f1' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { data: projects } = useQuery({ queryKey: ['projects-all'], queryFn: () => projectsApi.list({ page_size: 200 }).then(r => r.data.results || r.data) })
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try { await timelinesApi.create(form); onCreated() }
    catch (err) { setError(extractError(err)) }
    finally { setLoading(false) }
  }

  return (
    <Modal open onClose={onClose} title="New Timeline Phase">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {error && <div style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</div>}
        <Input label="Phase name" value={form.name} onChange={e => f('name', e.target.value)} required />
        <Select label="Project" value={form.project} onChange={e => f('project', e.target.value)} required>
          <option value="">Select project…</option>
          {(projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          <Input label="Start date" type="date" value={form.start_date} onChange={e => f('start_date', e.target.value)} required />
          <Input label="End date" type="date" value={form.end_date} onChange={e => f('end_date', e.target.value)} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          <Select label="Status" value={form.status} onChange={e => f('status', e.target.value)}>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </Select>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Color</label>
            <input type="color" value={form.color} onChange={e => f('color', e.target.value)}
              style={{ width: '100%', height: 36, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', cursor: 'pointer', padding: 2 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" loading={loading}>Create Phase</Btn>
        </div>
      </form>
    </Modal>
  )
}
