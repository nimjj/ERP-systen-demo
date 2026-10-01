/** Priya — replenishment planner: proposal table with exceptions and approve/edit/hold, claims, series chart. */
import { useState } from 'react'
import { approveOrder, holdOrder } from '../../actions'
import type { Proposal, SeriesPoint } from '../../domain/types'
import { Chip, Flash, money, PaneFrame } from '../components'
import { PlannerRecallBanner } from '../RecallViews'
import { useAppState, useEventStore } from '../StoreContext'

const STATUS: Record<Proposal['status'], { label: string; tone: 'green' | 'amber' | 'blue' | 'red' | 'neutral' }> = {
  AUTO_RELEASED: { label: 'Auto', tone: 'green' },
  PENDING_REVIEW: { label: 'Review', tone: 'amber' },
  APPROVED: { label: 'Approved', tone: 'blue' },
  HELD: { label: 'Held', tone: 'neutral' },
  BLOCKED: { label: 'Blocked', tone: 'red' },
}
const SEVERITY_TONE = { high: 'red', medium: 'amber', low: 'blue' } as const
/** Short chip labels for narrow panes (split view). */
const SHORT: Record<string, string> = {
  SHELF_CAPACITY: 'Shelf cap.',
  PROMO_UPLIFT: 'Promo',
  PHANTOM_SUSPECTED: 'Phantom?',
  SUPPLIER_CONSTRAINT: 'Supplier',
  LARGE_DEVIATION: 'Large change',
  LOW_CONFIDENCE: 'Low conf.',
  NEAR_EXPIRY: 'Near expiry',
}

function SeriesChart({ points, title }: { points: SeriesPoint[]; title: string }) {
  const W = 520
  const H = 120
  const pad = 22
  const max = Math.max(1, ...points.flatMap((p) => [p.actual ?? 0, p.forecast ?? 0]))
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, points.length - 1)
  const y = (v: number) => H - pad - (v * (H - pad * 2)) / max
  const line = (key: 'actual' | 'forecast') =>
    points
      .map((p, i) => (p[key] == null ? null : `${x(i)},${y(p[key] as number)}`))
      .filter(Boolean)
      .join(' ')
  const nowIndex = points.findIndex((p) => p.w === 0)
  return (
    <figure className="chart">
      <figcaption>
        {title} <span className="legend legend-actual">actual</span> <span className="legend legend-forecast">forecast</span> <span className="muted small">units / week</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: weekly actual and forecast`}>
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} className="axis" />
        {nowIndex >= 0 && <line x1={x(nowIndex)} x2={x(nowIndex)} y1={pad / 2} y2={H - pad} className="now" />}
        <polyline points={line('forecast')} className="series-forecast" />
        <polyline points={line('actual')} className="series-actual" />
        <text x={pad} y={H - 6} className="tick">
          {points[0]?.week}
        </text>
        <text x={W - pad} y={H - 6} className="tick" textAnchor="end">
          {points[points.length - 1]?.week}
        </text>
        <text x={pad} y={pad / 2 + 4} className="tick">
          {Math.round(max)}
        </text>
      </svg>
    </figure>
  )
}

function Row({ p, selected, onSelect }: { p: Proposal; selected: boolean; onSelect: () => void }) {
  return (
    <tr className={`${selected ? 'row-selected' : ''} ${p.status === 'PENDING_REVIEW' ? 'row-pending' : ''}`} onClick={onSelect}>
      <td className="item-cell">
        <div className="cell-main">{p.itemName}</div>
        <div className="muted small">{p.id}</div>
      </td>
      <td className="num">
        <Flash value={p.proposedQty} className="qty">
          {p.proposedQty}
        </Flash>
      </td>
      <td className="num muted">{p.lastOrderQty}</td>
      <td className="num">
        <Flash value={p.onHand} />
      </td>
      <td className="num">
        <Flash value={p.inTransit} />
      </td>
      <td className="num">
        <Flash value={p.daysOfCover}>{p.daysOfCover.toFixed(1)}</Flash>
      </td>
      <td className="exc-cell">
        <Flash value={p.exceptions.map((e) => e.code).join()}>
          <span className="chips">
            {p.exceptions.map((e) => (
              <Chip key={e.code} tone={SEVERITY_TONE[e.severity]} title={`${e.label}: ${e.explanation}`}>
                <span className="lbl-long">{e.label}</span>
                <span className="lbl-short">{SHORT[e.code] ?? e.label}</span>
              </Chip>
            ))}
          </span>
        </Flash>
      </td>
      <td>
        <Flash value={p.status}>
          <Chip tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Chip>
        </Flash>
      </td>
    </tr>
  )
}

/** Approve (optionally with an edited quantity) or hold the selected proposal. */
function Decision({ p }: { p: Proposal }) {
  const store = useEventStore()
  const [edit, setEdit] = useState<{ id: string; qty: number } | null>(null)
  const qty = edit && edit.id === p.id ? edit.qty : p.proposedQty
  const decided = p.status === 'HELD' || p.status === 'BLOCKED'
  function approve() {
    store.append(approveOrder(p, qty))
    setEdit(null)
  }
  return (
    <div className="decision">
      <label className="small muted" htmlFor={`qty-${p.id}`}>
        Order quantity (case {p.casePack})
      </label>
      <div className="decision-row">
        <input id={`qty-${p.id}`} className="qty-input" type="number" min={0} step={p.casePack} value={qty} disabled={decided} onChange={(e) => setEdit({ id: p.id, qty: Number(e.target.value) })} />
        <button className="btn btn-sm" disabled={decided || qty <= 0} onClick={approve}>
          Approve {qty}
        </button>
        <button className="btn btn-quiet btn-sm" disabled={decided} onClick={() => store.append(holdOrder(p))}>
          Hold
        </button>
      </div>
    </div>
  )
}

export function PlannerPane({ onExpand }: { onExpand?: () => void }) {
  const state = useAppState()
  const [selected, setSelected] = useState('SKU-100221')
  const pending = state.proposals.filter((p) => p.status === 'PENDING_REVIEW').length
  const sel = state.proposals.find((p) => p.itemId === selected)
  const claims = [...state.claims].sort((a, b) => Number(b.raisedInDemo) - Number(a.raisedInDemo))

  return (
    <PaneFrame
      role="priya"
      onExpand={onExpand}
      actions={
        <Flash value={pending}>
          <Chip tone={pending ? 'amber' : 'green'}>{pending} need review</Chip>
        </Flash>
      }
    >
      <PlannerRecallBanner />
      <p className="muted small intro">Orders go to the DC and suppliers at 06:00. Review the exceptions; the rest is auto-released.</p>
      <div className="table-wrap">
        <table className="table proposals">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Order</th>
              <th className="num">Last</th>
              <th className="num">On hand</th>
              <th className="num">
                <span className="lbl-long">In transit</span>
                <span className="lbl-short">Transit</span>
              </th>
              <th className="num">
                <span className="lbl-long">Cover (d)</span>
                <span className="lbl-short">Cover</span>
              </th>
              <th>Exceptions</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {state.proposals.map((p) => (
              <Row key={p.id} p={p} selected={p.itemId === selected} onSelect={() => setSelected(p.itemId)} />
            ))}
          </tbody>
        </table>
      </div>

      {sel && (
        <div className="planner-detail">
          <SeriesChart points={state.series[sel.itemId] ?? []} title={sel.itemName} />
          <div className="detail-text">
            <div className="cell-main">
              {sel.itemName} <span className="muted small">· {sel.supplierName}</span>
            </div>
            <Decision p={sel} />
            <div className="small">
              Order-up-to <b>{sel.orderUpTo}</b> · forecast <b>{sel.effectiveDaily}</b>/day{sel.uplift > 0 ? ` (incl. +${Math.round(sel.uplift * 100)}% uplift)` : ''} · case {sel.casePack}
            </div>
            {sel.exceptions.map((e) => (
              <p key={e.code} className="small">
                <b>{e.label}:</b> {e.explanation}
              </p>
            ))}
          </div>
        </div>
      )}

      <h4 className="section">Supplier claims</h4>
      <table className="table">
        <thead>
          <tr>
            <th>Claim</th>
            <th>Item</th>
            <th className="num">Qty</th>
            <th className="num">Value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => (
            <tr key={c.id} className={c.raisedInDemo ? 'row-new' : ''}>
              <td>
                <div className="cell-main">{c.id}</div>
                <div className="muted small">
                  {c.supplierName} · {c.type}
                </div>
              </td>
              <td>{c.itemName}</td>
              <td className="num">{c.shortQty !== undefined ? `${c.shortQty} u` : `${c.qtyCases} cs`}</td>
              <td className="num">{money(c.value)}</td>
              <td>
                <Chip tone={c.raisedInDemo ? 'amber' : 'neutral'}>{c.status}</Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PaneFrame>
  )
}
