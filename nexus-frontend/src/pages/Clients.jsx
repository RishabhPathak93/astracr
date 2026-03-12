import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Building2, Globe, Mail, Phone, Search } from 'lucide-react'
import { clientsApi, projectsApi } from '@/api/index.js'
import { Btn, Badge, EmptyState, Modal, Input, Select, Textarea } from '@/components/ui/index.jsx'
import { extractError, timeAgo } from '@/utils/index.js'
import { useAuthStore } from '@/stores/authStore.js'

const STATUS_COLOR = { active: 'var(--success)', prospect: 'var(--info)', inactive: 'var(--text-3)' }

export default function ClientsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const canCreate = useAuthStore(s => s.hasPermission('clients'))
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search, statusFilter],
    queryFn: () => clientsApi.list({ search: search || undefined, status: statusFilter || undefined }).then(r => r.data.results || r.data),
  })

  const clients = data || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-0.02em' }}>Clients</h1>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', marginTop: 4 }}>{clients.length} total</p>
        </div>
        {canCreate && <Btn icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>New Client</Btn>}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
            style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-0)', fontSize: '13px', padding: '8px 12px 8px 32px', outline: 'none' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-1)', fontSize: '13px', padding: '8px 12px', outline: 'none', cursor: 'pointer' }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="prospect">Prospect</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 'var(--sp-8)', display: 'flex', justifyContent: 'center' }}>
            <div style={{ color: 'var(--text-3)', fontSize: '14px' }}>Loading…</div>
          </div>
        ) : clients.length === 0 ? (
          <EmptyState icon={Building2} title="No clients found" description="Add your first client to get started." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Client', 'Industry', 'Contact', 'Status', 'Projects', 'Added'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={c.id}
                  onClick={() => navigate(`/clients/${c.id}`)}
                  style={{ borderBottom: i < clients.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background var(--t-fast)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                        {c.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{c.name}</div>
                        {c.website && <div style={{ fontSize: '11px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 3 }}><Globe size={10} />{c.website.replace(/^https?:\/\//, '')}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-2)' }}>{c.industry || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{c.contact_person || '—'}</div>
                    {c.email && <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{c.email}</div>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge color={STATUS_COLOR[c.status]}>{c.status}</Badge>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-2)' }}>
                    {c.project_count ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{timeAgo(c.onboarded_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); qc.invalidateQueries(['clients']) }} />}
    </div>
  )
}

function CreateClientModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', industry: '', contact_person: '', website: '', notes: '', status: 'active', project: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: projectsData } = useQuery({
    queryKey: ['projects-dropdown'],
    queryFn: () => projectsApi.list().then(r => r.data.results || r.data),
  })
  const projects = projectsData || []

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function submit(e) {
  e.preventDefault()
  setLoading(true)
  try {
    // Step 1 — Client banao (project field nahi bhejna)
    const { data: newClient } = await clientsApi.create({
      name: form.name,
      email: form.email,
      phone: form.phone,
      industry: form.industry,
      contact_person: form.contact_person,
      website: form.website,
      notes: form.notes,
      status: form.status,
    })

    // Step 2 — Agar project select kiya hai toh project update karo
    if (form.project) {
      await projectsApi.update(form.project, { client: newClient.id })
    }

    onCreated()
  } catch (err) {
    setError(extractError(err))
  } finally {
    setLoading(false)
  }
}

  return (
    <Modal open onClose={onClose} title="New Client" width={560}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {error && <div style={{ color: 'var(--danger)', fontSize: '13px', background: 'rgba(248,113,113,0.1)', padding: '8px 12px', borderRadius: 'var(--r-md)' }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          <Input label="Company name" value={form.name} onChange={e => f('name', e.target.value)} required />
          <Input label="Email" type="email" value={form.email} onChange={e => f('email', e.target.value)} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          <Input label="Phone" value={form.phone} onChange={e => f('phone', e.target.value)} />
          <Input label="Industry" value={form.industry} onChange={e => f('industry', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          <Input label="Contact person" value={form.contact_person} onChange={e => f('contact_person', e.target.value)} />
          <Input label="Website" value={form.website} onChange={e => f('website', e.target.value)} placeholder="https://example.com" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          <Select label="Status" value={form.status} onChange={e => f('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="prospect">Prospect</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Select label="Link Project (optional)" value={form.project} onChange={e => f('project', e.target.value)}>
            <option value="">— No project —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
        <Textarea label="Notes" value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Internal notes…" />
        <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" loading={loading}>Create Client</Btn>
        </div>
      </form>
    </Modal>
  )
}
