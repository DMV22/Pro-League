import { PersistenceFailure } from '../../shared/application/persistence'

function sqlState(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  if ('code' in error && typeof error.code === 'string') return error.code
  if ('cause' in error) return sqlState(error.cause)
  return undefined
}

export function mapDatabaseFailure(error: unknown): Error {
  if (error instanceof PersistenceFailure) return error

  const code = sqlState(error)
  if (code === '23505' || code === '23P01') {
    return new PersistenceFailure('conflict', 'A conflicting record already exists')
  }
  if (code === '23503') {
    return new PersistenceFailure('reference', 'A referenced record is unavailable')
  }
  if (code === '23502' || code === '23514') {
    return new PersistenceFailure('constraint', 'The database rejected the proposed data')
  }
  if (code === '40001' || code === '40P01') {
    return new PersistenceFailure('retryable', 'The transaction must be retried safely')
  }
  if (code !== undefined) {
    return new PersistenceFailure('unavailable', 'The database operation failed')
  }
  return error instanceof Error
    ? error
    : new PersistenceFailure('unavailable', 'The database operation failed')
}
