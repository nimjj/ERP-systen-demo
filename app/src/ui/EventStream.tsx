/** Event stream drawer: newest first, causality chips; clicking a chip highlights the whole chain. */
import { useMemo, useState } from 'react'
import type { DemoEvent } from '../domain/types'
import { Avatar, useEventIndex } from './components'
import { ACTOR_NAME, describeEvent } from './describe'
import { useAppState } from './StoreContext'

/** The event's ancestors up to the root, and every descendant of that root. */
function chainOf(events: readonly DemoEvent[], id: string): Set<string> {
  const byId = new Map(events.map((e) => [e.id, e]))
  let root = byId.get(id)
  while (root?.causedBy && byId.has(root.causedBy)) root = byId.get(root.causedBy)
  const chain = new Set<string>(root ? [root.id] : [id])
  let grew = true
  while (grew) {
    grew = false
    for (const e of events) {
      if (e.causedBy && chain.has(e.causedBy) && !chain.has(e.id)) {
        chain.add(e.id)
        grew = true
      }
    }
  }
  return chain
}

export function EventStream() {
  const state = useAppState()
  const index = useEventIndex()
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState<string | null>(null)
  const events = state.events
  const chain = useMemo(() => (focus ? chainOf(events, focus) : null), [events, focus])
  const latest = events[events.length - 1]

  return (
    <footer className={`stream ${open ? 'stream-open' : ''}`}>
      <button className="stream-bar" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="stream-title">Event stream</span>
        <span className="chip">{events.length} events</span>
        <span className="stream-latest">{latest ? `#${events.length} ${describeEvent(state, latest)}` : 'No events yet. Actions in any window appear here.'}</span>
        <span className="stream-toggle">{open ? 'Hide ▾' : 'Show ▴'}</span>
      </button>
      {open && (
        <div className="stream-body">
          {focus && (
            <div className="stream-focus">
              Showing the chain of #{index(focus)} ({chain?.size} events).{' '}
              <button className="link" onClick={() => setFocus(null)}>
                Clear
              </button>
            </div>
          )}
          {events.length === 0 ? (
            <div className="empty">Nothing has happened yet.</div>
          ) : (
            <ol className="stream-list">
              {[...events].reverse().map((e) => {
                const n = index(e.id)
                const inChain = chain?.has(e.id)
                return (
                  <li key={e.id} className={`${inChain ? 'in-chain' : ''} ${chain && !inChain ? 'dim' : ''} ${e.causedBy ? 'reaction' : 'root'}`}>
                    <span className="stream-n">#{n}</span>
                    <Avatar actor={e.actor} label={ACTOR_NAME[e.actor][0]} size="sm" />
                    <span className="stream-type">{e.type}</span>
                    <span className="stream-desc">{describeEvent(state, e)}</span>
                    {e.causedBy ? (
                      <button className="chip chip-cause" onClick={() => setFocus(focus === e.id ? null : e.id)} title="Highlight the chain">
                        because of #{index(e.causedBy)}
                      </button>
                    ) : (
                      <button className="chip chip-root" onClick={() => setFocus(focus === e.id ? null : e.id)} title="Highlight what this caused">
                        {ACTOR_NAME[e.actor]}
                      </button>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </footer>
  )
}
