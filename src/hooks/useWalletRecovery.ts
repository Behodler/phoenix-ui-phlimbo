import { useCallback } from 'react';
import { useDisconnect } from 'wagmi';

/** Prefix wagmi uses for every key it persists to localStorage. */
const WAGMI_STORAGE_PREFIX = 'wagmi.';

/**
 * Removes wagmi's persisted connection state.
 *
 * Disconnecting alone is not enough to clear a *stale* connection: the inert
 * connector cannot service the disconnect either, so the stored entry can
 * survive and be rehydrated on the next mount, reproducing the failure. Wiping
 * the `wagmi.*` keys guarantees the next load starts from a clean slate.
 */
function clearPersistedConnection(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keys = Object.keys(window.localStorage).filter((key) =>
      key.startsWith(WAGMI_STORAGE_PREFIX),
    );
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Private-mode / quota-blocked storage: the reload below still gives the
    // user a fresh connector, so a failure here is not worth surfacing.
  }
}

export interface UseWalletRecoveryResult {
  /**
   * Drops the current wallet connection and reloads into a clean state, so the
   * user can reconnect. Safe to call from a toast action handler.
   */
  recoverConnection: () => Promise<void>;
}

/**
 * Recovery path for a wallet connection that can no longer sign.
 *
 * See `utils/walletConnectionErrors.ts` for how the broken state arises and how
 * it is detected. Because the bad connection is restored from localStorage on
 * every mount, recovery has to clear that storage and reload — an in-place
 * reconnect would re-hydrate the same inert connector.
 */
export function useWalletRecovery(): UseWalletRecoveryResult {
  const { disconnectAsync } = useDisconnect();

  const recoverConnection = useCallback(async (): Promise<void> => {
    try {
      await disconnectAsync();
    } catch {
      // Expected when the connector is the thing that's broken — the storage
      // wipe below is what actually clears the connection.
    }
    clearPersistedConnection();
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, [disconnectAsync]);

  return { recoverConnection };
}
