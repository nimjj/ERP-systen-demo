/** The event stream has a plain-language line for every event type. */
import { describe, expect, it } from 'vitest'
import type { DemoEvent, EventType } from '../../src/domain/types'
import { buildSeedState } from '../../src/seed/loadSeed'
import { describeEvent } from '../../src/ui/describe'
import { sampleDrafts } from '../helpers'

describe('event descriptions', () => {
  const s = buildSeedState()
  const drafts = sampleDrafts(s)
  it.each(Object.keys(drafts) as EventType[])('%s has a readable description', (type) => {
    const e = { id: 'x', ts: '', causedBy: null, ...drafts[type] } as DemoEvent
    const text = describeEvent(s, e)
    expect(text.length).toBeGreaterThan(5)
    expect(text).not.toMatch(/undefined|NaN|\[object/)
  })
})
