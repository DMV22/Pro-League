import 'server-only'
import type { OutboxHandlers } from '../modules/operations/application/dispatch-outbox'

/** Register reviewed, idempotent production adapters here as their owning features ship. No test handler. */
export const runtimeOutboxHandlers: OutboxHandlers = Object.freeze({})
