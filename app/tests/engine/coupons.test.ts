/** Wallet coupons at the till (stacking steps 6 and 7) and points as tender. */
import { describe, expect, it } from 'vitest'
import { completeSale, redeemablePoints } from '../../src/actions'
import { maxRedeemBlocks, pointsValueUsd } from '../../src/rules/engine/loyalty'
import { priceBasket } from '../../src/rules/engine/tillPricing'
import { buildSeedState } from '../../src/seed/loadSeed'
import { MARIA, Sim, YOGURT } from '../helpers'

const STRAWBERRIES = 'SKU-100410'
const BATH_TISSUE = 'SKU-100375'
const MUFFINS = 'SKU-100284'

describe('wallet coupons at the till', () => {
  const s = buildSeedState()

  it("applies a member's store coupon (strawberries $1 off) and nobody else's", () => {
    const maria = priceBasket(s, [{ sku: STRAWBERRIES, qty: 1 }], MARIA)
    expect(maria.lines[0].net).toBe(1.67) // 10% off produce first (2.67), then the $1 coupon
    expect(maria.coupons).toEqual([{ couponId: 'CP-D-01', sku: STRAWBERRIES, amount: 1, funder: 'John Henry', kind: 'store' }])
    expect(priceBasket(s, [{ sku: STRAWBERRIES, qty: 1 }], 'M-1004').coupons).toEqual([])
    expect(priceBasket(s, [{ sku: STRAWBERRIES, qty: 1 }], null).coupons).toEqual([])
  })

  it('a percentage coupon takes the percentage of the line (muffins 20% off, Sofia)', () => {
    const p = priceBasket(s, [{ sku: MUFFINS, qty: 1 }], 'M-1005')
    expect(p.coupons.map((c) => [c.couponId, c.amount])).toEqual([['CP-D-03', 1]])
    expect(p.lines[0].net).toBe(3.98)
  })

  it('a manufacturer coupon does not reduce the taxable price; a store coupon does', () => {
    const mfr = priceBasket(s, [{ sku: BATH_TISSUE, qty: 1 }], MARIA)
    expect(mfr.lines[0].net).toBe(11.97)
    expect(mfr.tax).toBe(1.15) // 8.25% of 13.97, not of 11.97
    expect(mfr.total).toBe(13.12)
    expect(mfr.subtotal - mfr.savings + mfr.tax).toBeCloseTo(mfr.total, 2)
    const noCoupon = priceBasket(s, [{ sku: BATH_TISSUE, qty: 1 }], 'M-1004')
    expect(noCoupon.tax).toBe(1.15)
  })

  it('a coupon that is not in the wallet is not applied until Emily sends it, then it respects the per-transaction limit', () => {
    expect(priceBasket(s, [{ sku: YOGURT, qty: 2 }], MARIA).coupons).toEqual([])
    const sim = new Sim()
    sim.do({ type: 'COUPON_ISSUED', actor: 'emily', payload: { couponId: 'CP-M-02', memberId: MARIA } })
    expect(sim.state.till.members.find((m) => m.id === MARIA)!.clipped).toContain('CP-M-02')
    const two = priceBasket(sim.state, [{ sku: YOGURT, qty: 2 }], MARIA)
    expect(two.coupons[0].amount).toBe(1.5)
    const three = priceBasket(sim.state, [{ sku: YOGURT, qty: 3 }], MARIA)
    expect(three.coupons[0].amount).toBe(1.5) // limitPerTxn 2
  })

  it('sending the same coupon twice puts it in the wallet once', () => {
    const sim = new Sim()
    const send = { type: 'COUPON_ISSUED', actor: 'emily', payload: { couponId: 'CP-M-02', memberId: MARIA } } as const
    sim.do(send)
    sim.do(send)
    expect(sim.state.till.members.find((m) => m.id === MARIA)!.clipped.filter((c) => c === 'CP-M-02')).toHaveLength(1)
  })

  it('points are earned on the price after coupons', () => {
    const p = priceBasket(s, [{ sku: STRAWBERRIES, qty: 1 }], MARIA)
    expect(p.saleLines[0].price).toBe(1.67)
    expect(p.points!.points).toBe(2) // floor(1.67 × 1.5)
  })
})

describe('points as tender', () => {
  const s = buildSeedState()

  it('1,000 points are worth $5', () => {
    expect(pointsValueUsd(s, 1000)).toBe(5)
    expect(pointsValueUsd(s, 3000)).toBe(15)
  })

  it('whole blocks only, within the balance and the sale total', () => {
    const maria = s.till.members.find((m) => m.id === MARIA)!
    expect(maxRedeemBlocks(s, maria, 5.98)).toBe(1)
    expect(maxRedeemBlocks(s, maria, 4.99)).toBe(0)
    expect(maxRedeemBlocks(s, maria, 500)).toBe(8) // 8,420 points
    expect(maxRedeemBlocks(s, s.till.members.find((m) => m.id === 'M-1003'), 50)).toBe(0) // 640 points
    expect(maxRedeemBlocks(s, undefined, 50)).toBe(0)
    expect(redeemablePoints(s, MARIA, 20, 2500)).toBe(2000)
    expect(redeemablePoints(s, MARIA, 20, 999)).toBe(0)
    expect(redeemablePoints(s, null, 20, 1000)).toBe(0)
  })

  it('a sale built with redeemPoints carries pointsRedeemed and the tender; a guest sale ignores it', () => {
    const paid = completeSale(s, [{ sku: YOGURT, qty: 1 }], MARIA, 0, { redeemPoints: 1000 })
    expect(paid.payload).toMatchObject({ pointsRedeemed: 1000, tender: 'Card + Points', memberId: MARIA })
    const guest = completeSale(s, [{ sku: YOGURT, qty: 1 }], null, 0, { redeemPoints: 1000 })
    expect(guest.payload).not.toHaveProperty('pointsRedeemed')
    expect((guest.payload as { tender: string }).tender).toBe('Card')
  })
})
