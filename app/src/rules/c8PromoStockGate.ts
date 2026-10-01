/**
 * C8 (P0) Emily ⇄ Priya. Submitting a promo runs the stock-check gate
 * (Pass / Warn / Fail). Emily sees the result; on Warn or Fail Priya is told what
 * supply is missing. A publish attempt on a Fail is refused (the reducer leaves
 * the promo unchanged) and Emily is told why.
 */
import type { DemoEvent, EventDraft, Rule } from '../domain/types'
import { canPublishPromo, promoStockCheck } from './engine/promoStockCheck'
import { notify } from './notify'

const fmt = (n: number) => n.toLocaleString('en-US')

export const c8PromoStockGate: Rule = {
  id: 'C8-promo-stock-gate',
  on: ['PROMO_SUBMITTED', 'PROMO_PUBLISHED'],
  run(state, event) {
    const { promoId } = (event as DemoEvent<'PROMO_SUBMITTED'>).payload
    const promo = state.promos.promotions.find((p) => p.id === promoId)
    if (!promo) return { state, newEvents: [] }

    if (event.type === 'PROMO_PUBLISHED') {
      if (canPublishPromo(state, promoId)) return { state, newEvents: [] }
      return { state, newEvents: [notify('emily', `${promoId} was not published: the stock check failed. Ask replenishment to add supply first.`, 'critical', `promo:${promoId}`)] }
    }

    const result = promoStockCheck(state, promoId)
    const newEvents: EventDraft[] = [
      { type: 'PROMO_STOCK_CHECKED', actor: 'system', payload: { promoId, result } },
      notify(
        'emily',
        `${promoId} stock check: ${result.status}. Supply covers ${result.coveragePct}% of forecast demand.${result.status === 'Fail' ? ' Publishing is blocked.' : ''}`,
        result.status === 'Pass' ? 'success' : result.status === 'Warn' ? 'warning' : 'critical',
        `promo:${promoId}`,
      ),
    ]
    if (result.status !== 'Pass') {
      newEvents.push(
        notify(
          'priya',
          `${promoId} ${promo.name} needs ${fmt(result.demand - result.supply)} more units per week (supply ${fmt(result.supply)} vs demand ${fmt(result.demand)}). ${promo.stockCheck.detail}`,
          result.status === 'Fail' ? 'critical' : 'warning',
          `promo:${promoId}`,
        ),
      )
    }
    return { state, newEvents }
  },
}
