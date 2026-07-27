/**
 * Detection for a wallet connection that has gone stale.
 *
 * Background: wagmi persists connections to localStorage (`wagmi.store`,
 * `wagmi.recentConnectorId`) and rehydrates them on mount. Rehydration
 * re-attaches the stored connection to a live connector instance by matching
 * connector id. When that match fails — the extension was removed, the wallet
 * announced a different EIP-6963 rdns this session, or the connector id shifted
 * across a wagmi/RainbowKit upgrade — wagmi is left holding the *deserialized*
 * connection: a plain `{id, name, type, uid}` object with no methods on it.
 *
 * Reads never notice, because every chain in `wagmiConfig` has an `http()`
 * transport and resolves through the public RPC. The failure only surfaces on
 * the first write, when `@wagmi/core`'s `getConnectorClient` calls
 * `connector.getChainId()` / `connector.getAccounts()` on that inert object and
 * gets `undefined is not a function`.
 *
 * The raw message ("r.connector.getChainId is not a function" once minified) is
 * meaningless to a user and, worse, offers no way out: retrying can never work,
 * because the broken connection is reloaded from storage on every mount. The
 * only fix is to drop the persisted state and reconnect.
 */

/** Connector methods whose absence indicates an inert, deserialized connector. */
const CONNECTOR_METHODS = [
  'getchainid',
  'getaccounts',
  'getprovider',
  'getclient',
  'isauthorized',
  'switchchain',
]

/** wagmi error classes that mean "the connection is gone, reconnect to fix". */
const CONNECTOR_ERROR_NAMES = [
  'connectornotconnectederror',
  'connectorunavailablereconnectingerror',
  'connectoraccountnotfounderror',
  'connectorchainmismatcherror',
]

/**
 * Flattens an error and its `cause` chain into lowercased message/name strings.
 *
 * viem and wagmi wrap errors several layers deep, so the connector failure is
 * routinely nested inside a `ContractFunctionExecutionError` rather than
 * sitting on the top-level error.
 */
function collectErrorText(error: unknown): string[] {
  const parts: string[] = []
  let current: unknown = error
  // Bounded walk — cause chains are shallow, and a cycle must not hang the UI.
  for (let depth = 0; current && depth < 10; depth++) {
    if (typeof current === 'string') {
      parts.push(current.toLowerCase())
      break
    }
    if (current instanceof Error || typeof current === 'object') {
      const err = current as { message?: unknown; name?: unknown; cause?: unknown }
      if (typeof err.message === 'string') parts.push(err.message.toLowerCase())
      if (typeof err.name === 'string') parts.push(err.name.toLowerCase())
      current = err.cause
    } else {
      break
    }
  }
  return parts
}

/**
 * True when `error` indicates the wallet connection is stale and the user must
 * reconnect — as opposed to a transient failure that a retry could clear.
 *
 * Matches two shapes:
 *  - a missing connector method (`…connector.getChainId is not a function`),
 *    which is the deserialized-connector case described above;
 *  - wagmi's own connector-lifecycle error classes.
 */
export function isStaleConnectorError(error: unknown): boolean {
  const parts = collectErrorText(error)
  if (parts.length === 0) return false

  return parts.some((text) => {
    if (CONNECTOR_ERROR_NAMES.some((name) => text.includes(name))) return true

    // Minifiers rename the *holder* (`r.connector`), never the property being
    // accessed, so the method name survives in the message verbatim.
    if (!text.includes('is not a function')) return false
    return CONNECTOR_METHODS.some((method) => text.includes(method))
  })
}

/** User-facing copy for a stale connection. Kept here so toast and transaction-error paths agree. */
export const STALE_CONNECTOR_TITLE = 'Wallet Needs Reconnecting'

export const STALE_CONNECTOR_MESSAGE =
  'Your wallet session expired and can no longer sign. Reconnect your wallet to continue — ' +
  'your funds and balances are unaffected.'
