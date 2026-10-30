/**
 * Loyalty views over the shared state and event log (pure, no clock):
 * points redemption limits, a member's points history, tier info, personal
 * offers and the live programme scorecard. Everything is derived from events
 * since the last reset, so nothing here can disagree with the panes (SPEC §10.6).
 */
import type { AppState, DemoEvent, Member, TillRule } from '../../domain/types'

const cents = (n: number) => Math.round(n * 100) / 100

/** Funder name the coupon data uses for the retailer's own coupons (till.coupons[].funder). */
export const RETAILER = 'John Henry'

/** Dollar value of a number of points as tender (1,000 points = $5). */
export function pointsValueUsd(state: AppState, points: number): number {
  const { pointsPerReward, rewardUsd } = state.till.loyalty.burn
  return cents((points / pointsPerReward) * rewardUsd)
}

/** How many 1,000-point blocks a member can spend on a sale of `total` dollars. */
export function maxRedeemBlocks(state: AppState, member: Member | undefined, total: number): number {
  if (!member) return 0
  const { pointsPerReward, rewardUsd, minRedeem } = state.till.loyalty.burn
  if (member.points < minRedeem) return 0
  return Math.max(0, Math.min(Math.floor(member.points / pointsPerReward), Math.floor(total / rewardUsd)))
}

export function tierInfo(state: AppState, member: Member) {
  const { tiers } = state.till.loyalty
  const idx = tiers.findIndex((t) => t.name === member.tier)
  const tier = tiers[idx]
  return { tier, next: tiers[idx + 1] ?? null }
}

/** Coupons sitting in a member's wallet (live ones only). */
export function walletCoupons(state: AppState, memberId: string): Record<string, unknown>[] {
  const member = state.till.members.find((m) => m.id === memberId)
  if (!member) return []
  return member.clipped.map((id) => state.till.coupons.find((c) => c.id === id)).filter((c): c is Record<string, unknown> => !!c && c.status === 'live')
}

/** Live item coupons that Emily could still send to this member. */
export function sendableCoupons(state: AppState, memberId: string): Record<string, unknown>[] {
  const member = state.till.members.find((m) => m.id === memberId)
  if (!member) return []
  return state.till.coupons.filter((c) => c.status === 'live' && c.target === 'item' && !member.clipped.includes(c.id as string))
}

export interface LedgerRow {
  eventId: string
  type: 'EARN' | 'BURN'
  points: number
  balance: number
  txnId: string
  description: string
}

/** The member's points history for this session, newest first, with a running balance. */
export function memberLedger(state: AppState, memberId: string): LedgerRow[] {
  const member = state.till.members.find((m) => m.id === memberId)
  if (!member) return []
  const txnOf = (e: DemoEvent) => {
    const parent = state.events.find((x) => x.id === e.causedBy)
    return parent?.type === 'SALE_COMPLETED' ? (parent.payload as { txnId: string }).txnId : ''
  }
  const rows: Omit<LedgerRow, 'balance'>[] = []
  for (const e of state.events) {
    if (e.type === 'POINTS_AWARDED' && (e.payload as { memberId: string }).memberId === memberId) {
      const p = e.payload as DemoEvent<'POINTS_AWARDED'>['payload']
      const bonus = p.reasons.filter((r) => r.ruleId).reduce((s, r) => s + r.points, 0)
      rows.push({ eventId: e.id, type: 'EARN', points: p.points, txnId: txnOf(e), description: bonus > 0 ? `Purchase + ${bonus.toLocaleString()} bonus` : 'Purchase' })
    } else if (e.type === 'POINTS_REDEEMED' && (e.payload as { memberId: string }).memberId === memberId) {
      const p = e.payload as DemoEvent<'POINTS_REDEEMED'>['payload']
      rows.push({ eventId: e.id, type: 'BURN', points: -p.points, txnId: p.txnId, description: `Redeemed as tender: $${p.valueUsd.toFixed(2)} off` })
    }
  }
  let balance = member.points - rows.reduce((s, r) => s + r.points, 0)
  return rows
    .map((r) => ({ ...r, balance: (balance += r.points) }))
    .reverse()
}

export interface LastMemberSale {
  txnId: string
  member: Member | undefined
  pointsEarned: number
  pointsSpent: number
  couponsUsed: number
}

/** The most recent sale to a member, read from the shared log (so it shows however the sale was made). */
export function lastMemberSale(state: AppState): LastMemberSale | null {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i]
    if (e.type !== 'SALE_COMPLETED') continue
    const p = e.payload as DemoEvent<'SALE_COMPLETED'>['payload']
    if (!p.memberId) continue
    const pointsEarned = state.events.reduce((n, x) => (x.causedBy === e.id && x.type === 'POINTS_AWARDED' ? n + (x.payload as DemoEvent<'POINTS_AWARDED'>['payload']).points : n), 0)
    return { txnId: p.txnId, member: state.till.members.find((m) => m.id === p.memberId), pointsEarned, pointsSpent: p.pointsRedeemed ?? 0, couponsUsed: p.coupons?.length ?? 0 }
  }
  return null
}

export interface PersonalOfferRow {
  rule: TillRule
  member: Member | undefined
  timesEarned: number
  pointsEarned: number
}

/** 1:1 offers (till rules aimed at named members) and how often each paid out this session. */
export function personalOffers(state: AppState, memberId?: string): PersonalOfferRow[] {
  return state.till.rules
    .filter((r) => r.type === 'BONUS_POINTS' && Array.isArray(r.targetMemberIds) && (!memberId || (r.targetMemberIds as string[]).includes(memberId)))
    .map((rule) => {
      const hits = state.events
        .filter((e) => e.type === 'POINTS_AWARDED')
        .flatMap((e) => (e.payload as DemoEvent<'POINTS_AWARDED'>['payload']).reasons.filter((r) => r.ruleId === rule.id))
      return {
        rule,
        member: state.till.members.find((m) => m.id === (rule.targetMemberIds as string[])[0]),
        timesEarned: hits.length,
        pointsEarned: hits.reduce((s, r) => s + r.points, 0),
      }
    })
}

export interface Scorecard {
  sales: number
  memberSales: number
  identifiedPct: number
  pointsIssued: number
  pointsIssuedUsd: number
  pointsRedeemed: number
  pointsRedeemedUsd: number
  couponsRedeemed: number
  couponSavingsUsd: number
  supplierFundedUsd: number
  retailerFundedUsd: number
}

/** Live programme numbers since the last reset. */
export function programmeScorecard(state: AppState): Scorecard {
  const pointValue = state.till.loyalty.pointValueUsd
  let sales = 0
  let memberSales = 0
  let pointsIssued = 0
  let pointsRedeemed = 0
  let couponsRedeemed = 0
  let couponSavingsUsd = 0
  let supplierCoupons = 0
  for (const e of state.events) {
    if (e.type === 'SALE_COMPLETED') {
      sales += 1
      if ((e.payload as DemoEvent<'SALE_COMPLETED'>['payload']).memberId) memberSales += 1
    } else if (e.type === 'POINTS_AWARDED') {
      pointsIssued += (e.payload as DemoEvent<'POINTS_AWARDED'>['payload']).points
    } else if (e.type === 'POINTS_REDEEMED') {
      pointsRedeemed += (e.payload as DemoEvent<'POINTS_REDEEMED'>['payload']).points
    } else if (e.type === 'COUPON_REDEEMED') {
      const p = e.payload as DemoEvent<'COUPON_REDEEMED'>['payload']
      couponsRedeemed += 1
      couponSavingsUsd += p.amount
      if (p.funder !== RETAILER) supplierCoupons += p.amount
    }
  }
  // Cost of the programme = value of every point issued + coupon savings. Suppliers pay their share
  // of bonus points (offers' vendorPaidUsd) and their coupons; the retailer pays the rest, including base points.
  const supplierFundedUsd = cents(state.offers.reduce((s, o) => s + o.vendorPaidUsd, 0) + supplierCoupons)
  const retailerFundedUsd = cents(pointsIssued * pointValue + couponSavingsUsd - supplierFundedUsd)
  return {
    sales,
    memberSales,
    identifiedPct: sales === 0 ? 0 : Math.round((memberSales / sales) * 100),
    pointsIssued,
    pointsIssuedUsd: cents(pointsIssued * pointValue),
    pointsRedeemed,
    pointsRedeemedUsd: cents(pointsRedeemed * pointValue),
    couponsRedeemed,
    couponSavingsUsd: cents(couponSavingsUsd),
    supplierFundedUsd,
    retailerFundedUsd,
  }
}
