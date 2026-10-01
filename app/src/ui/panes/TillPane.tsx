/**
 * Jamal — till. The basket is the cashier's draft (local to this pane); nothing
 * shared changes until "Complete sale", which emits SALE_COMPLETED.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { priceBasket, resolveCode, type BasketItem } from '../../rules/engine/tillPricing'
import { Chip, Flash, money, num, PaneFrame } from '../components'
import { useAppState, useEventStore } from '../StoreContext'

let txnCounter = 0
const newTxnId = () => `1101-04-${Date.now().toString().slice(-6)}${++txnCounter}`

export function TillPane({ onExpand }: { onExpand?: () => void }) {
  const state = useAppState()
  const store = useEventStore()
  const { till } = state
  const [scans, setScans] = useState<BasketItem[]>([])
  const [cursor, setCursor] = useState(0)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [lookup, setLookup] = useState('SKU-100221')
  const [alert, setAlert] = useState<string | null>(null)
  const [last, setLast] = useState<string | null>(null)

  const basket = useMemo(() => {
    const merged = new Map<string, number>()
    for (const s of scans) merged.set(s.sku, Math.round(((merged.get(s.sku) ?? 0) + s.qty) * 100) / 100)
    return [...merged].map(([sku, qty]) => ({ sku, qty }))
  }, [scans])
  const priced = useMemo(() => priceBasket(state, basket, memberId), [state, basket, memberId])
  const member = till.members.find((m) => m.id === memberId)
  const listRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    listRef.current?.querySelector('.just-scanned')?.scrollIntoView({ block: 'nearest' })
  }, [scans])

  function add(sku: string, code?: string) {
    const entry = till.catalogue.find((c) => c.id === sku)
    if (!entry) return
    if (till.blockedSkus.includes(sku)) {
      setAlert(`RECALLED — do not sell: ${entry.name}`)
      return
    }
    const keyIndex = code ? till.quickKeys.findIndex((k) => k.code === code) : -1
    const qty = entry.unit === 'lb' ? (till.scaleWeights[keyIndex] ?? 1) : 1
    setAlert(null)
    setLast(sku)
    setScans((s) => [...s, { sku, qty }])
  }

  function scanNext() {
    const code = till.scanScript[cursor % till.scanScript.length]
    setCursor((c) => c + 1)
    const sku = resolveCode(state, code)
    if (sku) add(sku, code)
  }

  function completeSale() {
    if (priced.lines.length === 0) return
    store.append({
      type: 'SALE_COMPLETED',
      actor: 'jamal',
      payload: { txnId: newTxnId(), memberId, lines: priced.saleLines, total: priced.total, tax: priced.tax, tender: 'Card' },
    })
    setScans([])
    setMemberId(null)
    setAlert(null)
    setLast(null)
  }

  const liveRules = till.rules.filter((r) => r.status === 'live').length

  return (
    <PaneFrame role="jamal" onExpand={onExpand} actions={<Chip tone="blue">Lane 4</Chip>}>
      <div className="till">
        <div className="till-basket">
          {alert && <div className="banner banner-red">{alert}</div>}
          {priced.lines.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">Ready for the next customer</div>
              <div>Press Scan next item to simulate the scanner, or key an item.</div>
            </div>
          ) : (
            <ul className="till-lines" ref={listRef}>
              {priced.lines.map((l) => (
                <li key={l.sku} className={l.sku === last ? 'till-line just-scanned' : 'till-line'}>
                  <div className="till-row">
                    <span className="till-name">
                      {l.name}
                      <span className="muted"> {l.unit === 'lb' ? `${l.qty} lb @ ${money(l.unitPrice)}/lb` : `${l.qty} × ${money(l.unitPrice)}`}</span>
                    </span>
                    <span className="till-amt">{money(l.base)}</span>
                  </div>
                  {l.adjustments.map((a) => (
                    <div key={a.ruleId} className="till-row till-promo">
                      <span>{a.label}</span>
                      <span>{money(a.amount)}</span>
                    </div>
                  ))}
                  {l.bonus.map((b) => (
                    <div key={b.ruleId} className="till-row till-bonus">
                      <span>★ {b.label}</span>
                      <span>+{num(b.points)} pts</span>
                    </div>
                  ))}
                </li>
              ))}
              {priced.basketAdjustments.map((a) => (
                <li key={a.ruleId} className="till-line">
                  <div className="till-row till-promo">
                    <span>{a.label}</span>
                    <span>{money(a.amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="till-totals">
            <div>
              <span className="label">Items</span>
              <b>{priced.items}</b>
            </div>
            <div>
              <span className="label">Subtotal</span>
              <b>{money(priced.subtotal)}</b>
            </div>
            <div>
              <span className="label">You save</span>
              <b className="save">−{money(priced.savings)}</b>
            </div>
            <div>
              <span className="label">Tax 8.25%</span>
              <b>{money(priced.tax)}</b>
            </div>
            <div className="till-total">
              <span className="label">Total</span>
              <b>{money(priced.total)}</b>
            </div>
          </div>
        </div>

        <div className="till-side">
          <button className="scan-btn" onClick={scanNext}>
            <span>▮▯▮▮ Scan next item</span>
            <span className="muted-on-amber">simulated scanner · {till.scanScript.length}-item script</span>
          </button>
          <div className="field-row">
            <select value={lookup} onChange={(e) => setLookup(e.target.value)} aria-label="Item lookup">
              {till.catalogue.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="btn btn-quiet" onClick={() => add(lookup, lookup.startsWith('PLU-') ? lookup.slice(4) : undefined)}>
              Key item
            </button>
          </div>
          <div className="card card-tight">
            <div className="card-title">Rewards member</div>
            <select value={memberId ?? ''} onChange={(e) => setMemberId(e.target.value || null)} aria-label="Rewards member">
              <option value="">No member</option>
              {till.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.tier}
                </option>
              ))}
            </select>
            {member && (
              <div className="member-line">
                <span>
                  {member.name} · {member.tier}
                </span>
                <Flash value={member.points}>{num(member.points)} pts</Flash>
              </div>
            )}
            {member && priced.points && <div className="muted small">This sale earns {num(priced.points.points)} points.</div>}
          </div>
          <div className="muted small">
            {liveRules} till promotions live
            {till.rules.find((r) => r.id === 'R-BP-801')?.status === 'live' && (
              <>
                {' · '}
                <Chip tone="green">+200 pts Greek yogurt</Chip>
              </>
            )}
          </div>
          <button className="btn btn-pay" disabled={priced.lines.length === 0} onClick={completeSale}>
            Complete sale · {money(priced.total)}
          </button>
          <button className="btn btn-quiet" disabled={scans.length === 0} onClick={() => setScans([])}>
            Void basket
          </button>
        </div>
      </div>
    </PaneFrame>
  )
}
