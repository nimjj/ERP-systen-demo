/**
 * Promo stock-check gate (SPEC §5.3, §13.6). Demand and supply per week come
 * from demoTuning.promoStockCheck (derived from promotions-module.json, see
 * there); SUPPLY_ADDED (C11) adds extraSupplyUnits. Promos without tuning fall
 * back to the data: promoUnits/weeks vs stockCapacity + prebuild/weeks.
 */
import { demoTuning } from '../../config/demoTuning'
import type { AppState, StockCheckResult } from '../../domain/types'

export function promoStockCheck(state: AppState, promoId: string): StockCheckResult {
  const promo = state.promos.promotions.find((p) => p.id === promoId)
  if (!promo) throw new Error(`promoStockCheck: unknown promo ${promoId}`)
  const tuned = demoTuning.promoStockCheck[promoId]
  const demand = tuned?.demandUnits ?? Math.round(promo.forecast.promoUnits / promo.weeks)
  const baseSupply =
    tuned?.supplyUnits ??
    promo.itemIds.reduce((s, id) => s + (state.promos.stockCapacity[id] ?? 0), 0) + Math.round(promo.stockCheck.prebuildUnits / promo.weeks)
  const supply = baseSupply + (promo.extraSupplyUnits ?? 0)
  const coverage = demand > 0 ? supply / demand : Infinity
  const { pass, warn } = demoTuning.promoCoverage
  const status = coverage >= pass ? 'Pass' : coverage >= warn ? 'Warn' : 'Fail'
  return { status, demand, supply, coveragePct: Math.round(coverage * 100) }
}

/** A Fail blocks publishing (A8). */
export function canPublishPromo(state: AppState, promoId: string): boolean {
  return promoStockCheck(state, promoId).status !== 'Fail'
}
