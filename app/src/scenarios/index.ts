/**
 * Scripted starting states for `?scenario=<id>` (SPEC §7). A scenario is a list
 * of root event drafts dispatched right after a reset. S1–S3 arrive in M4/M5.
 */
import type { EventDraft } from '../domain/types'

export type ScenarioRegistry = Record<string, { title: string; setup: EventDraft[] }>

export const scenarios: ScenarioRegistry = {
  seed: { title: 'Seed (start of day)', setup: [] },
}
