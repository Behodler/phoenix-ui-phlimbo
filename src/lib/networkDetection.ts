import { NetworkType } from '../types/contracts'

/**
 * Chain IDs for supported networks
 */
export const CHAIN_IDS = {
  MAINNET: 1,
  ANVIL: 31337,
} as const

/**
 * Determines the network type based on chain ID
 * @param chainId - The current chain ID from wagmi
 * @returns NetworkType enum value
 */
export function getNetworkType(chainId: number | undefined): NetworkType {
  if (!chainId) {
    return NetworkType.UNSUPPORTED
  }

  switch (chainId) {
    case CHAIN_IDS.MAINNET:
      return NetworkType.MAINNET
    case CHAIN_IDS.ANVIL:
      return NetworkType.LOCAL
    default:
      return NetworkType.UNSUPPORTED
  }
}

/**
 * Check if the current network is mainnet
 * @param chainId - The current chain ID
 * @returns true if mainnet, false otherwise
 */
export function isMainnet(chainId: number | undefined): boolean {
  return chainId === CHAIN_IDS.MAINNET
}

/**
 * Check if the current network is local Anvil
 * @param chainId - The current chain ID
 * @returns true if local Anvil, false otherwise
 */
export function isLocalAnvil(chainId: number | undefined): boolean {
  return chainId === CHAIN_IDS.ANVIL
}
