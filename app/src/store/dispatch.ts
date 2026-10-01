/**
 * The event pipeline. Pure functions only: no Date, no randomness, no I/O.
 *
 * step(state, event)     applies the event's own facts (applyEvent), then runs every
 *                        rule listening for its type. Returns the new state and the
 *                        drafts the rules asked for.
 * dispatch(state, root)  processes a root event and all follow-on events depth-first,
 *                        so each reaction chain is contiguous in the log (sale →
 *                        stock changed → proposal recomputed → next line).
 *                        Follow-on events get deterministic ids (`<parent>.<n>`), the
 *                        parent's ts, and causedBy = parent id.
 * replay(seed, events)   rebuilds state from a log. Because the log is stored in
 *                        processing order and step() is deterministic, replaying it
 *                        reproduces dispatch() exactly; rule drafts are ignored since
 *                        the follow-on events are already in the log.
 */
import type { AppState, DemoEvent, EventDraft, Rule } from '../domain/types'
import { applyEvent } from './applyEvent'

/** Guard against rules that trigger each other forever. */
export const MAX_EVENTS_PER_DISPATCH = 500

export { applyEvent }

export function step(state: AppState, event: DemoEvent, rules: readonly Rule[]): { state: AppState; drafts: EventDraft[] } {
  let next = applyEvent(state, event)
  const drafts: EventDraft[] = []
  for (const rule of rules) {
    if (!rule.on.includes(event.type)) continue
    const out = rule.run(next, event)
    next = out.state
    drafts.push(...out.newEvents)
  }
  return { state: next, drafts }
}

export function childEvent(parent: DemoEvent, draft: EventDraft, index: number): DemoEvent {
  return { id: `${parent.id}.${index + 1}`, ts: parent.ts, actor: draft.actor, type: draft.type, payload: draft.payload, causedBy: parent.id } as DemoEvent
}

export function dispatch(state: AppState, root: DemoEvent, rules: readonly Rule[]): { state: AppState; events: DemoEvent[] } {
  const stack: DemoEvent[] = [root]
  const events: DemoEvent[] = []
  let current = state
  while (stack.length > 0) {
    if (events.length >= MAX_EVENTS_PER_DISPATCH) {
      throw new Error(`dispatch: more than ${MAX_EVENTS_PER_DISPATCH} events from ${root.type} ${root.id}; rules are looping`)
    }
    const event = stack.pop()!
    events.push(event)
    const out = step(current, event, rules)
    current = out.state
    for (let i = out.drafts.length - 1; i >= 0; i--) stack.push(childEvent(event, out.drafts[i], i))
  }
  return { state: current, events }
}

export function replay(seed: AppState, events: readonly DemoEvent[], rules: readonly Rule[]): AppState {
  let current = seed
  for (const event of events) current = step(current, event, rules).state
  return current
}
