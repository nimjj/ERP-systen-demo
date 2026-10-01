import { describe, expect, it } from 'vitest'
import { c7MemberPoints as rule } from '../../src/rules/c7MemberPoints'
import { computePoints } from '../../src/rules/engine/points'
import { buildSeedState } from '../../src/seed/loadSeed'
import { afterReducer, MARIA, sale, YOGURT } from '../helpers'

describe('C7 member points', () => {
  it('tier multiplier: Gold 1.5×, Silver 1.25×, Member 1×', () => {
    const s = buildSeedState()
    const lines = [{ sku: YOGURT, qty: 2, price: 5.98, promoApplied: [] }] // $11.96
    expect(computePoints(s, 'M-1001', lines)!.reasons[0].points).toBe(17) // Gold: 17.94
    expect(computePoints(s, 'M-1002', lines)!.reasons[0].points).toBe(14) // Silver: 14.95
    expect(computePoints(s, 'M-1003', lines)!.reasons[0].points).toBe(11) // Member: 11.96
  })

  it('excluded departments earn no points', () => {
    const s = buildSeedState()
    const beer = s.till.catalogue.find((c) => c.id === 'POS-BEER-01')!
    expect(computePoints(s, 'M-1004', [{ sku: beer.id, qty: 1, price: beer.price, promoApplied: [] }])!.points).toBe(0)
  })

  it("personal offers only for their target member: Maria's 500 pts at $50+", () => {
    const s = buildSeedState()
    const big = [{ sku: 'SKU-100354', qty: 5, price: 12.98, promoApplied: [] }] // $64.90
    expect(computePoints(s, 'M-1001', big)!.reasons.map((r) => r.ruleId)).toContain('R-PO-901')
    expect(computePoints(s, 'M-1004', big)!.reasons.map((r) => r.ruleId)).not.toContain('R-PO-901')
  })

  it('rule emits one POINTS_AWARDED for a member sale, nothing for a guest', () => {
    const member = afterReducer(sale([{ sku: YOGURT, qty: 1 }], MARIA))
    expect(rule.run(member.state, member.event).newEvents).toEqual([
      { type: 'POINTS_AWARDED', actor: 'system', payload: { memberId: MARIA, points: 8, reasons: [expect.objectContaining({ points: 8 })] } },
    ])
    const guest = afterReducer(sale([{ sku: YOGURT, qty: 1 }]))
    expect(rule.run(guest.state, guest.event).newEvents).toEqual([])
  })
})
