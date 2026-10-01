/**
 * C11 (P1) Priya → Emily. Approving the order line that pre-builds stock for a
 * promotion (demoTuning.promoSupplyOnApproval) adds supply to that promotion;
 * the stock check is then re-run so Emily sees the badge change (Warn → Pass).
 */
import { demoTuning } from '../config/demoTuning'
import type { DemoEvent, EventDraft, Rule } from '../domain/types'
import { promoStockCheck } from './engine/promoStockCheck'
import { notify } from './notify'

export const c11SupplyForPromo: Rule = {
  id: 'C11-supply-for-promo',
  on: ['ORDER_APPROVED', 'SUPPLY_ADDED'],
  run(state, event) {
    if (event.type === 'ORDER_APPROVED') {
      const { proposalId } = (event as DemoEvent<'ORDER_APPROVED'>).payload
      const newEvents: EventDraft[] = Object.entries(demoTuning.promoSupplyOnApproval)
        .filter(([promoId, s]) => s.proposalId === proposalId && !state.promos.promotions.find((p) => p.id === promoId)?.extraSupplyUnits)
        .map(([promoId, s]) => ({ type: 'SUPPLY_ADDED', actor: 'system', payload: { promoId, proposalId, units: s.addsUnits } }))
      return { state, newEvents }
    }
    const { promoId, units } = (event as DemoEvent<'SUPPLY_ADDED'>).payload
    const promo = state.promos.promotions.find((p) => p.id === promoId)
    if (!promo) return { state, newEvents: [] }
    const result = promoStockCheck(state, promoId)
    return {
      state,
      newEvents: [
        { type: 'PROMO_STOCK_CHECKED', actor: 'system', payload: { promoId, result } },
        notify(
          'emily',
          `${promoId} stock check re-run after replenishment added ${units.toLocaleString('en-US')} units/week: ${result.status} (${result.coveragePct}%).${result.status !== 'Fail' ? ' You can publish.' : ''}`,
          result.status === 'Pass' ? 'success' : 'warning',
          `promo:${promoId}`,
        ),
      ],
    }
  },
}
