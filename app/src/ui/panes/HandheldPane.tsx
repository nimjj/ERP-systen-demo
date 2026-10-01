/**
 * Aisha — store handheld (phone-width). Each task opens a simple form; every
 * submit goes through the action builders in src/actions.ts (same events as the
 * Presenter's Next button).
 */
import { useState } from 'react'
import { countLines, defaultReceived, gapList, pullLot, pullTaskLot, receiveDelivery, receiveLines, refillShelf, submitCount } from '../../actions'
import type { Task } from '../../domain/types'
import { Chip, Flash, PaneFrame } from '../components'
import { usePresenter } from '../PresenterContext'
import { useAppState, useEventStore } from '../StoreContext'

const ICON: Record<Task['kind'], { glyph: string; tone: string }> = {
  RECEIVE: { glyph: '🚚', tone: 'amber' },
  COUNT: { glyph: '☑', tone: 'amber' },
  GAP: { glyph: '▥', tone: 'green' },
  MARKDOWN: { glyph: '🏷', tone: 'green' },
  RECALL_PULL: { glyph: '⚠', tone: 'red' },
}
const PRIORITY = { High: 0, Medium: 1, Low: 2 }

function ReceiveForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const state = useAppState()
  const store = useEventStore()
  const { shortShip } = usePresenter()
  const lines = receiveLines(state, task)
  const open = lines.filter((l) => l.status === 'IN_TRANSIT')
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(open.map((l) => [l.id, defaultReceived(l, shortShip)])))
  function confirm() {
    for (const d of receiveDelivery(state, task, qty)) store.append(d)
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
            ) : l.status === 'HELD' ? (
              <Chip tone="red">Held · recall</Chip>
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
  const lines = countLines(state)
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(lines.map((l) => [l.itemId, l.actualHint ?? l.systemQty])))
  function submit() {
    for (const d of submitCount(state, task, qty)) store.append(d)
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
    </>
  )
}

function GapForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const state = useAppState()
  const store = useEventStore()
  const list = gapList(state)
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
              <button className="btn btn-quiet" disabled={p.refill <= 0} onClick={() => store.append(refillShelf(p))}>
                {p.refill > 0 ? `Refill ${p.refill}` : 'Nothing to refill'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        className="btn btn-quiet btn-block"
        disabled={task.status === 'DONE'}
        onClick={() => {
          store.append({ type: 'TASK_COMPLETED', actor: 'aisha', payload: { taskId: task.id, kind: task.kind } })
          onDone()
        }}
      >
        Finish gap scan
      </button>
    </>
  )
}

function RecallPullForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const state = useAppState()
  const store = useEventStore()
  const info = pullTaskLot(state, task)
  const [qty, setQty] = useState(info ? info.onHand - info.pulled : 0)
  if (!info) return <div className="empty">This lot is not on file for {state.store.name}.</div>
  const where = state.handheld.gaps.find((g) => g.itemId === info.recall.itemId)?.location ?? state.handheld.count.lines.find((l) => l.itemId === info.recall.itemId)?.location
  return (
    <>
      <div className="banner banner-red">
        Recall {info.recall.id} · {info.recall.kind} {info.recall.classification}
      </div>
      <ul className="form-lines">
        <li>
          <div>
            <div className="line-name">
              {info.recall.itemName} · lot {info.lot}
            </div>
            <div className="muted small">
              {where ? `${where} · ` : ''}on file {info.onHand} · pulled {info.pulled}
            </div>
          </div>
          <input type="number" min={0} max={info.onHand - info.pulled} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label={`Pulled lot ${info.lot}`} />
        </li>
      </ul>
      <p className="muted small">{info.recall.action}</p>
      <button
        className="btn btn-block"
        disabled={task.status === 'DONE' || qty <= 0}
        onClick={() => {
          for (const d of pullLot(state, task, qty)) store.append(d)
          onDone()
        }}
      >
        Confirm pulled
      </button>
    </>
  )
}

export function HandheldPane({ onExpand }: { onExpand?: () => void }) {
  const state = useAppState()
  const [openId, setOpenId] = useState<string | null>(null)
  // Open first, then priority, then the newest batch of tasks created during the demo (tasks
  // created by the same action, like the three lot pulls, keep their order); seed tasks keep their order.
  const order = new Map(state.handheld.tasks.map((t, i) => [t.id, i]))
  const batch = (id: string) => {
    const t = state.handheld.tasks.find((x) => x.id === id)!
    const parent = t.createdBy ? t.createdBy.replace(/\.\d+$/, '') : ''
    return state.events.findIndex((e) => e.id === parent)
  }
  const tasks = [...state.handheld.tasks].sort(
    (a, b) =>
      (a.status === b.status ? 0 : a.status === 'OPEN' ? -1 : 1) ||
      PRIORITY[a.priority] - PRIORITY[b.priority] ||
      Number(!!b.createdBy) - Number(!!a.createdBy) ||
      (a.createdBy && b.createdBy ? batch(b.id) - batch(a.id) : 0) ||
      order.get(a.id)! - order.get(b.id)!,
  )
  const openTask = tasks.find((t) => t.id === openId)
  const openCount = tasks.filter((t) => t.status === 'OPEN').length
  const gapCount = gapList(state).length

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
              {openTask.kind === 'GAP' && <GapForm task={openTask} onDone={() => setOpenId(null)} />}
              {openTask.kind === 'RECALL_PULL' && <RecallPullForm task={openTask} onDone={() => setOpenId(null)} />}
            </>
          ) : (
            <>
              <h3 className="phone-title">Good morning 👋</h3>
              <p className="muted small">
                {openCount > 0 ? (
                  <>
                    You have <Flash value={openCount} /> open {openCount === 1 ? 'task' : 'tasks'}. High priority first.
                  </>
                ) : (
                  'All done for now. New tasks will appear here.'
                )}
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
