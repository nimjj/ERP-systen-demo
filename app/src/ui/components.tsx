/** Small shared UI pieces: flash-on-change values, chips, avatars, pane frame with inbox. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { demoTuning } from '../config/demoTuning'
import type { Actor, Notification, Role } from '../domain/types'
import { useAppState } from './StoreContext'

export const ROLE_TITLE: Record<Role, string> = {
  jamal: 'Cashier · Till app',
  aisha: 'Store associate · Handheld',
  emily: 'Loyalty & marketing',
  priya: 'Replenishment planner',
}

export const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`
export const num = (n: number) => n.toLocaleString('en-US')

export function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
}

export function Avatar({ actor, label, size = 'md' }: { actor: Actor; label: string; size?: 'sm' | 'md' }) {
  return <span className={`avatar avatar-${actor} ${size === 'sm' ? 'avatar-sm' : ''}`}>{label}</span>
}

/** Index (#n) of each event in the log, for chips and tooltips. */
export function useEventIndex(): (id: string | null | undefined) => number | undefined {
  const state = useAppState()
  const ref = useRef<{ len: number; map: Map<string, number> }>({ len: -1, map: new Map() })
  if (ref.current.len !== state.events.length) {
    ref.current = { len: state.events.length, map: new Map(state.events.map((e, i) => [e.id, i + 1])) }
  }
  const map = ref.current.map
  return (id) => (id ? map.get(id) : undefined)
}

/** Shows a value; flashes when it changes, with the event that changed it as tooltip. */
export function Flash({ value, children, className = '' }: { value: unknown; children?: ReactNode; className?: string }) {
  const state = useAppState()
  const key = JSON.stringify(value)
  const prev = useRef(key)
  const [flash, setFlash] = useState<{ on: boolean; n: number | null }>({ on: false, n: null })
  useEffect(() => {
    if (prev.current === key) return
    prev.current = key
    setFlash({ on: true, n: state.events.length || null })
    const t = setTimeout(() => setFlash((f) => ({ ...f, on: false })), demoTuning.animationMs * 2)
    return () => clearTimeout(t)
  }, [key, state.events.length])
  return (
    <span className={`flash ${flash.on ? 'flash-on' : ''} ${className}`} title={flash.n ? `Changed by event #${flash.n}` : undefined}>
      {children ?? String(value)}
    </span>
  )
}

export function Chip({ tone = 'neutral', children, title }: { tone?: 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'purple'; children: ReactNode; title?: string }) {
  return (
    <span className={`chip chip-${tone}`} title={title}>
      {children}
    </span>
  )
}

const SEVERITY_TONE = { info: 'blue', success: 'green', warning: 'amber', critical: 'red' } as const

function Inbox({ role }: { role: Role }) {
  const state = useAppState()
  const index = useEventIndex()
  const mine = state.notifications.filter((n) => n.role === role)
  const [open, setOpen] = useState(false)
  // Read/unread is a per-window view setting, not shared data.
  const [seen, setSeen] = useState(mine.length)
  useEffect(() => {
    if (mine.length < seen) setSeen(mine.length) // after a reset
  }, [mine.length, seen])
  const unread = Math.max(0, mine.length - seen)
  return (
    <div className="inbox-wrap">
      <button
        className={`bell ${unread ? 'bell-unread' : ''}`}
        onClick={() => {
          setOpen(!open)
          setSeen(mine.length)
        }}
        aria-label={`Notifications (${unread} new)`}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z" />
        </svg>
        {unread > 0 && <span className="bell-count">{unread}</span>}
      </button>
      {open && (
        <div className="inbox-panel" role="dialog">
          <div className="inbox-head">
            Notifications <button className="link" onClick={() => setOpen(false)}>Close</button>
          </div>
          {mine.length === 0 ? (
            <div className="empty">Nothing yet.</div>
          ) : (
            <ul>
              {[...mine].reverse().map((n: Notification) => (
                <li key={n.id} className={`note note-${SEVERITY_TONE[n.severity]}`} title={`Event #${index(n.eventId)}`}>
                  {n.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/** Persona header + inbox + body. Every role pane uses this frame. */
export function PaneFrame({ role, children, actions, onExpand }: { role: Role; children: ReactNode; actions?: ReactNode; onExpand?: () => void }) {
  const state = useAppState()
  const persona = state.personas.find((p) => p.role === role)!
  return (
    <section className={`pane pane-${role}`}>
      <header className="pane-head">
        <Avatar actor={role} label={initials(persona.name)} />
        <div className="pane-who">
          <div className="pane-name">{persona.name}</div>
          <div className="pane-role">{ROLE_TITLE[role]}</div>
        </div>
        <div className="pane-actions">
          {actions}
          <Inbox role={role} />
          {onExpand && (
            <button className="icon-btn" onClick={onExpand} title="Open full screen" aria-label="Open full screen">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="currentColor" d="M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4Z" />
              </svg>
            </button>
          )}
        </div>
      </header>
      <div className="pane-body">{children}</div>
    </section>
  )
}
