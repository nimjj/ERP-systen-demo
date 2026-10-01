/** Recall views for Priya (held orders, pull progress, write-off) and Emily (customer notice). */
import { sendRecallNotice } from '../actions'
import type { AppState, Recall } from '../domain/types'
import { Chip, Flash, money, num } from './components'
import { useAppState, useEventStore } from './StoreContext'

export const issuedRecalls = (s: AppState) => s.recalls.filter((r) => r.status === 'ISSUED')

function plano(s: AppState, r: Recall) {
  const row = r.stores.find((x) => x.storeId === s.store.id)
  const total = row?.lots.reduce((n, l) => n + l.onHand, 0) ?? 0
  const pulled = row?.lots.reduce((n, l) => n + l.pulled, 0) ?? 0
  return { row, total, pulled }
}

export function PlannerRecallBanner() {
  const state = useAppState()
  return (
    <>
      {issuedRecalls(state).map((r) => {
        const { total, pulled } = plano(state, r)
        const held = state.inbound.filter((i) => i.sku === r.itemId && i.status === 'HELD')
        const confirmed = r.stores.filter((s) => s.confirmedBy).length
        return (
          <div key={r.id} className="recall-card">
            <div className="card-head">
              <div className="card-title">
                Recall {r.id} · {r.itemName}
              </div>
              <Chip tone="red">
                {r.kind} {r.classification}
              </Chip>
            </div>
            <div className="small">
              <b>Orders held:</b> {held.length ? held.map((i) => `${num(i.expectedQty)} units on ${i.asnId ?? i.id}`).join(', ') : 'none open'} · new orders blocked.
            </div>
            <div className="small">
              <b>Plano pulled:</b> <Flash value={pulled}>{pulled}</Flash> of {total} · write-off <Flash value={pulled}>{money(pulled * r.credit.unitCost)}</Flash> (credit via {r.credit.claimId ?? 'supplier claim'}) · network{' '}
              <Flash value={confirmed}>{confirmed}</Flash> of {r.stores.length} stores confirmed
            </div>
            <div className="progress" aria-label={`Plano pulled ${pulled} of ${total}`}>
              <span style={{ width: `${total ? (pulled / total) * 100 : 0}%` }} />
            </div>
          </div>
        )
      })}
    </>
  )
}

export function MarketingRecallCard() {
  const state = useAppState()
  const store = useEventStore()
  return (
    <>
      {issuedRecalls(state).map((r) => {
        const n = r.notice
        const send = sendRecallNotice(r)
        const flagged = state.promos.promotions.filter((p) => p.recallFlags?.some((f) => f.recallId === r.id))
        return (
          <div key={r.id} className="recall-card">
            <div className="card-head">
              <div>
                <div className="card-title">
                  Recall {r.id}: {r.itemName}
                </div>
                <div className="muted small">
                  {r.supplierName} · {r.kind} {r.classification} · removed from {flagged.map((p) => p.id).join(', ') || 'no promotions'} · refused scans <Flash value={r.posBlock.blockedScans} />
                </div>
              </div>
              {n && (
                <Flash value={n.status}>
                  <Chip tone={n.status === 'SENT' ? 'green' : 'amber'}>Notice {n.status === 'SENT' ? 'sent' : 'draft'}</Chip>
                </Flash>
              )}
            </div>
            {n && (
              <>
                <div className="notice-counts">
                  <div>
                    <span className="label">Buyers (members)</span>
                    <b>{num(n.buyers)}</b>
                  </div>
                  <div>
                    <span className="label">Push</span>
                    <b>{num(n.push)}</b>
                  </div>
                  <div>
                    <span className="label">Email</span>
                    <b>{num(n.email)}</b>
                  </div>
                  <div>
                    <span className="label">SMS</span>
                    <b>{num(n.sms)}</b>
                  </div>
                  <div>
                    <span className="label">Refunds so far</span>
                    <b>{num(n.refunds)}</b>
                  </div>
                  <div>
                    <span className="label">Non-member sales</span>
                    <b>{num(n.nonMemberSales)}</b>
                  </div>
                  <div>
                    <span className="label">In-store signage</span>
                    <b>{n.signage ? 'Yes' : 'No'}</b>
                  </div>
                </div>
                <div className="muted small">
                  {num(n.push + n.email + n.sms)} messages: push, email and SMS, by each buyer's consent.
                </div>
                <div className="notice-text">
                  <div className="subject">{n.subject}</div>
                  <div>{n.body}</div>
                </div>
                <div className="card-actions">
                  <button className="btn" disabled={!send} onClick={() => send && store.append(send)}>
                    {n.status === 'SENT' ? 'Notice sent' : `Send notice to ${num(n.buyers)} buyers`}
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })}
    </>
  )
}
