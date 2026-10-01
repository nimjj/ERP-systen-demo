import type { EventDraft, Role, Severity } from '../domain/types'

export const notify = (role: Role, text: string, severity: Severity = 'info', link: string | null = null): EventDraft => ({
  type: 'NOTIFICATION_ADDED',
  actor: 'system',
  payload: { role, text, link, severity },
})
