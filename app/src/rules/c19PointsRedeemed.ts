/**
 * C19 (P2) Jamal → Emily. A sale paid partly with points records POINTS_REDEEMED:
 * the member's balance falls and the programme's points liability shrinks by the
 * dollar value (1,000 points = $5).
 */
import type { DemoEvent, Rule } from '../domain/types'
import { pointsValueUsd } from './engine/loyalty'

export const c19PointsRedeemed: Rule = {
  id: 'C19-points-redeemed',
  on: ['SALE_COMPLETED'],
  run(state, event) {
    const { memberId, pointsRedeemed, txnId } = (event as DemoEvent<'SALE_COMPLETED'>).payload
    if (!memberId || !pointsRedeemed || pointsRedeemed <= 0) return { state, newEvents: [] }
    return {
      state,
      newEvents: [{ type: 'POINTS_REDEEMED', actor: 'system', payload: { memberId, txnId, points: pointsRedeemed, valueUsd: pointsValueUsd(state, pointsRedeemed) } }],
    }
  },
}
