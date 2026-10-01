/**
 * C9 (P0) Priya → Emily. While an offer is live, cover below
 * demoTuning.riskCoverDays raises STOCK_RISK_RAISED (once); cover back above
 * the threshold, or the offer paused, clears it.
 */
import type { DemoEvent, Rule } from '../domain/types'
import { clearOfferRisks, riskDrafts } from './engine/stockRisk'

export const c9StockRisk: Rule = {
  id: 'C9-stock-risk',
  on: ['STOCK_CHANGED', 'OFFER_PUBLISHED', 'OFFER_PAUSED'],
  run(state, event) {
    if (event.type === 'STOCK_CHANGED') {
      return { state, newEvents: riskDrafts(state, [(event as DemoEvent<'STOCK_CHANGED'>).payload.sku]) }
    }
    const { offerId } = (event as DemoEvent<'OFFER_PUBLISHED'>).payload
    if (event.type === 'OFFER_PAUSED') return { state, newEvents: clearOfferRisks(state, offerId) }
    const offer = state.offers.find((o) => o.id === offerId)
    return { state, newEvents: offer ? riskDrafts(state, offer.itemIds) : [] }
  },
}
