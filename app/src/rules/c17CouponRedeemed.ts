/**
 * C17 (P2) Jamal → Emily. A sale that used wallet coupons records one
 * COUPON_REDEEMED per coupon: the coupon leaves the member's wallet and the
 * funder (supplier or retailer) is on record for the claim-back.
 */
import type { DemoEvent, Rule } from '../domain/types'

export const c17CouponRedeemed: Rule = {
  id: 'C17-coupon-redeemed',
  on: ['SALE_COMPLETED'],
  run(state, event) {
    const { memberId, coupons, txnId } = (event as DemoEvent<'SALE_COMPLETED'>).payload
    if (!memberId || !coupons?.length) return { state, newEvents: [] }
    return {
      state,
      newEvents: coupons.map((c) => ({
        type: 'COUPON_REDEEMED' as const,
        actor: 'system' as const,
        payload: { couponId: c.couponId, memberId, sku: c.sku, amount: c.amount, funder: c.funder, txnId },
      })),
    }
  },
}
