import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, MessageSquare, Hash, Wifi, WifiOff } from 'lucide-react'
import { chatApi } from '@/api/index.js'
import { Avatar, Spinner, EmptyState } from '@/components/ui/index.jsx'
import { timeAgo, formatDate } from '@/utils/index.js'
import { useAuthStore } from '@/stores/authStore.js'

export default function ChatPage() {
  const [activeRoom, setActiveRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [typing, setTyping] = useState(null)
  const wsRef = useRef(null)
  const bottomRef = useRef(null)
  const user = useAuthStore(s => s.user)
  const accessToken = useAuthStore(s => s.accessToken)

  const { data: rooms, isLoading: roomsLoading } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: () => chatApi.rooms().then(r => r.data.results || r.data),
  })

  // Load message history
  useEffect(() => {
    if (!activeRoom) return
    chatApi.messages(activeRoom.id, { limit: 50 }).then(r => {
      setMessages(r.data.results || r.data || [])
    }).catch(() => {})
  }, [activeRoom?.id])

  // WebSocket connection
  useEffect(() => {
    if (!activeRoom || !accessToken) return
    const wsBase = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsUrl = `${wsBase}://${window.location.host}/ws/chat/${activeRoom.id}/?token=${accessToken}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    ws.onmessage = (e) => {
      const frame = JSON.parse(e.data)
      if (frame.type === 'message') {
        setMessages(prev => [...prev, {
          id: frame.message_id,
          text: frame.text,
          sender: { id: frame.sender_id, name: frame.sender_name },
          created_at: frame.created_at,
          msg_type: 'text',
        }])
      } else if (frame.type === 'typing') {
        if (frame.user_id !== user?.id) {
          setTyping(frame.is_typing ? frame.user_name : null)
          if (frame.is_typing) setTimeout(() => setTyping(null), 3000)
        }
      } else if (frame.type === 'edited') {
        setMessages(prev => prev.map(m => m.id === frame.message_id ? { ...m, text: frame.text, is_edited: true } : m))
      }
    }

    return () => ws.close()
  }, [activeRoom?.id, accessToken])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || !connected) return
    wsRef.current?.send(JSON.stringify({ action: 'message', text: input.trim() }))
    setInput('')
  }

  function handleTyping() {
    wsRef.current?.send(JSON.stringify({ action: 'typing', is_typing: true }))
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 140px)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden', background: 'var(--bg-1)' }}>
      {/* Rooms sidebar */}
      <div style={{ width: 240, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-2)' }}>
        <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem' }}>Chat Rooms</h3>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-2)' }}>
          {roomsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-6)' }}><Spinner size={20} /></div>
          ) : !rooms?.length ? (
            <p style={{ color: 'var(--text-3)', fontSize: '12px', padding: 'var(--sp-4)' }}>No rooms available</p>
          ) : (
            rooms.map(room => (
              <button
                key={room.id}
                onClick={() => setActiveRoom(room)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
                  padding: '10px 12px', border: 'none', borderRadius: 'var(--r-md)',
                  background: activeRoom?.id === room.id ? 'var(--accent-dim)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left', transition: 'background var(--t-fast)',
                  color: activeRoom?.id === room.id ? 'var(--accent)' : 'var(--text-1)',
                }}
                onMouseEnter={e => activeRoom?.id !== room.id && (e.currentTarget.style.background = 'var(--bg-3)')}
                onMouseLeave={e => activeRoom?.id !== room.id && (e.currentTarget.style.background = 'transparent')}
              >
                <Hash size={14} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {room.project?.name || room.name || `Room ${room.id}`}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{room.room_type}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      {!activeRoom ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState icon={MessageSquare} title="Select a room" description="Choose a chat room from the sidebar to start messaging." />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Room header */}
          <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <Hash size={14} color="var(--text-3)" />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{activeRoom.project?.name || activeRoom.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: connected ? 'var(--success)' : 'var(--text-3)' }}>
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-3)', fontSize: '13px', marginTop: 'var(--sp-8)' }}>
                No messages yet. Say hello!
              </div>
            )}
            {messages.map((msg, i) => {
              const isOwn = msg.sender?.id === user?.id
              const prevSame = i > 0 && messages[i-1].sender?.id === msg.sender?.id
              return (
                <div key={msg.id || i} style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start', flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                  {!prevSame ? (
                    <Avatar name={msg.sender?.name} size={30} />
                  ) : (
                    <div style={{ width: 30, flexShrink: 0 }} />
                  )}
                  <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', gap: 2, alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                    {!prevSame && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>{isOwn ? 'You' : msg.sender?.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{timeAgo(msg.created_at)}</span>
                      </div>
                    )}
                    <div style={{
                      padding: '8px 12px', borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      background: isOwn ? 'var(--accent)' : 'var(--bg-3)',
                      color: isOwn ? '#0a0a0a' : 'var(--text-0)',
                      fontSize: '13px', lineHeight: 1.5,
                    }}>
                      {msg.text}
                      {msg.is_edited && <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: 4 }}>(edited)</span>}
                    </div>
                  </div>
                </div>
              )
            })}
            {typing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'var(--text-3)', fontSize: '12px', fontStyle: 'italic' }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-3)', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                </div>
                {typing} is typing…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} style={{ padding: 'var(--sp-4) var(--sp-5)', borderTop: '1px solid var(--border)', display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
            <input
              value={input}
              onChange={e => { setInput(e.target.value); handleTyping() }}
              placeholder={connected ? `Message #${activeRoom.project?.name || 'room'}…` : 'Connect to send messages'}
              disabled={!connected}
              style={{
                flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-full)', color: 'var(--text-0)', fontSize: '13px',
                padding: '9px 16px', outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <button type="submit" disabled={!input.trim() || !connected} style={{
              width: 38, height: 38, borderRadius: '50%', border: 'none',
              background: input.trim() && connected ? 'var(--accent)' : 'var(--bg-3)',
              color: input.trim() && connected ? '#0a0a0a' : 'var(--text-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && connected ? 'pointer' : 'not-allowed',
              transition: 'all var(--t-fast)', flexShrink: 0,
            }}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
