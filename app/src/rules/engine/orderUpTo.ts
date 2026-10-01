/**
 * Order-up-to policy (SPEC §5.1, §13.5). Calibrated against proposals.json:
 * reproduces proposedQty for 276/276 AUTO_RELEASED lines.
 *
 *   exposure = demandOverExposure                       (no uplift; the stored value)
 *            = round(demandOverExposure * (1 + uplift))  (with uplift)
 *   S        = exposure + safetyStock                    (= stored orderUpTo when uplift = 0)
 *   position = onHand + inTransit + onOrder
 *   qty      = ceilToCase(max(0, S − position) + prebuild) + seedAdjustment
 *
 * safetyStock is a seeded input: the data has no demand-variability figure, so
 * it cannot be rebuilt from the service level.
 */

export interface OrderUpToInput {
  demandOverExposure: number
  safetyStock: number
  onHand: number
  inTransit: number
  onOrder: number
  prebuild: number
  casePack: number
  uplift?: number
  seedAdjustment?: number
}

export function ceilToCase(qty: number, casePack: number): number {
  return Math.ceil(qty / casePack) * casePack
}

export function exposure(demandOverExposure: number, uplift = 0): number {
  return uplift > 0 ? Math.round(demandOverExposure * (1 + uplift)) : demandOverExposure
}

export function orderUpToLevel(input: OrderUpToInput): number {
  return exposure(input.demandOverExposure, input.uplift) + input.safetyStock
}

export function orderQty(input: OrderUpToInput): number {
  const position = input.onHand + input.inTransit + input.onOrder
  const base = ceilToCase(Math.max(0, orderUpToLevel(input) - position) + input.prebuild, input.casePack)
  return Math.max(0, base + (input.seedAdjustment ?? 0))
}
