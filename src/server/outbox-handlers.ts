import 'server-only'
import type { OutboxHandlers } from '../modules/operations/application/dispatch-outbox'

/** Standalone Node handlers only. Next cache delivery belongs to its protected Route Handler. */
export const runtimeOutboxHandlers: OutboxHandlers = Object.freeze({})
