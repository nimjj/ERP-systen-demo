/** Emily's loyalty views: live programme scorecard, member card with wallet and points history, 1:1 offers. */
import { useState } from 'react'
import { issueCoupon } from '../actions'
import { memberLedger, personalOffers, pointsValueUsd, programmeScorecard, sendableCoupons, tierInfo, walletCoupons } from '../rules/engine/loyalty'
import { Chip, Flash, money, num } from './components'
import { useAppState, useEventStore } from './StoreContext'

const TIER_TONE = { Member: 'neutral', Silver: 'blue', Gold: 'amber' } as const
const couponLabel = (c: Record<string, unknown>) => `${c.name as string} · ${c.funder as string}`

/** Programme numbers since the last reset, derived from the event log. */
export function RewardsScorecard() {
  const state = useAppState()
  const c = programmeScorecard(state)
  const tiles: { label: string; value: string | number; sub: string }[] = [
    { label: 'Sales to members', value: `${c.identifiedPct}%`, sub: `${c.memberSales} of ${c.sales} sales` },
    { label: 'Points issued', value: num(c.pointsIssued), sub: `${money(c.pointsIssuedUsd)} of reward value` },
    { label: 'Points redeemed', value: num(c.pointsRedeemed), sub: `${money(c.pointsRedeemedUsd)} paid in points` },
    { label: 'Coupons used', value: c.couponsRedeemed, sub: `${money(c.couponSavingsUsd)} off` },
    { label: 'Supplier funded', value: money(c.supplierFundedUsd), sub: 'bonus points + coupons' },
    { label: 'Retailer funded', value: money(c.retailerFundedUsd), sub: 'base points + own coupons' },
  ]
  return (
    <div className="scorecard" aria-label="Rewards programme, live">
      {tiles.map((t) => (
        <div key={t.label} className="card card-tight">
          <span className="label">{t.label}</span>
          <Flash value={t.value} className="metric">
            {t.value}
          </Flash>
          <span className="muted small">{t.sub}</span>
        </div>
      ))}
    </div>
  )
}

/** 1:1 offers aimed at named members and what they paid out so far. */
export function PersonalOffersTable() {
  const state = useAppState()
  const rows = personalOffers(state)
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Personal offer</th>
          <th>Member</th>
          <th className="num">Paid out</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((o) => (
          <tr key={o.rule.id}>
            <td>
              <div className="cell-main">{o.rule.name.replace('Personal offer: ', '')}</div>
              <div className="muted small">{o.rule.id}</div>
            </td>
            <td>{o.member?.name}</td>
            <td className="num">
              <Flash value={o.timesEarned}>
                {o.timesEarned}× · {num(o.pointsEarned)} pts
              </Flash>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** One member: tier, balance, wallet, coupon to send, personal offers and points history. */
export function MemberCard({ memberId }: { memberId: string }) {
  const state = useAppState()
  const store = useEventStore()
  const [pick, setPick] = useState('')
  const member = state.till.members.find((m) => m.id === memberId)
  if (!member) return null
  const { tier } = tierInfo(state, member)
  const wallet = walletCoupons(state, memberId)
  const sendable = sendableCoupons(state, memberId)
  const couponId = sendable.some((c) => c.id === pick) ? pick : ((sendable[0]?.id as string | undefined) ?? '')
  const mine = personalOffers(state, memberId)
  const ledger = memberLedger(state, memberId)
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">{member.name}</div>
          <div className="muted small">
            Member since {member.since} · {member.homeStore}
          </div>
        </div>
        <div className="chips">
          <Chip tone={TIER_TONE[member.tier]}>
            {member.tier} · {tier?.multiplier}×
          </Chip>
          {member.rewardsPlus && <Chip tone="blue">Rewards Plus</Chip>}
        </div>
      </div>
      <div className="metrics metrics-3">
        <div>
          <span className="label">Points</span>
          <Flash value={member.points} className="metric">
            {num(member.points)}
          </Flash>
        </div>
        <div>
          <span className="label">Worth</span>
          <Flash value={member.points} className="metric">
            {money(pointsValueUsd(state, member.points))}
          </Flash>
        </div>
        <div>
          <span className="label">Coupons</span>
          <Flash value={wallet.length} className="metric">
            {wallet.length}
          </Flash>
        </div>
      </div>
      {tier && <div className="muted small tier-benefits">{tier.benefits.join(' · ')}</div>}

      <h4 className="section">Wallet</h4>
      {wallet.length === 0 ? (
        <div className="muted small">No coupons in the wallet.</div>
      ) : (
        <ul className="plain-list">
          {wallet.map((c) => (
            <li key={c.id as string}>
              <span>{c.name as string}</span>
              <Chip tone={c.kind === 'manufacturer' ? 'blue' : 'green'} title={c.kind === 'manufacturer' ? 'Reimbursed by the manufacturer' : 'Paid by the store'}>
                {c.funder as string}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <div className="field-row send-row">
        <select value={couponId} onChange={(e) => setPick(e.target.value)} aria-label="Coupon to send" disabled={sendable.length === 0}>
          {sendable.length === 0 && <option value="">Every live coupon is already in the wallet</option>}
          {sendable.map((c) => (
            <option key={c.id as string} value={c.id as string}>
              {couponLabel(c)}
            </option>
          ))}
        </select>
        <button className="btn btn-sm" disabled={!couponId} onClick={() => store.append(issueCoupon(couponId, memberId))}>
          Send to wallet
        </button>
      </div>

      {mine.length > 0 && (
        <>
          <h4 className="section">Personal offers</h4>
          <ul className="plain-list">
            {mine.map((o) => (
              <li key={o.rule.id}>
                <span>{o.rule.name.replace('Personal offer: ', '')}</span>
                <Chip tone={o.timesEarned > 0 ? 'green' : 'neutral'}>{o.timesEarned > 0 ? `paid ${num(o.pointsEarned)} pts` : 'not used yet'}</Chip>
              </li>
            ))}
          </ul>
        </>
      )}

      <h4 className="section">Points activity</h4>
      {ledger.length === 0 ? (
        <div className="muted small">No activity yet. Purchases and redemptions at the till appear here as they happen.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>What</th>
              <th className="num">Points</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((r) => (
              <tr key={r.eventId}>
                <td>
                  <div className="cell-main">{r.description}</div>
                  <div className="muted small">{r.txnId}</div>
                </td>
                <td className="num">
                  <Flash value={r.eventId}>
                    {r.points > 0 ? '+' : '−'}
                    {num(Math.abs(r.points))}
                  </Flash>
                </td>
                <td className="num">{num(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** Member picker + card + 1:1 offers: the Members tab of Emily's pane. */
export function MembersTab() {
  const state = useAppState()
  const [memberId, setMemberId] = useState('M-1001')
  return (
    <>
      <div className="field-row member-pick">
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)} aria-label="Member">
          {state.till.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.tier}
            </option>
          ))}
        </select>
      </div>
      <MemberCard memberId={memberId} />
      <h4 className="section">Personalised offers</h4>
      <PersonalOffersTable />
    </>
  )
}
