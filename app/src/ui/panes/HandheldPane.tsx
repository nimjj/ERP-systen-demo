/**
 * Aisha — store handheld (phone-width). Each task opens a simple form; submitting
 * emits events (DELIVERY_RECEIVED, COUNT_SUBMITTED, SHELF_REFILLED, TASK_COMPLETED).
 */
import { useState } from 'react'
import type { AppState, Inbound, Task } from '../../domain/types'
import { Chip, Flash, PaneFrame } from '../components'
import { useAppState, useEventStore } from '../StoreContext'

const ICON: Record<Task['kind'], { glyph: string; tone: string }> = {
  RECEIVE: { glyph: '🚚', tone: 'amber' },
  COUNT: { glyph: '☑', tone: 'amber' },
  GAP: { glyph: '▥', tone: 'green' },
  MARKDOWN: { glyph: '🏷', tone: 'green' },
  RECALL_PULL: { glyph: '⚠', tone: 'red' },
}
const PRIORITY = { High: 0, Medium: 1, Low: 2 }

function inboundFor(state: AppState, task: Task): Inbound[] {
  return state.inbound.filter((i) => i.asnId === task.ref || i.id === task.ref)
}

/** Live gap list: shelf below a quarter of its capacity with stock in the back room, or empty. */
function gaps(state: AppState) {
  return Object.values(state.positions)
    .filter((p) => p.shelf < p.shelfCapacity * 0.25 && (p.backRoom > 0 || p.shelf === 0))
    .map((p) => ({ ...p, refill: Math.min(p.backRoom, p.shelfCapacity - p.shelf) }))
}

function ReceiveForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const state = useAppState()
  const store = useEventStore()
  const lines = inboundFor(state, task)
  const open = lines.filter((l) => l.status === 'IN_TRANSIT')
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(open.map((l) => [l.id, l.expectedQty])))
  function confirm() {
    for (const l of open) store.append({ type: 'DELIVERY_RECEIVED', actor: 'aisha', payload: { inboundId: l.id, expectedQty: l.expectedQty, receivedQty: qty[l.id] ?? l.expectedQty } })
    if (store.getState().handheld.tasks.find((t) => t.id === task.id)?.status === 'OPEN') {
      store.append({ type: 'TASK_COMPLETED', actor: 'aisha', payload: { taskId: task.id, kind: task.kind } })
    }
    onDone()
  }
  return (
    <>
      <p className="muted small">Enter what actually arrived. Short lines raise a supplier claim.</p>
      <ul className="form-lines">
        {lines.map((l) => (
          <li key={l.id}>
            <div>
              <div className="line-name">{l.name}</div>
              <div className="muted small">
                Expected {l.expectedQty} ({l.expectedQty / l.casePack} cs){l.shortShip && <Chip tone="amber">short-ship flagged</Chip>}
              </div>
            </div>
            {l.status === 'IN_TRANSIT' ? (
              <input type="number" min={0} value={qty[l.id] ?? l.expectedQty} onChange={(e) => setQty({ ...qty, [l.id]: Number(e.target.value) })} aria-label={`Received ${l.name}`} />
            ) : (
              <Chip tone="green">Received {l.receivedQty}</Chip>
            )}
          </li>
        ))}
      </ul>
      <button className="btn btn-block" disabled={open.length === 0} onClick={confirm}>
        Confirm receipt
      </button>
    </>
  )
}

function CountForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const state = useAppState()
  const store = useEventStore()
  const lines = state.handheld.count.lines.map((l) => ({ ...l, systemQty: state.positions[l.itemId]?.onHand ?? l.systemQty }))
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(lines.map((l) => [l.itemId, l.actualHint ?? l.systemQty])))
  function submit() {
    store.append({
      type: 'COUNT_SUBMITTED',
      actor: 'aisha',
      payload: { countId: state.handheld.count.id, lines: lines.map((l) => ({ sku: l.itemId, systemQty: l.systemQty, actualQty: qty[l.itemId] ?? l.systemQty })) },
    })
    store.append({ type: 'TASK_COMPLETED', actor: 'aisha', payload: { taskId: task.id, kind: task.kind } })
    onDone()
  }
  return (
    <>
      <p className="muted small">{state.handheld.count.reason}. Count what is on the shelf and in the back room.</p>
      <ul className="form-lines">
        {lines.map((l) => (
          <li key={l.itemId}>
            <div>
              <div className="line-name">{l.name}</div>
              <div className="muted small">
                {l.location} · system {l.systemQty}
              </div>
            </div>
            <input type="number" min={0} value={qty[l.itemId]} onChange={(e) => setQty({ ...qty, [l.itemId]: Number(e.target.value) })} aria-label={`Counted ${l.name}`} />
          </li>
        ))}
      </ul>
      <button className="btn btn-block" disabled={task.status === 'DONE'} onClick={submit}>
        Submit count
      </button>
      <p className="muted small">Stock correction from counts arrives with the P1 rules (M5).</p>
    </>
  )
}

function GapForm() {
  const state = useAppState()
  const store = useEventStore()
  const list = gaps(state)
  return (
    <>
      <p className="muted small">Low shelves right now. Refill moves stock from the back room to the shelf.</p>
      {list.length === 0 ? (
        <div className="empty">No gaps. Shelves look good.</div>
      ) : (
        <ul className="form-lines">
          {list.map((p) => (
            <li key={p.sku}>
              <div>
                <div className="line-name">{p.name}</div>
                <div className="muted small">
                  Shelf <Flash value={p.shelf} /> / {p.shelfCapacity} · back room <Flash value={p.backRoom} />
                </div>
              </div>
              <button className="btn btn-quiet" disabled={p.refill <= 0} onClick={() => store.append({ type: 'SHELF_REFILLED', actor: 'aisha', payload: { sku: p.sku, qty: p.refill } })}>
                {p.refill > 0 ? `Refill ${p.refill}` : 'Nothing to refill'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Shelf moves from refills arrive with the P1 rules (M5).</p>
    </>
  )
}

export function HandheldPane({ onExpand }: { onExpand?: () => void }) {
  const state = useAppState()
  const [openId, setOpenId] = useState<string | null>(null)
  // Open first, then priority, then the newest tasks created during the demo.
  const order = new Map(state.handheld.tasks.map((t, i) => [t.id, i]))
  const tasks = [...state.handheld.tasks].sort(
    (a, b) =>
      (a.status === b.status ? 0 : a.status === 'OPEN' ? -1 : 1) ||
      PRIORITY[a.priority] - PRIORITY[b.priority] ||
      Number(!!b.createdBy) - Number(!!a.createdBy) ||
      (a.createdBy ? order.get(b.id)! - order.get(a.id)! : order.get(a.id)! - order.get(b.id)!),
  )
  const openTask = tasks.find((t) => t.id === openId)
  const openCount = tasks.filter((t) => t.status === 'OPEN').length
  const gapCount = gaps(state).length

  return (
    <PaneFrame role="aisha" onExpand={onExpand}>
      <div className="phone">
        <div className="phone-head">
          <div className="phone-store">{state.store.name}</div>
          <div className="phone-sub">
            {state.store.id} · {state.personas.find((p) => p.role === 'aisha')!.name}
          </div>
        </div>
        <div className="phone-body">
          {openTask ? (
            <>
              <button className="link back" onClick={() => setOpenId(null)}>
                ‹ All tasks
              </button>
              <h3 className="phone-title">{openTask.title}</h3>
              {openTask.kind === 'RECEIVE' && <ReceiveForm task={openTask} onDone={() => setOpenId(null)} />}
              {openTask.kind === 'COUNT' && <CountForm task={openTask} onDone={() => setOpenId(null)} />}
              {openTask.kind === 'GAP' && <GapForm />}
            </>
          ) : (
            <>
              <h3 className="phone-title">Good morning 👋</h3>
              <p className="muted small">
                You have <Flash value={openCount} /> open tasks. High priority first.
              </p>
              <ul className="tasks">
                {tasks.map((t) => {
                  const soon = t.kind === 'MARKDOWN'
                  const done = t.status === 'DONE'
                  return (
                    <li key={t.id}>
                      <button className={`task ${done ? 'task-done' : ''} ${soon ? 'task-soon' : ''}`} disabled={soon || done} onClick={() => setOpenId(t.id)}>
                        <span className={`task-icon tone-${ICON[t.kind].tone}`}>{done ? '✓' : ICON[t.kind].glyph}</span>
                        <span className="task-text">
                          <span className="task-title">{t.title}</span>
                          <span className="task-detail">{t.kind === 'GAP' && !done ? `${gapCount} low shelves now · ${t.detail}` : t.detail}</span>
                        </span>
                        {soon ? <Chip>Soon</Chip> : done ? <Chip tone="green">Done</Chip> : <span className="chev">›</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </PaneFrame>
  )
}
