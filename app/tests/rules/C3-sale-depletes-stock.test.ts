import { describe, expect, it } from 'vitest'
import { c3SaleDepletesStock as rule } from '../../src/rules/c3SaleDepletesStock'
import { afterReducer, sale, YOGURT } from '../helpers'

describe('C3 sale depletes stock', () => {
  it('one STOCK_CHANGED per stock-tracked SKU, lines of the same SKU combined', () => {
    const { state, event } = afterReducer(
      sale([
        { sku: YOGURT, qty: 2 },
        { sku: 'SKU-100214', qty: 1 },
        { sku: YOGURT, qty: 8 },
        { sku: 'POS-GM-01', qty: 1 },
      ]),
    )
    const out = rule.run(state, event)
    expect(out.state).toBe(state)
    expect(out.newEvents.map((e) => e.payload)).toEqual([
      { sku: YOGURT, delta: -10, reason: 'SALE', onHand: 7, shelf: 0, backRoom: 7 },
      { sku: 'SKU-100214', delta: -1, reason: 'SALE', onHand: 18, shelf: 18, backRoom: 0 },
    ])
  })
})
