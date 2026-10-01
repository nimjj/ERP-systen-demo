import { describe, expect, it } from 'vitest'
import { priceBasket, resolveCode } from '../../src/rules/engine/tillPricing'
import { buildSeedState } from '../../src/seed/loadSeed'
import { MARIA, publishOffer, Sim, YOGURT } from '../helpers'

const s = buildSeedState()

describe('till pricing', () => {
  it('resolves GTINs and PLUs from the scan script', () => {
    expect(resolveCode(s, '041300023757')).toBe(YOGURT)
    expect(resolveCode(s, '4011')).toBe('PLU-4011')
    expect(resolveCode(s, '999')).toBeNull()
  })

  it('member price applies to members only (eggs $3.97)', () => {
    const guest = priceBasket(s, [{ sku: 'SKU-100214', qty: 1 }], null)
    const member = priceBasket(s, [{ sku: 'SKU-100214', qty: 1 }], MARIA)
    expect(guest.lines[0].adjustments).toEqual([])
    expect(member.lines[0].net).toBe(3.97)
    expect(member.lines[0].adjustments[0].ruleId).toBe('R-MP-101')
  })

  it('milk 2 for $6 and bread BOGO (cheapest free)', () => {
    const b = priceBasket(
      s,
      [
        { sku: 'SKU-100200', qty: 2 },
        { sku: 'SKU-100256', qty: 1 },
        { sku: 'SKU-100263', qty: 1 },
      ],
      null,
    )
    expect(b.lines[0].net).toBe(6)
    const white = b.lines[1]
    const wheat = b.lines[2]
    const cheaper = white.unitPrice <= wheat.unitPrice ? white : wheat
    expect(cheaper.net).toBe(0)
  })

  it('10% off Fresh Produce on a weighed item; no tax on groceries, 8.25% on household', () => {
    const b = priceBasket(
      s,
      [
        { sku: 'PLU-4011', qty: 2.87 },
        { sku: 'SKU-100354', qty: 1 },
      ],
      null,
    )
    expect(b.lines[0].adjustments[0].ruleId).toBe('R-PC-501')
    expect(b.tax).toBe(Math.round(b.lines[1].net * 0.0825 * 100) / 100)
    expect(b.total).toBe(Math.round((b.lines[0].net + b.lines[1].net + b.tax) * 100) / 100)
  })

  it('the bonus line shows on yogurt once OF-3101 is published (C1 on the till)', () => {
    expect(priceBasket(s, [{ sku: YOGURT, qty: 1 }], MARIA).lines[0].bonus).toEqual([])
    const sim = new Sim()
    sim.do(publishOffer())
    const b = priceBasket(sim.state, [{ sku: YOGURT, qty: 1 }], MARIA)
    expect(b.lines[0].bonus).toEqual([expect.objectContaining({ ruleId: 'R-BP-801', points: 200 })])
    expect(b.points!.points).toBe(208)
  })

  it('the full 18-item scan script prices without errors and the sale lines carry net unit prices', () => {
    const skus = s.till.scanScript.map((c) => resolveCode(s, c)!).filter(Boolean)
    const counts = new Map<string, number>()
    for (const k of skus) counts.set(k, (counts.get(k) ?? 0) + 1)
    const b = priceBasket(s, [...counts].map(([sku, qty]) => ({ sku, qty })), MARIA)
    expect(b.lines).toHaveLength(counts.size)
    expect(b.total).toBeGreaterThan(0)
    for (const l of b.saleLines) expect(Number.isFinite(l.price)).toBe(true)
  })
})

describe('till totals reconcile', () => {
  it('subtotal − savings + tax = total, to the cent, for the full scan script', () => {
    const skus = s.till.scanScript.map((c) => resolveCode(s, c)!).filter(Boolean)
    const counts = new Map<string, number>()
    for (const k of skus) counts.set(k, (counts.get(k) ?? 0) + (k === 'PLU-4011' ? 2.87 : 1))
    const b = priceBasket(s, [...counts].map(([sku, qty]) => ({ sku, qty })), null)
    expect(Math.round((b.subtotal - b.savings + b.tax) * 100)).toBe(Math.round(b.total * 100))
    expect(b.basketAdjustments.map((a) => a.ruleId)).toEqual(['R-SS-601'])
  })
})
