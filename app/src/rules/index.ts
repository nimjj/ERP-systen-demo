/**
 * Reaction rule registry. One file per rule in this folder (SPEC §5); each is a
 * pure `(state, event) => { state, newEvents }`. Rules C1–C9 arrive in M2.
 * Every rule registered here is automatically covered by the purity test (A15).
 */
import type { Rule } from '../domain/types'

export const rules: readonly Rule[] = []
