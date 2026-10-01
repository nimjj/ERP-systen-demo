/**
 * Active demand uplift for a SKU (SPEC §5.1): the largest uplift among live
 * offers and live promotions covering it. Promotions listed in
 * demoTuning.upliftBakedIntoForecast add nothing (their uplift is already in
 * dailyForecast). Scheduled or published-but-not-started promos add nothing:
 * their pre-build is already in the proposal.
 */
import { demoTuning } from '../../config/demoTuning'
import type { AppState } from '../../domain/types'

export interface UpliftSource {
  kind: 'offer' | 'promo'
  id: string
  name: string
  uplift: number
}

export function upliftSources(state: AppState, sku: string): UpliftSource[] {
  const sources: UpliftSource[] = []
  for (const o of state.offers) {
    if (o.status === 'Live' && o.itemIds.includes(sku) && o.storeIds.includes(state.store.id)) {
      sources.push({ kind: 'offer', id: o.id, name: o.name, uplift: demoTuning.offerUplift })
    }
  }
  for (const p of state.promos.promotions) {
    if (p.status !== 'Live' || !p.itemIds.includes(sku) || demoTuning.upliftBakedIntoForecast.includes(p.id)) continue
    const uplift = demoTuning.upliftByMechanic[p.mechanic] ?? state.promos.mechanics.find((m) => m.name === p.mechanic)?.baseUplift ?? 0
    sources.push({ kind: 'promo', id: p.id, name: p.name, uplift })
  }
  return sources
}

export function activeUplift(state: AppState, sku: string): number {
  return upliftSources(state, sku).reduce((max, s) => Math.max(max, s.uplift), 0)
}

/** Forecast per day after uplift; falls back to the position's demand for SKUs without a proposal. */
export function effectiveDaily(state: AppState, sku: string): number {
  const base = state.proposals.find((p) => p.itemId === sku)?.dailyForecast ?? state.positions[sku]?.dailyDemand ?? 0
  return base * (1 + activeUplift(state, sku))
}
