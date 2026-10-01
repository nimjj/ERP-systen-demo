/**
 * AppState — the single shared state (SPEC §2). Field names follow seed/*.json,
 * which follow reference/mock/*.json.
 */

export type Role = 'jamal' | 'aisha' | 'emily' | 'priya'
export type Actor = Role | 'system'
export type Severity = 'info' | 'success' | 'warning' | 'critical'

export interface Persona {
  role: Role
  userId: string
  name: string
  email: string
  roleId: string
  scope: string
}

export interface Store {
  id: string
  name: string
  displayName: string
  region: string
  regionCode: string
  format: string
  number: string
  address: string[]
  phone: string
  lanes: number
  manager: string | null
  districtManager: string | null
  asOf: string
  asOfLabel: string
  [extra: string]: unknown
}

export interface Item {
  id: string
  gtin: string
  name: string
  category: string
  supplierId: string
  price: number
  casePack: number
  baseWeekly: number
  abc: 'A' | 'B' | 'C'
  xyz: string
  cost: number
  perishable: boolean
  shelfLifeDays: number
  source: string
  sourceType: string
}

export interface Lot {
  lot: string
  qty: number
  expiry?: string | null
  received?: string
  ref?: string | null
  daysLeft?: number
  nearExpiry?: boolean
}

export interface Position {
  sku: string
  positionId: string
  name: string
  onHand: number
  shelf: number
  backRoom: number
  quarantine: number
  rtvHold: number
  shelfCapacity: number
  dailyDemand: number
  lots: Lot[]
  flags: string[]
  lastCounted: string | null
}

export type InboundStatus = 'ORDERED' | 'IN_TRANSIT' | 'RECEIVED' | 'HELD'

export interface Inbound {
  id: string
  sku: string
  name: string
  casePack: number
  expectedQty: number
  receivedQty: number | null
  source: string
  status: InboundStatus
  asnId: string | null
  poId: string | null
  eta: string | null
  shortShip: boolean
}

export type ExceptionCode =
  | 'SHELF_CAPACITY'
  | 'PROMO_UPLIFT'
  | 'PHANTOM_SUSPECTED'
  | 'SUPPLIER_CONSTRAINT'
  | 'LARGE_DEVIATION'
  | 'LOW_CONFIDENCE'
  | 'NEAR_EXPIRY'

export interface ProposalException {
  code: ExceptionCode
  label: string
  severity: 'low' | 'medium' | 'high'
  explanation: string
}

export type ProposalStatus = 'AUTO_RELEASED' | 'PENDING_REVIEW' | 'APPROVED' | 'HELD' | 'BLOCKED'

export interface Proposal {
  id: string
  storeId: string
  itemId: string
  itemName: string
  category: string
  abc: 'A' | 'B' | 'C'
  xyz: string
  source: string
  sourceType: string
  supplierId: string
  supplierName: string
  casePack: number
  price: number
  cost: number
  onHand: number
  inTransit: number
  onOrder: number
  shelfCapacity: number
  dailyForecast: number
  leadTimeDays: number
  reviewDays: number
  serviceLevel: number
  demandOverExposure: number
  safetyStock: number
  orderUpTo: number
  proposedQty: number
  lastOrderQty: number
  prebuild: number
  ifEmptyQty: number | null
  daysOfCover: number
  deliveryDate: string
  confidence: string
  /** Primary exception (data shape); `exceptions` holds all of them. */
  exception: ProposalException | null
  exceptions: ProposalException[]
  status: ProposalStatus
  value: number
  /** Units the seed data adds on top of the formula (strawberries +48); kept on every recompute. */
  seedAdjustment: number
  /** Live: active uplift and the forecast after uplift (written by PROPOSAL_RECOMPUTED). */
  uplift: number
  effectiveDaily: number
  [extra: string]: unknown
}

export interface SeriesPoint {
  week: string
  w: number
  actual: number | null
  forecast: number | null
  legacy: number | null
  oos: boolean
  promo: string | null
  event: string | null
}

export type TaskKind = 'RECEIVE' | 'COUNT' | 'GAP' | 'MARKDOWN' | 'RECALL_PULL'

export interface Task {
  id: string
  kind: TaskKind
  title: string
  detail: string
  priority: 'High' | 'Medium' | 'Low'
  status: 'OPEN' | 'DONE'
  ref: string | null
  createdBy: string | null
  [extra: string]: unknown
}

export interface AsnLine {
  itemId: string
  gtin: string
  name: string
  casePack: number
  expectedCases: number
  expiry: string
  shortShip: boolean
}

export interface CountLine {
  itemId: string
  gtin: string
  name: string
  location: string
  systemQty: number
  actualHint: number | null
}

export interface GapLine {
  itemId: string
  gtin: string
  name: string
  location: string
  systemQty: number
  backroomQty: number
  nextDelivery: string
}

export interface HandheldState {
  user: { name: string; role: string }
  tasks: Task[]
  asn: { id: string; poId: string; storeId: string; source: string; truck: string; eta: string; lines: AsnLine[] }
  count: { id: string; reason: string; storeId: string; lines: CountLine[] }
  gaps: GapLine[]
}

export interface TillRule {
  id: string
  type: string
  name: string
  status: string
  receipt: string
  itemIds?: string[]
  price?: number
  qty?: number
  getQty?: number
  getPct?: number
  pct?: number
  points?: number
  categories?: string[]
  threshold?: number
  amount?: number
  minSpend?: number
  membersOnly?: boolean
  stackable?: boolean
  funder?: string
  vendorFundedPct?: number
  start?: string
  end?: string
  [extra: string]: unknown
}

export interface Member {
  id: string
  name: string
  phone: string
  card: string
  tier: 'Member' | 'Silver' | 'Gold'
  rewardsPlus: boolean
  points: number
  clipped: string[]
  offerIds: string[]
  since: string
  homeStore: string
}

export interface CatalogueEntry {
  id: string
  gtin: string
  name: string
  category: string
  dept: string
  supplierId?: string
  price: number
  unit: string
  taxable: boolean
  snap: boolean
  points: boolean
  [extra: string]: unknown
}

export interface BasketLine {
  sku: string
  qty: number
  price: number
  promoApplied: string[]
}

export interface TillState {
  asOf: string
  taxRate: number
  taxLabel: string
  store: Record<string, unknown>
  cashier: { id: string; name: string; role: string }
  catalogue: CatalogueEntry[]
  quickKeys: { label: string; sub: string; code: string }[]
  scanScript: string[]
  scaleWeights: number[]
  rules: TillRule[]
  coupons: Record<string, unknown>[]
  members: Member[]
  loyalty: { programme: string; earnPerDollar: number; tierMultiplier: Record<string, number>; redeemBlock: number; redeemValue: number; [extra: string]: unknown }
  stacking: { order: { step: number; key: string; name: string; detail: string }[]; [extra: string]: unknown }
  shift: Record<string, unknown>
  /** Session state (not in source data). */
  basket: BasketLine[]
  memberId: string | null
  blockedSkus: string[]
  [extra: string]: unknown
}

export interface Offer {
  id: string
  name: string
  kind: string
  mechanic: string
  fundedBy: string
  fundingPct: number
  audience: string
  status: string
  targeted: number
  clipped: number
  redeemed: number
  costUsd: number
  vendorPaidUsd: number
  incrementalSalesUsd: number
  start: string
  end: string
  itemIds: string[]
  storeIds: string[]
  tillRuleId: string
  bonusPoints: number
  [extra: string]: unknown
}

export interface Campaign {
  id: string
  name: string
  channel: string
  segmentId: string | null
  segmentName: string
  offerId: string
  status: string
  audience: number
  [extra: string]: unknown
}

export interface Segment {
  id: string
  name: string
  definition: string
  size: number
  [extra: string]: unknown
}

export type StockCheckStatus = 'Pass' | 'Warn' | 'Fail'

export interface Promo {
  id: string
  name: string
  category: string
  mechanic: string
  status: string
  start: string
  end: string
  weeks: number
  itemIds: string[]
  itemNames: string[]
  forecast: { baselineUnits: number; promoUnits: number; upliftPct: number; [extra: string]: number }
  stockCheck: { result: StockCheckStatus; source: string; prebuildUnits: number; detail: string; short: { location: string; kind: string; shortUnits: number }[]; checkedAt: string }
  /** Live: last gate result from PROMO_STOCK_CHECKED. */
  gate?: StockCheckResult
  /** Live: units per week added by SUPPLY_ADDED (C11). */
  extraSupplyUnits?: number
  [extra: string]: unknown
}

export interface PromosState {
  mechanics: { name: string; baseUplift: number; elasticity: number; defaultDepth: number; hint: string }[]
  itemBaselines: Record<string, number>
  stockCapacity: Record<string, number>
  promotions: Promo[]
}

export interface Claim {
  id: string
  supplierId: string
  supplierName: string
  poId: string | null
  asnId: string | null
  type: string
  itemId: string
  itemName: string
  qtyCases?: number
  shortQty?: number
  value: number
  status: string
  raisedAt: string
  note?: string
  storeId: string | null
  raisedInDemo: boolean
  inboundId?: string
}

export interface RecallStoreRow {
  storeId: string
  storeName: string
  region: string
  lots: { lot: string; onHand: number; pulled: number }[]
  confirmedBy: string | null
}

export interface Recall {
  id: string
  kind: string
  classification: string
  title: string
  itemId: string
  itemName: string
  gtin: string
  supplierId: string
  supplierName: string
  reason: string
  issued: string | null
  status: 'NOT_ISSUED' | 'ISSUED' | 'CLOSED'
  lots: { lot: string; bestBy: string }[]
  action: string
  posBlock: { blocked: boolean; blockedAt: string | null; blockedScans: number }
  customers: { buyers: number; push: number; email: number; sms: number; refunds: number; nonMemberSales: number; signage: boolean }
  credit: { claimId: string | null; status: string; submittedAt: string | null; unitCost: number; units: number; amount: number }
  stores: RecallStoreRow[]
  [extra: string]: unknown
}

export interface Notification {
  id: string
  role: Role
  text: string
  link: string | null
  severity: Severity
  eventId: string
  read: boolean
}

export interface StockRisk {
  offerId: string
  sku: string
  coverDays: number
  eventId: string
}

export interface AppState {
  store: Store
  personas: Persona[]
  items: Item[]
  positions: Record<string, Position>
  inbound: Inbound[]
  proposals: Proposal[]
  series: Record<string, SeriesPoint[]>
  handheld: HandheldState
  till: TillState
  offers: Offer[]
  campaigns: Campaign[]
  segments: Segment[]
  promos: PromosState
  claims: Claim[]
  recalls: Recall[]
  stockRisks: StockRisk[]
  notifications: Notification[]
  events: DemoEvent[]
}

// ------------------------------------------------------------------ events (SPEC §4)

export type StockReason = 'SALE' | 'DC_RECEIPT' | 'MOVE' | 'COUNT_VARIANCE' | 'ADJUSTMENT' | 'WASTE' | 'RECALL_PULL'

export interface SaleLine {
  sku: string
  qty: number
  price: number
  promoApplied: string[]
}

export interface PointsReason {
  label: string
  points: number
  ruleId?: string
  offerId?: string
  sku?: string
  qty?: number
  salesUsd?: number
}

export interface StockCheckResult {
  status: StockCheckStatus
  demand: number
  supply: number
  coveragePct: number
}

export interface EventPayloads {
  OFFER_PUBLISHED: { offerId: string; items: string[]; storeIds: string[] }
  OFFER_PAUSED: { offerId: string; items: string[]; storeIds: string[] }
  PROMO_SUBMITTED: { promoId: string }
  PROMO_STOCK_CHECKED: { promoId: string; result: StockCheckResult }
  PROMO_PUBLISHED: { promoId: string }
  SALE_COMPLETED: { txnId: string; memberId: string | null; lines: SaleLine[]; total: number; tax: number; tender: string }
  POINTS_AWARDED: { memberId: string; points: number; reasons: PointsReason[] }
  STOCK_CHANGED: { sku: string; delta: number; reason: StockReason; onHand: number; shelf: number; backRoom: number }
  PROPOSAL_RECOMPUTED: {
    proposalId: string
    sku: string
    oldQty: number
    newQty: number
    exceptions: ProposalException[]
    status: ProposalStatus
    onHand: number
    inTransit: number
    orderUpTo: number
    uplift: number
    effectiveDaily: number
    daysOfCover: number
  }
  ORDER_APPROVED: { proposalId: string; qty: number; editedFrom?: number }
  ORDER_HELD: { proposalId: string; qty: number; editedFrom?: number }
  INBOUND_CREATED: { inboundId: string; sku: string; qty: number; eta: string | null }
  TASK_CREATED: { taskId: string; kind: TaskKind; title: string; detail: string; ref: string | null }
  TASK_COMPLETED: { taskId: string; kind: TaskKind }
  DELIVERY_RECEIVED: { inboundId: string; expectedQty: number; receivedQty: number }
  CLAIM_RAISED: { claimId: string; supplierId: string; sku: string; shortQty: number; value: number; inboundId?: string }
  STOCK_RISK_RAISED: { offerId: string; sku: string; coverDays: number }
  STOCK_RISK_CLEARED: { offerId: string; sku: string; coverDays: number }
  SHELF_REFILLED: { sku: string; qty: number }
  COUNT_SUBMITTED: { countId: string; lines: { sku: string; systemQty: number; actualQty: number }[] }
  RECALL_ISSUED: { recallId: string; sku: string; lots: string[]; qty: number }
  RECALL_PULLED: { recallId: string; sku: string; lots: string[]; qty: number }
  NOTIFICATION_ADDED: { role: Role; text: string; link: string | null; severity: Severity }
  // P1 / P2 (SPEC §3 C11, C16–C18)
  SUPPLY_ADDED: { promoId: string; proposalId: string; units: number }
  WASTE_LOGGED: { sku: string; qty: number; reason: string }
  COUPON_ISSUED: { couponId: string; memberId: string }
  MARKDOWN_RECOMMENDED: { proposalId: string; sku: string }
}

export type EventType = keyof EventPayloads

export interface DemoEvent<T extends EventType = EventType> {
  id: string
  ts: string
  actor: Actor
  type: T
  payload: EventPayloads[T]
  /** Id of the event that triggered this one; null for root (human/presenter) events. */
  causedBy: string | null
}

/** What a pane or rule asks for; the dispatcher fills id, ts and causedBy. */
export type EventDraft<T extends EventType = EventType> = {
  [K in T]: { type: K; actor: Actor; payload: EventPayloads[K] }
}[T]

/** Reaction rule (CLAUDE.md): pure `(state, event) => { state, newEvents }`. No timers, no randomness. */
export interface Rule {
  id: string
  on: readonly EventType[]
  run(state: AppState, event: DemoEvent): { state: AppState; newEvents: EventDraft[] }
}
