import { describe, it, expect } from 'vitest'
import { isStaleConnectorError } from '../walletConnectionErrors'
import { parseTransactionError, shouldOfferRetry } from '../transactionErrors'
import { TransactionErrorType } from '../../types/transaction'

describe('isStaleConnectorError', () => {
  it('detects the minified connector failure reported from production', () => {
    // Verbatim shape of the message users saw in the error toast.
    expect(
      isStaleConnectorError(new Error('r.connector.getChainId is not a function')),
    ).toBe(true)
  })

  it('detects the unminified form', () => {
    expect(
      isStaleConnectorError(new Error('connector.getChainId is not a function')),
    ).toBe(true)
  })

  it('detects other missing connector methods', () => {
    expect(isStaleConnectorError(new Error('e.connector.getAccounts is not a function'))).toBe(true)
    expect(isStaleConnectorError(new Error('t.connector.getProvider is not a function'))).toBe(true)
  })

  it('detects wagmi connector lifecycle errors by name', () => {
    const err = new Error('Connector not connected.')
    err.name = 'ConnectorNotConnectedError'
    expect(isStaleConnectorError(err)).toBe(true)
  })

  it('unwraps nested cause chains from viem/wagmi', () => {
    const root = new Error('r.connector.getChainId is not a function')
    const wrapped = new Error('Contract function execution failed', { cause: root })
    const outer = new Error('Write contract failed', { cause: wrapped })
    expect(isStaleConnectorError(outer)).toBe(true)
  })

  it('ignores unrelated "is not a function" errors', () => {
    expect(isStaleConnectorError(new Error('foo.bar is not a function'))).toBe(false)
  })

  it('ignores ordinary transaction failures', () => {
    expect(isStaleConnectorError(new Error('User rejected the request'))).toBe(false)
    expect(isStaleConnectorError(new Error('execution reverted: insufficient balance'))).toBe(false)
    expect(isStaleConnectorError(null)).toBe(false)
    expect(isStaleConnectorError(undefined)).toBe(false)
  })

  it('terminates on a cyclic cause chain', () => {
    const a = new Error('outer') as Error & { cause?: unknown }
    const b = new Error('inner') as Error & { cause?: unknown }
    a.cause = b
    b.cause = a
    expect(isStaleConnectorError(a)).toBe(false)
  })
})

describe('parseTransactionError — stale connector', () => {
  it('classifies as WALLET_DISCONNECTED rather than WRONG_NETWORK', () => {
    // Regression: the WRONG_NETWORK branch matches on the substring 'chain',
    // which is present in 'getChainId'. Ordering must keep this case out of it.
    const parsed = parseTransactionError(
      new Error('r.connector.getChainId is not a function'),
    )
    expect(parsed.type).toBe(TransactionErrorType.WALLET_DISCONNECTED)
    expect(parsed.recoverable).toBe(false)
    expect(parsed.message).not.toContain('is not a function')
  })

  it('does not offer a retry the user cannot benefit from', () => {
    expect(shouldOfferRetry(TransactionErrorType.WALLET_DISCONNECTED)).toBe(false)
  })

  it('still classifies genuine wrong-network errors correctly', () => {
    expect(parseTransactionError(new Error('unsupported chain')).type).toBe(
      TransactionErrorType.WRONG_NETWORK,
    )
  })
})
