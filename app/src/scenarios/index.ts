/**
 * Scripted scenarios (SPEC §7). Each step is done either by the presenter
 * clicking in the pane or by Next; both go through src/actions.ts, so they emit
 * the same events. `done` looks only at events since the step started, so the
 * presenter advances whichever way the step happened.
 *
 * `setup` is what `?scenario=<id>` / reset(<id>) dispatches before step 1.
 */
import { approveOrder, completeSale, defaultReceived, issueRecall, publishOffer, publishPromo, pullLot, pullTaskLot, receiveDelivery, refillShelf, scanBlocked, sendRecallNotice, simulateSales, submitPromo } from '../actions'
import type { AppState, DemoEvent, EventDraft, Role } from '../domain/types'

export interface StepContext {
  shortShip: boolean
}

export interface ScenarioStep {
  actor: Role | 'presenter'
  title: string
  /** What to click in the pane to do it by hand. */
  how: string
  /** What the other panes show afterwards. */
  watch: string
  next(state: AppState, ctx: StepContext): EventDraft[]
  done(state: AppState, since: readonly DemoEvent[]): boolean
}

export interface Scenario {
  title: string
  minutes: number
  setup: EventDraft[]
  steps: ScenarioStep[]
  /** Show the whole event chain as one timeline when the last step is done. */
  timeline?: boolean
}

export type ScenarioRegistry = Record<string, Scenario>

const YOGURT = 'SKU-100221'
const MARIA = 'M-1001'
const has = <T extends DemoEvent['type']>(since: readonly DemoEvent[], type: T, match: (e: DemoEvent<T>) => boolean = () => true) =>
  since.some((e) => e.type === type && match(e as DemoEvent<T>))
const yogurtProposal = (s: AppState) => s.proposals.find((p) => p.itemId === YOGURT)!
const isNewYogurtInbound = (id: string) => id.startsWith('IN-PRP-00001-')

export const s1: Scenario = {
  title: 'S1 · From offer to shelf',
  minutes: 4,
  timeline: true,
  setup: [],
  steps: [
    {
      actor: 'emily',
      title: 'Emily publishes OF-3101',
      how: 'Emily pane → Publish to Plano Market',
      watch: "Jamal's till gets the +200 pts bonus; Priya's yogurt order rises 6 → 12 and needs review.",
      next: (s) => {
        const offer = s.offers.find((o) => o.id === 'OF-3101')!
        return offer.status === 'Live' ? [] : [publishOffer(offer)]
      },
      done: (_s, since) => has(since, 'OFFER_PUBLISHED', (e) => e.payload.offerId === 'OF-3101'),
    },
    {
      actor: 'jamal',
      title: 'Jamal sells a Greek yogurt to Maria (Gold)',
      how: 'Till → Rewards member: Maria Delgado → Key item (Plain Greek Yogurt 32 oz) → Complete sale',
      watch: 'Maria earns 208 points; Emily sees redeemed +1 and $1.00 supplier funded; Priya and Aisha see on hand −1.',
      next: (s) => [completeSale(s, [{ sku: YOGURT, qty: 1 }], MARIA)],
      done: (_s, since) => has(since, 'SALE_COMPLETED', (e) => e.payload.memberId === MARIA && e.payload.lines.some((l) => l.sku === YOGURT)),
    },
    {
      actor: 'presenter',
      title: 'Ten more yogurt sales',
      how: 'Presenter → Simulate 10 sales',
      watch: "Shelf runs empty (Aisha's gap scan); Priya's order rises to 24; Emily gets a stock-risk warning.",
      next: (s) => simulateSales(s),
      done: (_s, since) => since.filter((e) => e.type === 'SALE_COMPLETED' && (e as DemoEvent<'SALE_COMPLETED'>).payload.lines.some((l) => l.sku === YOGURT)).length >= 10,
    },
    {
      actor: 'aisha',
      title: 'Aisha refills the yogurt shelf from the back room',
      how: 'Handheld → Morning gap scan → Refill (Plain Greek Yogurt 32 oz)',
      watch: 'Shelf goes up, back room down. On hand, the till and the order do not change.',
      next: (s) => (s.positions[YOGURT].backRoom > 0 ? [refillShelf(s.positions[YOGURT])] : []),
      done: (_s, since) => has(since, 'SHELF_REFILLED', (e) => e.payload.sku === YOGURT),
    },
    {
      actor: 'priya',
      title: 'Priya approves the larger yogurt order',
      how: 'Planner → Plain Greek Yogurt 32 oz row → Approve',
      watch: 'Aisha gets "Receive delivery"; the next yogurt order drops to 0.',
      next: (s) => [approveOrder(yogurtProposal(s))],
      done: (_s, since) => has(since, 'ORDER_APPROVED', (e) => e.payload.proposalId === 'PRP-00001'),
    },
    {
      actor: 'aisha',
      title: 'Aisha receives the delivery, 4 short',
      how: 'Handheld → Receive delivery: Plain Greek Yogurt 32 oz → Confirm receipt (short-ship pre-fills 4 fewer)',
      watch: 'Priya gets claim CLM-5223; the yogurt order re-opens by a case. Emily’s warning clears once cover is back.',
      next: (s, ctx) => {
        const task = s.handheld.tasks.find((t) => t.kind === 'RECEIVE' && t.status === 'OPEN' && t.ref && isNewYogurtInbound(t.ref))
        if (!task) return []
        const line = s.inbound.find((i) => i.id === task.ref)!
        return receiveDelivery(s, task, { [line.id]: defaultReceived(line, ctx.shortShip) })
      },
      done: (_s, since) => has(since, 'DELIVERY_RECEIVED', (e) => isNewYogurtInbound(e.payload.inboundId)),
    },
  ],
}

export const s2: Scenario = {
  title: 'S2 · Promo gate',
  minutes: 2,
  setup: [],
  steps: [
    {
      actor: 'emily',
      title: 'Emily submits PRM-2720 Thanksgiving Baking',
      how: 'Emily pane → Promotions → PRM-2720 → Stock check',
      watch: 'Fail (68%): Publish is blocked. Priya is told the DC is short (Prairie Gold capped the allocation).',
      next: () => [submitPromo('PRM-2720')],
      done: (_s, since) => has(since, 'PROMO_SUBMITTED', (e) => e.payload.promoId === 'PRM-2720'),
    },
    {
      actor: 'emily',
      title: 'Emily checks PRM-2702 Halloween Cola',
      how: 'Emily pane → Promotions → PRM-2702 → Stock check',
      watch: 'Warn (84%): three stores lack day-1 stock. Priya sees the shortfall.',
      next: () => [submitPromo('PRM-2702')],
      done: (_s, since) => has(since, 'PROMO_SUBMITTED', (e) => e.payload.promoId === 'PRM-2702'),
    },
    {
      actor: 'priya',
      title: 'Priya approves the Cola pre-build line',
      how: 'Planner → Cola 12 pk 12 oz Cans row → Approve',
      watch: "Supply is added for PRM-2702; Emily's badge flips Warn → Pass.",
      next: (s) => [approveOrder(s.proposals.find((p) => p.id === 'PRP-00003')!)],
      done: (_s, since) => has(since, 'ORDER_APPROVED', (e) => e.payload.proposalId === 'PRP-00003'),
    },
    {
      actor: 'emily',
      title: 'Emily publishes PRM-2702',
      how: 'Emily pane → Promotions → PRM-2702 → Publish',
      watch: 'PRM-2702 is Published. PRM-2720 stays blocked.',
      next: () => [publishPromo('PRM-2702')],
      done: (s, since) => has(since, 'PROMO_PUBLISHED', (e) => e.payload.promoId === 'PRM-2702') && s.promos.promotions.find((p) => p.id === 'PRM-2702')?.status === 'Published',
    },
  ],
}

const CHEDDAR = 'SKU-100228'
const RECALL = 'RCL-2026-014'
const recallOf = (s: AppState) => s.recalls.find((r) => r.id === RECALL)!

export const s3: Scenario = {
  title: 'S3 · Recall hits everyone',
  minutes: 2,
  timeline: true,
  setup: [],
  steps: [
    {
      actor: 'presenter',
      title: 'Ops issues recall RCL-2026-014 (Shredded Mild Cheddar)',
      how: 'Presenter → Issue recall RCL-2026-014',
      watch: 'All four panes change at once: till blocks cheddar, Aisha gets 3 pull tasks, Priya’s cheddar order (84 units) is held, Emily’s PRM-2698 is flagged and a customer notice is drafted.',
      next: (s) => (recallOf(s).status === 'NOT_ISSUED' ? [issueRecall(recallOf(s))] : []),
      done: (_s, since) => has(since, 'RECALL_ISSUED', (e) => e.payload.recallId === RECALL),
    },
    {
      actor: 'jamal',
      title: 'Jamal tries to sell a cheddar',
      how: 'Till → item: Shredded Mild Cheddar 8 oz → Key item',
      watch: 'The till refuses it: "RECALLED — do not sell". The refused scan is counted on the recall.',
      next: (s) => [scanBlocked(s, CHEDDAR)].filter((d): d is EventDraft => d !== null),
      done: (_s, since) => has(since, 'RECALL_SCAN_BLOCKED', (e) => e.payload.sku === CHEDDAR),
    },
    {
      actor: 'aisha',
      title: 'Aisha pulls all three lots',
      how: 'Handheld → each "Pull Shredded Mild Cheddar 8 oz · lot …" task → Confirm pulled',
      watch: 'Cheddar on hand goes 31 → 0; Plano is confirmed on the recall; Priya sees the write-off for the supplier credit.',
      next: (s) =>
        s.handheld.tasks
          .filter((t) => t.kind === 'RECALL_PULL' && t.status === 'OPEN')
          .flatMap((t) => {
            const lot = pullTaskLot(s, t)
            return lot ? pullLot(s, t, lot.onHand - lot.pulled) : []
          }),
      done: (s) => !!recallOf(s).stores.find((r) => r.storeId === s.store.id)?.confirmedBy,
    },
    {
      actor: 'emily',
      title: 'Emily sends the customer notice',
      how: 'Emily pane → Recall card → Send notice',
      watch: 'The notice goes to 1,102 push, 1,219 email and 388 SMS contacts; PRM-2698 keeps its recall flag.',
      next: (s) => [sendRecallNotice(recallOf(s))].filter((d): d is EventDraft => d !== null),
      done: (_s, since) => has(since, 'RECALL_NOTICE_SENT', (e) => e.payload.recallId === RECALL),
    },
  ],
}

export const scenarios: ScenarioRegistry = { S1: s1, S2: s2, S3: s3 }
