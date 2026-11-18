import type { Address } from 'viem';
import { zeroAddress } from 'viem';

/**
 * Normalise an address-book entry to a usable contract address.
 *
 * Address books carry the zero address as a placeholder for contracts that are
 * not deployed on a network yet (e.g. mainnet before a broadcast). Treat that,
 * and a missing entry, as "not live" so callers can gate their reads on it.
 */
export const liveAddress = (value: unknown): Address | undefined => {
  const addr = value as Address | undefined;
  return addr && addr.toLowerCase() !== zeroAddress ? addr : undefined;
};
