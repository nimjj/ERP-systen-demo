import type { AppState, DemoEvent, Role } from '../domain/types'
import { useAppState, useEventStore } from './StoreContext'

const ROLE_ORDER: Role[] = ['jamal', 'aisha', 'emily', 'priya']
const ROLE_LABEL: Record<Role, string> = {
  jamal: 'Cashier · till',
  aisha: 'Store associate · handheld',
  emily: 'Loyalty & marketing',
  priya: 'Replenishment planner',
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
}

/** One line per role summarising what that person sees. Placeholder until the M3 panes. */
function roleSummary(state: AppState, role: Role): string {
  switch (role) {
    case 'jamal': {
      const live = state.till.rules.filter((r) => r.status === 'live').length
      return `${live} till promotions live · ${state.till.scanScript.length}-item scan script`
    }
    case 'aisha': {
      const open = state.handheld.tasks.filter((t) => t.status === 'OPEN').length
      return `${open} open tasks at ${state.store.name}`
    }
    case 'emily': {
      const offer = state.offers[0]
      return offer ? `${offer.id} ${offer.status} · ${state.promos.promotions.length} promotions` : 'No offers'
    }
    case 'priya': {
      const pending = state.proposals.filter((p) => p.status === 'PENDING_REVIEW').length
      return `${state.proposals.length} order proposals · ${pending} need review`
    }
  }
}

function describe(e: DemoEvent): string {
  if (e.type === 'NOTIFICATION_ADDED') {
    const p = (e as DemoEvent<'NOTIFICATION_ADDED'>).payload
    return `To ${p.role}: ${p.text}`
  }
  return e.type.replace(/_/g, ' ').toLowerCase()
}

export function App() {
  const state = useAppState()
  const store = useEventStore()
  const events = state.events
  const indexById = new Map(events.map((e, i) => [e.id, i + 1]))

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            JH<span className="logo-dot" />
          </span>
          <div>
            <div className="brand-name">John Henry Supermarkets</div>
            <div className="brand-sub">
              {state.store.name} · {state.store.id} · {state.store.asOfLabel}
            </div>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="chip">{events.length} events</span>
          <button className="btn" onClick={() => store.reset()}>
            Reset demo
          </button>
        </div>
      </header>

      <main className="split">
        {ROLE_ORDER.map((role) => {
          const persona = state.personas.find((p) => p.role === role)!
          const inbox = state.notifications.filter((n) => n.role === role)
          return (
            <section key={role} className="pane">
              <div className="pane-head">
                <span className={`avatar avatar-${role}`}>{initials(persona.name)}</span>
                <div>
                  <div className="pane-name">{persona.name}</div>
                  <div className="pane-role">{ROLE_LABEL[role]}</div>
                </div>
                <span className="bell" title="Inbox">
                  {inbox.length}
                </span>
              </div>
              <p className="pane-summary">{roleSummary(state, role)}</p>
              <ul className="inbox">
                {inbox
                  .slice(-3)
                  .reverse()
                  .map((n) => (
                    <li key={n.id} title={n.eventId}>
                      {n.text}
                    </li>
                  ))}
              </ul>
              <button
                className="btn btn-quiet"
                onClick={() =>
                  store.append({
                    type: 'NOTIFICATION_ADDED',
                    actor: 'system',
                    payload: { role, text: `Sync check for ${persona.name.split(' ')[0]}`, link: null, severity: 'info' },
                  })
                }
              >
                Send sync check
              </button>
            </section>
          )
        })}
      </main>

      <footer className="stream">
        <div className="stream-head">Event stream</div>
        {events.length === 0 ? (
          <div className="stream-empty">No events yet. Actions in any window appear here.</div>
        ) : (
          <ol className="stream-list">
            {[...events].reverse().map((e) => (
              <li key={e.id}>
                <span className="stream-n">#{indexById.get(e.id)}</span>
                <span className={`avatar avatar-sm avatar-${e.actor}`}>{e.actor[0].toUpperCase()}</span>
                <span className="stream-type">{e.type}</span>
                <span className="stream-desc">{describe(e)}</span>
                {e.causedBy && <span className="chip chip-cause">because of #{indexById.get(e.causedBy)}</span>}
              </li>
            ))}
          </ol>
        )}
      </footer>
    </div>
  )
}
