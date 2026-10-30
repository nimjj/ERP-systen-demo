import { describe, expect, it } from 'vitest'
import { completeSale, issueCoupon } from '../../src/actions'
import { c17CouponRedeemed } from '../../src/rules/c17CouponRedeemed'
import { c19PointsRedeemed } from '../../src/rules/c19PointsRedeemed'
import { memberLedger, personalOffers, programmeScorecard, sendableCoupons, walletCoupons } from '../../src/rules/engine/loyalty'
import { afterReducer, MARIA, ofType, publishOffer, sale, Sim, YOGURT } from '../helpers'

const STRAWBERRIES = 'SKU-100410'
const member = (sim: Sim, id = MARIA) => sim.state.till.members.find((m) => m.id === id)!

describe('C17 coupon redeemed', () => {
  it('emits one COUPON_REDEEMED per coupon on the sale, nothing without coupons', () => {
    const sim = new Sim()
    const draft = completeSale(sim.state, [{ sku: STRAWBERRIES, qty: 1 }], MARIA)
    const { state, event } = afterReducer(draft)
    expect(c17CouponRedeemed.run(state, event).newEvents).toEqual([
      { type: 'COUPON_REDEEMED', actor: 'system', payload: { couponId: 'CP-D-01', memberId: MARIA, sku: STRAWBERRIES, amount: 1, funder: 'John Henry', txnId: expect.any(String) } },
    ])
    const plain = afterReducer(sale([{ sku: YOGURT, qty: 1 }], MARIA))
    expect(c17CouponRedeemed.run(plain.state, plain.event).newEvents).toEqual([])
  })

  it('through the pipeline the coupon leaves the wallet, is counted, and every event is caused by the sale', () => {
    const sim = new Sim()
    const events = sim.do(completeSale(sim.state, [{ sku: STRAWBERRIES, qty: 1 }], MARIA))
    const used = ofType(events, 'COUPON_REDEEMED')
    expect(used).toHaveLength(1)
    expect(used[0].causedBy).toBe(events[0].id)
    expect(member(sim).clipped).toEqual(['CP-D-02'])
    expect(sim.state.till.coupons.find((c) => c.id === 'CP-D-01')!.redeemedInDemo).toBe(1)
  })

  it('a coupon can be used once: the second sale gets no discount', () => {
    const sim = new Sim()
    sim.do(completeSale(sim.state, [{ sku: STRAWBERRIES, qty: 1 }], MARIA))
    const events = sim.do(completeSale(sim.state, [{ sku: STRAWBERRIES, qty: 1 }], MARIA))
    expect(ofType(events, 'COUPON_REDEEMED')).toHaveLength(0)
  })
})

describe('C19 points redeemed', () => {
  it('emits POINTS_REDEEMED with the dollar value; nothing when no points were spent', () => {
    const paid = afterReducer(completeSale(new Sim().state, [{ sku: YOGURT, qty: 1 }], MARIA, 0, { redeemPoints: 1000 }))
    expect(c19PointsRedeemed.run(paid.state, paid.event).newEvents).toEqual([
      { type: 'POINTS_REDEEMED', actor: 'system', payload: { memberId: MARIA, txnId: expect.any(String), points: 1000, valueUsd: 5 } },
    ])
    const plain = afterReducer(sale([{ sku: YOGURT, qty: 1 }], MARIA))
    expect(c19PointsRedeemed.run(plain.state, plain.event).newEvents).toEqual([])
  })

  it('the balance falls by the points spent and rises by the points earned', () => {
    const sim = new Sim()
    sim.do(completeSale(sim.state, [{ sku: YOGURT, qty: 1 }], MARIA, 0, { redeemPoints: 1000 }))
    expect(member(sim).points).toBe(8420 + 8 - 1000)
  })
})

describe('loyalty views', () => {
  it('points history: opening balance, then earn and burn rows with a running balance, newest first', () => {
    const sim = new Sim()
    sim.do(completeSale(sim.state, [{ sku: YOGURT, qty: 1 }], MARIA, 0, { redeemPoints: 1000 }))
    sim.do(completeSale(sim.state, [{ sku: YOGURT, qty: 1 }], MARIA))
    const rows = memberLedger(sim.state, MARIA)
    expect(rows.map((r) => [r.type, r.points, r.balance])).toEqual([
      ['EARN', 8, 7436],
      ['BURN', -1000, 7428],
      ['EARN', 8, 8428],
    ])
    expect(rows[0].txnId).toMatch(/^1101-04-/)
    expect(memberLedger(sim.state, 'M-1004')).toEqual([])
  })

  it("wallet shows the member's live coupons; Emily can send the ones not yet there", () => {
    const sim = new Sim()
    expect(walletCoupons(sim.state, MARIA).map((c) => c.id)).toEqual(['CP-D-01', 'CP-D-02'])
    expect(sendableCoupons(sim.state, MARIA).map((c) => c.id)).toContain('CP-M-02')
    sim.do(issueCoupon('CP-M-02', MARIA))
    expect(walletCoupons(sim.state, MARIA).map((c) => c.id)).toContain('CP-M-02')
    expect(sendableCoupons(sim.state, MARIA).map((c) => c.id)).not.toContain('CP-M-02')
    expect(sendableCoupons(sim.state, MARIA).every((c) => c.status === 'live' && c.target === 'item')).toBe(true)
  })

  it('personal offers list who they are for and what they paid out', () => {
    const sim = new Sim()
    expect(personalOffers(sim.state).map((o) => [o.rule.id, o.timesEarned])).toEqual([['R-PO-901', 0], ['R-PO-902', 0], ['R-PO-903', 0]])
    expect(personalOffers(sim.state, MARIA).map((o) => o.rule.id)).toEqual(['R-PO-901'])
    sim.do(sale([{ sku: 'SKU-100326', qty: 1 }], 'M-1002')) // Daniel: 250 bonus on sparkling water
    const daniel = personalOffers(sim.state, 'M-1002')
    expect(daniel).toHaveLength(1)
    expect([daniel[0].timesEarned, daniel[0].pointsEarned]).toEqual([1, 250])
  })

  it('the scorecard starts at zero and is derived from the events', () => {
    const sim = new Sim()
    expect(programmeScorecard(sim.state)).toMatchObject({ sales: 0, pointsIssued: 0, pointsRedeemed: 0, supplierFundedUsd: 0, identifiedPct: 0 })
    sim.do(publishOffer())
    sim.do(completeSale(sim.state, [{ sku: YOGURT, qty: 1 }], MARIA, 0, { redeemPoints: 1000 })) // 8 + 200 points, 1,000 spent
    sim.do(sale([{ sku: YOGURT, qty: 1 }])) // guest
    const c = programmeScorecard(sim.state)
    expect([c.sales, c.memberSales, c.identifiedPct]).toEqual([2, 1, 50])
    expect([c.pointsIssued, c.pointsIssuedUsd]).toEqual([208, 1.04])
    expect([c.pointsRedeemed, c.pointsRedeemedUsd]).toEqual([1000, 5])
    expect(c.supplierFundedUsd).toBe(1) // 200 points × $0.005, Prairie Gold funds 100%
    expect(c.retailerFundedUsd).toBe(0.04) // the 8 base points; 208 × $0.005 = $1.04 in all
  })

  it('coupon savings are split by who funds them', () => {
    const sim = new Sim()
    sim.do(issueCoupon('CP-M-02', MARIA)) // Prairie Gold $0.75
    sim.do(completeSale(sim.state, [{ sku: YOGURT, qty: 1 }, { sku: STRAWBERRIES, qty: 1 }], MARIA))
    const c = programmeScorecard(sim.state)
    expect(c.couponsRedeemed).toBe(2)
    expect(c.couponSavingsUsd).toBe(1.75)
    expect(c.supplierFundedUsd).toBe(0.75)
    expect(c.retailerFundedUsd).toBe(1.05) // the $1.00 strawberry coupon + 10 base points ($0.05)
  })
})
