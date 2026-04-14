import { useReadContract } from 'wagmi';

// Balancer 50/50 balanced pool address for phUSD/sUSDS
export const BALANCER_POOL_ADDRESS = '0x642BB6860b4776CC10b26B8f361Fd139E7f0db04' as const;

// Balancer V3 Vault address
export const BALANCER_VAULT_ADDRESS = '0xbA1333333333a1BA1108E8412f11850A5C319bA9' as const;

// sUSDS ERC4626 contract address
const SUSDS_ADDRESS = '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd' as const;

// Minimal ABI for Balancer V3 Vault getCurrentLiveBalances
const vaultAbi = [
  {
    name: 'getCurrentLiveBalances',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'pool', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
] as const;

// ERC4626 ABI fragment for convertToAssets
const erc4626Abi = [
  {
    name: 'convertToAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: 'assets', type: 'uint256' }],
  },
] as const;

export interface UseBalancerPriceResult {
  price: number | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Hook to fetch phUSD price in USD from Balancer 50/50 balanced pool
 *
 * Price calculation:
 * 1. Read live balances from Balancer Vault (pool tokens: [sUSDS, phUSD])
 * 2. Compute spot price: sUSDS_balance / phUSD_balance gives phUSD price in sUSDS terms
 * 3. Multiply by sUSDS/USD rate from ERC4626 convertToAssets
 */
export function useBalancerPrice(): UseBalancerPriceResult {
  // Phase 1a: Get current live balances from Vault
  // Returns [sUSDS_balance, phUSD_balance] (token order matches pool.getTokens())
  const {
    data: liveBalances,
    isLoading: isLoadingBalances,
    isError: isErrorBalances,
    error: errorBalances,
  } = useReadContract({
    address: BALANCER_VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: 'getCurrentLiveBalances',
    args: [BALANCER_POOL_ADDRESS],
    query: {
      refetchInterval: 12000,
    },
  });

  // Phase 1b: Get sUSDS to USD ratio from ERC4626 convertToAssets
  const {
    data: sUsdsConvertResult,
    isLoading: isLoadingSusdsConvert,
    isError: isErrorSusdsConvert,
    error: errorSusdsConvert,
  } = useReadContract({
    address: SUSDS_ADDRESS,
    abi: erc4626Abi,
    functionName: 'convertToAssets',
    args: [BigInt('1000000000000000000')],
    query: {
      refetchInterval: 12000,
    },
  });

  const isLoading = isLoadingBalances || isLoadingSusdsConvert;
  const isError = isErrorBalances || isErrorSusdsConvert;
  const error = errorBalances || errorSusdsConvert;

  let price: number | null = null;

  if (liveBalances !== undefined && sUsdsConvertResult !== undefined) {
    try {
      // Spot price: sUSDS_balance / phUSD_balance gives phUSD price in sUSDS terms
      // Token order verified: index 0 = sUSDS, index 1 = phUSD (matches pool.getTokens())
      const sUsdsBalance = Number(liveBalances[0]);
      const phUsdBalance = Number(liveBalances[1]);

      if (phUsdBalance > 0 && sUsdsBalance > 0) {
        const phUsdInSusds = sUsdsBalance / phUsdBalance;

        // sUSDS to USD conversion
        const sUsdsToUsd = Number(sUsdsConvertResult) / 1e18;

        // Final phUSD price in USD
        price = phUsdInSusds * sUsdsToUsd;
      }
    } catch (e) {
    }
  }

  return {
    price,
    isLoading,
    isError,
    error: error as Error | null,
  };
}

export default useBalancerPrice;
