import 'server-only'

import { getDatabase } from './client'
import { createTransactionAdapter } from './transaction'

export function getRuntimeTransactionAdapter() {
  return createTransactionAdapter(getDatabase())
}
