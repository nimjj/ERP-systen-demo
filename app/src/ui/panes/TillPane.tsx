/**
 * Jamal — till. The basket is the cashier's draft (local to this pane); nothing
 * shared changes until "Complete sale", which emits SALE_COMPLETED.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { completeSale as completeSaleDraft, scanBlocked } from '../../actions'
import { lastMemberSale, maxRedeemBlocks, personalOffers, pointsValueUsd, tierInfo, walletCoupons } from '../../rules/engine/loyalty'
import { priceBasket, resolveCode, type BasketItem } from '../../rules/engine/tillPricing'
import { Chip, Flash, money, num, PaneFrame } from '../components'
import { useAppState, useEventStore } from '../StoreContext'

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
  /** Blocks of 1,000 points the member chose to pay with (the cashier's draft, like the basket). */
  const [redeemBlocks, setRedeemBlocks] = useState(0)

  const basket = useMemo(() => {
    const merged = new Map<string, number>()
    for (const s of scans) merged.set(s.sku, Math.round(((merged.get(s.sku) ?? 0) + s.qty) * 100) / 100)
    return [...merged].map(([sku, qty]) => ({ sku, qty }))
  }, [scans])
  // A recall issued while an item is already in the basket takes it out of the sale.
  const sellable = useMemo(() => basket.filter((b) => !till.blockedSkus.includes(b.sku)), [basket, till.blockedSkus])
  const removed = basket.filter((b) => till.blockedSkus.includes(b.sku))
  const priced = useMemo(() => priceBasket(state, sellable, memberId), [state, sellable, memberId])
  const activeRecalls = state.recalls.filter((r) => r.status === 'ISSUED' && till.blockedSkus.includes(r.itemId))
  const member = till.members.find((m) => m.id === memberId)
  const { burn } = till.loyalty
  const maxBlocks = maxRedeemBlocks(state, member, priced.total)
  const blocks = Math.min(redeemBlocks, maxBlocks)
  const pointsRedeemed = blocks * burn.pointsPerReward
  const pointsOff = pointsValueUsd(state, pointsRedeemed)
  const cardDue = Math.round((priced.total - pointsOff) * 100) / 100
  const wallet = member ? walletCoupons(state, member.id) : []
  const personal = member ? personalOffers(state, member.id) : []
  const lastSale = useMemo(() => lastMemberSale(state), [state])
  const listRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    listRef.current?.querySelector('.just-scanned')?.scrollIntoView({ block: 'nearest' })
  }, [scans])

  function add(sku: string, code?: string) {
    const entry = till.catalogue.find((c) => c.id === sku)
    if (!entry) return
    if (till.blockedSkus.includes(sku)) {
      setAlert(`RECALLED — do not sell: ${entry.name}`)
      const refused = scanBlocked(state, sku)
      if (refused) store.append(refused)
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
    store.append(completeSaleDraft(state, sellable, memberId, 0, { redeemPoints: pointsRedeemed }))
    setScans([])
    setMemberId(null)
    setRedeemBlocks(0)
    setAlert(null)
    setLast(null)
  }

  const liveRules = till.rules.filter((r) => r.status === 'live').length

  return (
    <PaneFrame role="jamal" onExpand={onExpand} actions={<Chip tone="blue">Lane 4</Chip>}>
      <div className="till">
        <div className="till-basket">
          {activeRecalls.map((r) => (
            <div key={r.id} className="banner banner-recall">
              <span>
                <b>Recall {r.id}:</b> {r.itemName} is blocked at this till. Refused scans: <Flash value={r.posBlock.blockedScans} />
              </span>
            </div>
          ))}
          {alert && <div className="banner banner-red">⛔ {alert}</div>}
          {removed.length > 0 && <div className="banner banner-red">Removed from this sale (recalled): {removed.map((b) => till.catalogue.find((c) => c.id === b.sku)?.name).join(', ')}</div>}
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
                    <div key={a.ruleId} className={a.ruleId.startsWith('CP-') ? 'till-row till-coupon' : 'till-row till-promo'}>
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
            {pointsRedeemed > 0 && (
              <div>
                <span className="label">{num(pointsRedeemed)} pts</span>
                <b className="save">−{money(pointsOff)}</b>
              </div>
            )}
            <div className="till-total">
              <span className="label">{pointsRedeemed > 0 ? 'Card to pay' : 'Total'}</span>
              <b>{money(pointsRedeemed > 0 ? cardDue : priced.total)}</b>
            </div>
          </div>
        </div>

        <div className="till-side">
          <button className="scan-btn" onClick={scanNext}>
            <span>▮▯▮▮ Scan next item</span>
            <span className="muted-on-amber">simulated scanner</span>
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
            <select
              value={memberId ?? ''}
              onChange={(e) => {
                setMemberId(e.target.value || null)
                setRedeemBlocks(0)
              }}
              aria-label="Rewards member"
            >
              <option value="">No member</option>
              {till.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.tier}
                </option>
              ))}
            </select>
            {member && (
              <>
                <div className="member-line">
                  <span>
                    {member.name} · {member.tier} {tierInfo(state, member).tier?.multiplier}×
                    {member.rewardsPlus && (
                      <>
                        {' '}
                        <Chip tone="blue">Rewards Plus</Chip>
                      </>
                    )}
                  </span>
                  <Flash value={member.points}>{num(member.points)} pts</Flash>
                </div>
                <div className="muted small">
                  {money(pointsValueUsd(state, member.points))} · <Flash value={wallet.length}>{wallet.length}</Flash> {wallet.length === 1 ? 'coupon' : 'coupons'} in wallet
                  {priced.points && <> · earns {num(priced.points.points)} pts</>}
                </div>
                {personal.length > 0 && (
                  <div className="chips">
                    {personal.map((o) => (
                      <Chip key={o.rule.id} tone="blue" title={o.rule.name}>
                        ★ {o.rule.name.replace('Personal offer: ', '')}
                      </Chip>
                    ))}
                  </div>
                )}
              </>
            )}
            {member && maxBlocks > 0 && (
              <div className="redeem-row">
                <span title={`${num(burn.pointsPerReward)} points = ${money(burn.rewardUsd)} off`}>Pay with points</span>
                <span className="stepper">
                  <button className="btn btn-quiet btn-sm" disabled={blocks === 0} onClick={() => setRedeemBlocks(blocks - 1)} aria-label="Use fewer points">
                    −
                  </button>
                  <b>{num(pointsRedeemed)}</b>
                  <button className="btn btn-quiet btn-sm" disabled={blocks >= maxBlocks} onClick={() => setRedeemBlocks(blocks + 1)} aria-label="Use more points">
                    +
                  </button>
                </span>
              </div>
            )}
          </div>
          {priced.lines.length === 0 && lastSale && (
            <div className="last-sale" aria-live="polite">
              <b>Last member sale {lastSale.txnId}</b>
              <span>
                {lastSale.member?.name} · <Flash value={lastSale.pointsEarned}>+{num(lastSale.pointsEarned)} pts</Flash>
                {lastSale.pointsSpent > 0 && <> · −{num(lastSale.pointsSpent)} pts spent</>}
                {lastSale.couponsUsed > 0 && (
                  <>
                    {' '}
                    · {lastSale.couponsUsed} {lastSale.couponsUsed === 1 ? 'coupon' : 'coupons'} used
                  </>
                )}
                {lastSale.member && <> · balance {num(lastSale.member.points)}</>}
              </span>
            </div>
          )}
          <div className="muted small">
            {liveRules} till promotions live
            {till.rules.find((r) => r.id === 'R-BP-801')?.status === 'live' && (
              <>
                {' · '}
                <Chip tone="green">+200 pts Greek yogurt</Chip>
              </>
            )}
          </div>
          <div className="till-pay">
            <button className="btn btn-pay" disabled={priced.lines.length === 0} onClick={completeSale}>
              Complete sale · {money(pointsRedeemed > 0 ? cardDue : priced.total)}
            </button>
            <button className="btn btn-quiet" disabled={scans.length === 0} onClick={() => setScans([])}>
              Void
            </button>
          </div>
        </div>
      </div>
    </PaneFrame>
  )
}
