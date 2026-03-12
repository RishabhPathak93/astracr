import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Briefcase, User, Mail, Phone, Globe, MapPin, Edit2, Trash2, Plus, X, Save } from 'lucide-react'
import { clientsApi, projectsApi } from '@/api/index.js'
import { Btn, Badge, Tabs, Spinner, Input, Textarea, Modal } from '@/components/ui/index.jsx'
import { STATUS_COLOR, STATUS_LABEL, PRIORITY_COLOR, PRIORITY_LABEL, formatDate, timeAgo, extractError } from '@/utils/index.js'
import { useAuthStore } from '@/stores/authStore.js'

const CLIENT_STATUS_COLOR = {
  active: 'var(--success)',
  prospect: 'var(--info)',
  inactive: 'var(--text-3)',
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'projects', label: 'Projects', icon: Briefcase },
  { id: 'contacts', label: 'Contacts', icon: User },
]

export default function ClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)

  const user = useAuthStore(s => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'manager'

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientsApi.get(id).then(r => r.data),
  })

  const { data: allProjects } = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => projectsApi.list({ page_size: 200 }).then(r => r.data.results || r.data),
    enabled: editing,
  })

  const { data: clientProjects } = useQuery({
    queryKey: ['client-projects', id],
    queryFn: () => clientsApi.getProjects(id).then(r => r.data),
    enabled: tab === 'projects',
  })

  function startEdit() {
    setForm({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      industry: client.industry || '',
      address: client.address || '',
      contact_person: client.contact_person || '',
      website: client.website || '',
      notes: client.notes || '',
      status: client.status || 'active',
      linkedProjects: [],  // will be populated when allProjects loads
    })
    setEditing(true)
    setError('')
  }

  function cancelEdit() {
    setEditing(false)
    setForm(null)
    setError('')
  }

  async function saveEdit() {
    setSaving(true)
    setError('')
    try {
      const { linkedProjects, ...clientData } = form
      await clientsApi.update(id, clientData)
      // Update client field on each linked project
      if (linkedProjects && linkedProjects.length > 0) {
        await Promise.all(linkedProjects.map(pid => projectsApi.update(pid, { client: parseInt(id) })))
      }
      await qc.invalidateQueries(['client', id])
      await qc.invalidateQueries(['clients'])
      await qc.invalidateQueries(['client-projects', id])
      setEditing(false)
      setForm(null)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  async function deleteClient() {
    try {
      await clientsApi.delete(id)
      qc.invalidateQueries(['clients'])
      navigate('/clients')
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

  if (!client) return <div style={{ color: 'var(--text-2)' }}>Client not found.</div>

  const c = editing ? { ...client, ...form } : client

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>

      {/* Back */}
      <button onClick={() => navigate('/clients')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', width: 'fit-content' }}>
        <ArrowLeft size={14} /> Back to Clients
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name}
              style={{ width: 56, height: 56, borderRadius: 'var(--r-lg)', objectFit: 'cover', border: '1px solid var(--border)' }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 'var(--r-lg)', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)', border: '1px solid var(--border)' }}>
              {client.name[0].toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 4 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-0.02em' }}>{client.name}</h1>
              <Badge color={CLIENT_STATUS_COLOR[client.status]}>{client.status}</Badge>
            </div>
            <div style={{ color: 'var(--text-2)', fontSize: '14px' }}>
              {client.industry || 'No industry'} · Added {timeAgo(client.onboarded_at)}
            </div>
          </div>
        </div>

        {canEdit && !editing && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <Btn variant="ghost" size="sm" onClick={startEdit} icon={<Edit2 size={14} />}>Edit</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)}
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              icon={<Trash2 size={14} />}>Delete</Btn>
          </div>
        )}

        {canEdit && editing && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <Btn variant="ghost" size="sm" onClick={cancelEdit} icon={<X size={14} />}>Cancel</Btn>
            <Btn size="sm" loading={saving} onClick={saveEdit} icon={<Save size={14} />}>Save Changes</Btn>
          </div>
        )}
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: '13px', background: 'rgba(248,113,113,0.1)', padding: '10px 14px', borderRadius: 'var(--r-md)' }}>{error}</div>}

      {/* Edit Form */}
      {editing && form && (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--accent)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Editing Client</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <Input label="Client Name" value={form.name} onChange={e => f('name', e.target.value)} required />
            <Input label="Email" type="email" value={form.email} onChange={e => f('email', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <Input label="Phone" value={form.phone} onChange={e => f('phone', e.target.value)} />
            <Input label="Industry" value={form.industry} onChange={e => f('industry', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <Input label="Contact Person" value={form.contact_person} onChange={e => f('contact_person', e.target.value)} />
            <Input label="Website" value={form.website} onChange={e => f('website', e.target.value)} placeholder="https://" />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Status</div>
            <select value={form.status} onChange={e => f('status', e.target.value)}
              style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-1)', fontSize: '13px', padding: '8px 12px', outline: 'none' }}>
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <Textarea label="Address" value={form.address} onChange={e => f('address', e.target.value)} placeholder="Full address…" />
          <Textarea label="Notes" value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Internal notes about this client…" />

          {/* Link Projects */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
              Linked Projects <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(click to toggle)</span>
            </div>
            {(allProjects || []).length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>No projects available.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                {(allProjects || []).map(p => {
                  const linked = (form.linkedProjects || []).includes(p.id)
                  return (
                    <button key={p.id} type="button"
                      onClick={() => {
                        const cur = form.linkedProjects || []
                        f('linkedProjects', linked ? cur.filter(x => x !== p.id) : [...cur, p.id])
                      }}
                      style={{
                        padding: '5px 12px', borderRadius: 'var(--r-full)', fontSize: '12px', cursor: 'pointer',
                        border: `1px solid ${linked ? 'rgba(232,255,71,0.4)' : 'var(--border)'}`,
                        background: linked ? 'rgba(232,255,71,0.08)' : 'var(--bg-3)',
                        color: linked ? 'var(--accent)' : 'var(--text-3)',
                        fontWeight: linked ? 600 : 400, transition: 'all var(--t-fast)',
                      }}>{p.name}</button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metric Boxes — read-only view */}
      {!editing && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--sp-4)' }}>
          <MetricBox icon={Mail} label="Email" value={c.email} />
          <MetricBox icon={Phone} label="Phone" value={c.phone} />
          <MetricBox icon={Globe} label="Website" value={c.website ? c.website.replace(/^https?:\/\//, '') : null} />
          <MetricBox icon={User} label="Contact" value={c.contact_person} />
          <MetricBox icon={Briefcase} label="Projects" value={c.project_count ?? '—'} />
          <MetricBox icon={MapPin} label="Address" value={c.address} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--sp-4) var(--sp-5) 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Tabs
            tabs={TABS.map(t => ({
              ...t,
              count: t.id === 'projects' ? c.project_count : t.id === 'contacts' ? c.contacts?.length : undefined
            }))}
            active={tab}
            onChange={setTab}
          />
          {canEdit && tab === 'contacts' && (
            <Btn size="sm" onClick={() => setShowAddContact(true)} icon={<Plus size={13} />} style={{ marginBottom: 'var(--sp-2)' }}>
              Add Contact
            </Btn>
          )}
        </div>
        <div style={{ padding: 'var(--sp-6)' }}>
          {tab === 'overview' && <OverviewTab client={c} />}
          {tab === 'projects' && <ProjectsTab projects={clientProjects} navigate={navigate} />}
          {tab === 'contacts' && (
            <ContactsTab
              contacts={c.contacts || []}
              clientId={id}
              canEdit={canEdit}
              onRefresh={() => qc.invalidateQueries(['client', id])}
            />
          )}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <Modal open onClose={() => setShowDeleteConfirm(false)} title="Delete Client" width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
            <p style={{ color: 'var(--text-2)', fontSize: '14px' }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text-0)' }}>{client.name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Btn>
              <Btn onClick={deleteClient} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>Delete Client</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <AddContactModal
          clientId={id}
          onClose={() => setShowAddContact(false)}
          onSaved={() => { qc.invalidateQueries(['client', id]); setShowAddContact(false) }}
        />
      )}

    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────── */

function MetricBox({ icon: Icon, label, value }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={12} color="var(--text-3)" />
        <span style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value || '—'}
      </div>
    </div>
  )
}

function OverviewTab({ client: c }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      {c.notes && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-2)' }}>Notes</div>
          <p style={{ fontSize: '14px', color: 'var(--text-1)', lineHeight: 1.7 }}>{c.notes}</p>
        </div>
      )}
      {c.address && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-2)' }}>Address</div>
          <p style={{ fontSize: '14px', color: 'var(--text-1)', lineHeight: 1.7 }}>{c.address}</p>
        </div>
      )}
      {!c.notes && !c.address && (
        <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>No additional details.</p>
      )}
    </div>
  )
}

function ProjectsTab({ projects, navigate }) {
  if (!projects) return <div style={{ color: 'var(--text-3)', fontSize: '14px' }}>Loading projects…</div>
  if (!projects.length) return <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>No projects linked to this client.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      {projects.map(p => (
        <div key={p.id}
          onClick={() => navigate(`/projects/${p.id}`)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sp-4)', background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'background var(--t-fast)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-2)'}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: 3 }}>{p.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
              {p.start_date ? formatDate(p.start_date) : '—'} → {p.end_date ? formatDate(p.end_date) : '—'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <Badge color={STATUS_COLOR[p.status]}>{STATUS_LABEL[p.status] || p.status}</Badge>
            <Badge color={PRIORITY_COLOR[p.priority]}>{PRIORITY_LABEL[p.priority] || p.priority}</Badge>
          </div>
        </div>
      ))}
    </div>
  )
}

function ContactsTab({ contacts, clientId, canEdit, onRefresh }) {
  const [deletingId, setDeletingId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  async function deleteContact(contactId) {
    setDeletingId(contactId)
    try {
      await clientsApi.deleteContact(contactId)
      onRefresh()
    } finally {
      setDeletingId(null)
    }
  }

  function startEditContact(contact) {
    setEditingId(contact.id)
    setEditForm({ name: contact.name, email: contact.email || '', phone: contact.phone || '', position: contact.position || '', is_primary: contact.is_primary || false })
  }

  async function saveContact() {
    setSaving(true)
    try {
      await clientsApi.updateContact(editingId, editForm)
      setEditingId(null)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const ef = (k, v) => setEditForm(p => ({ ...p, [k]: v }))

  if (!contacts.length) return <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>No contacts added.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      {contacts.map(contact => (
        <div key={contact.id} style={{ background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: `1px solid ${editingId === contact.id ? 'var(--accent)' : 'var(--border)'}`, overflow: 'hidden' }}>
          {editingId === contact.id ? (
            <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
                <Input label="Name" value={editForm.name} onChange={e => ef('name', e.target.value)} />
                <Input label="Position" value={editForm.position} onChange={e => ef('position', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
                <Input label="Email" type="email" value={editForm.email} onChange={e => ef('email', e.target.value)} />
                <Input label="Phone" value={editForm.phone} onChange={e => ef('phone', e.target.value)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '13px', color: 'var(--text-2)' }}>
                  <input type="checkbox" checked={editForm.is_primary} onChange={e => ef('is_primary', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                  Primary contact
                </label>
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <Btn variant="ghost" size="sm" onClick={() => setEditingId(null)}><X size={13} /></Btn>
                  <Btn size="sm" loading={saving} onClick={saveContact}><Save size={13} /> Save</Btn>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', padding: 'var(--sp-4)' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)', flexShrink: 0 }}>
                {contact.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  {contact.name}
                  {contact.is_primary && <Badge color="var(--accent)">Primary</Badge>}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                  {contact.position && <span>{contact.position} · </span>}
                  {contact.email}
                  {contact.phone && <span> · {contact.phone}</span>}
                </div>
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => startEditContact(contact)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => deleteContact(contact.id)} disabled={deletingId === contact.id}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function AddContactModal({ clientId, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', position: '', is_primary: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function submit() {
    setLoading(true)
    setError('')
    try {
      await clientsApi.addContact(clientId, form)
      onSaved()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Contact" width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {error && <div style={{ color: 'var(--danger)', fontSize: '13px', background: 'rgba(248,113,113,0.1)', padding: '8px 12px', borderRadius: 'var(--r-md)' }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
          <Input label="Full Name" value={form.name} onChange={e => f('name', e.target.value)} required />
          <Input label="Position / Role" value={form.position} onChange={e => f('position', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
          <Input label="Email" type="email" value={form.email} onChange={e => f('email', e.target.value)} />
          <Input label="Phone" value={form.phone} onChange={e => f('phone', e.target.value)} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '13px', color: 'var(--text-2)' }}>
          <input type="checkbox" checked={form.is_primary} onChange={e => f('is_primary', e.target.checked)}
            style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
          Mark as primary contact
        </label>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn loading={loading} onClick={submit}>Add Contact</Btn>
        </div>
      </div>
    </Modal>
  )
}
