/**
 * The event pipeline. Pure functions only: no Date, no randomness, no I/O.
 *
 * step(state, event)     applies the event's own facts (applyEvent), then runs every
 *                        rule listening for its type. Returns the new state and the
 *                        drafts the rules asked for.
 * dispatch(state, root)  processes a root event and all follow-on events breadth-first.
 *                        Follow-on events get deterministic ids (`<parent>.<n>`), the
 *                        parent's ts, and causedBy = parent id.
 * replay(seed, events)   rebuilds state from a log. Because the log is stored in
 *                        processing order and step() is deterministic, replaying it
 *                        reproduces dispatch() exactly; rule drafts are ignored since
 *                        the follow-on events are already in the log.
 */
import { produce, type Draft } from 'immer'
import type { AppState, DemoEvent, EventDraft, Rule } from '../domain/types'

/** Guard against rules that trigger each other forever. */
export const MAX_EVENTS_PER_DISPATCH = 500

/** Records the facts carried by an event. Business reducers for C1–C18 arrive with their rules. */
export function applyEvent(state: AppState, event: DemoEvent): AppState {
  return produce(state, (d) => {
    d.events.push(event as Draft<DemoEvent>)
    switch (event.type) {
      case 'NOTIFICATION_ADDED': {
        const p = (event as DemoEvent<'NOTIFICATION_ADDED'>).payload
        d.notifications.push({ id: event.id, role: p.role, text: p.text, link: p.link, severity: p.severity, eventId: event.id, read: false })
        break
      }
      default:
        break
    }
  })
}

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
  const queue: DemoEvent[] = [root]
  const events: DemoEvent[] = []
  let current = state
  while (queue.length > 0) {
    if (events.length >= MAX_EVENTS_PER_DISPATCH) {
      throw new Error(`dispatch: more than ${MAX_EVENTS_PER_DISPATCH} events from ${root.type} ${root.id}; rules are looping`)
    }
    const event = queue.shift()!
    events.push(event)
    const out = step(current, event, rules)
    current = out.state
    out.drafts.forEach((draft, i) => queue.push(childEvent(event, draft, i)))
  }
  return { state: current, events }
}

export function replay(seed: AppState, events: readonly DemoEvent[], rules: readonly Rule[]): AppState {
  let current = seed
  for (const event of events) current = step(current, event, rules).state
  return current
}
