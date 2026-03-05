import { useReadContract } from 'wagmi';

// Balancer e-CLP pool address for phUSD/sUSDS
const BALANCER_POOL_ADDRESS = '0x5b26d938f0be6357c39e936cc9c2277b9334ea58' as const;

// Balancer V3 Vault address
const BALANCER_VAULT_ADDRESS = '0xbA1333333333a1BA1108E8412f11850A5C319bA9' as const;

// sUSDS ERC4626 contract address
const SUSDS_ADDRESS = '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd' as const;

// 0.1% invariant increase for marginal price computation
const INVARIANT_RATIO = BigInt('1001000000000000000'); // 1.001e18

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

// Minimal ABI for Balancer e-CLP pool computeBalance
const poolAbi = [
  {
    name: 'computeBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'balancesLiveScaled18', type: 'uint256[]' },
      { name: 'tokenInIndex', type: 'uint256' },
      { name: 'invariantRatio', type: 'uint256' },
    ],
    outputs: [{ name: 'newBalance', type: 'uint256' }],
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
 * Hook to fetch phUSD price in USD from Balancer e-CLP pool
 *
 * Price calculation:
 * 1. Read live balances from Balancer Vault (pool tokens: [sUSDS, phUSD])
 * 2. Use pool's computeBalance to find how each token contributes to a
 *    small invariant increase — the ratio of deltas gives the marginal
 *    exchange rate (phUSD price in sUSDS terms)
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
      refetchInterval: 30000,
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
      refetchInterval: 30000,
    },
  });

  // Phase 2a: Compute new sUSDS balance needed for 0.1% invariant increase
  const balancesArray = liveBalances ? [...liveBalances] : undefined;
  const {
    data: newSusdsBalance,
    isLoading: isLoadingSusdsBal,
    isError: isErrorSusdsBal,
    error: errorSusdsBal,
  } = useReadContract({
    address: BALANCER_POOL_ADDRESS,
    abi: poolAbi,
    functionName: 'computeBalance',
    args: balancesArray ? [balancesArray, BigInt(0), INVARIANT_RATIO] : undefined,
    query: {
      enabled: !!liveBalances,
      refetchInterval: 30000,
    },
  });

  // Phase 2b: Compute new phUSD balance needed for 0.1% invariant increase
  const {
    data: newPhUsdBalance,
    isLoading: isLoadingPhUsdBal,
    isError: isErrorPhUsdBal,
    error: errorPhUsdBal,
  } = useReadContract({
    address: BALANCER_POOL_ADDRESS,
    abi: poolAbi,
    functionName: 'computeBalance',
    args: balancesArray ? [balancesArray, BigInt(1), INVARIANT_RATIO] : undefined,
    query: {
      enabled: !!liveBalances,
      refetchInterval: 30000,
    },
  });

  const isLoading = isLoadingBalances || isLoadingSusdsConvert || isLoadingSusdsBal || isLoadingPhUsdBal;
  const isError = isErrorBalances || isErrorSusdsConvert || isErrorSusdsBal || isErrorPhUsdBal;
  const error = errorBalances || errorSusdsConvert || errorSusdsBal || errorPhUsdBal;

  let price: number | null = null;

  if (
    liveBalances !== undefined &&
    sUsdsConvertResult !== undefined &&
    newSusdsBalance !== undefined &&
    newPhUsdBalance !== undefined
  ) {
    try {
      // Delta sUSDS needed for 0.1% invariant increase
      const deltaSusds = Number(newSusdsBalance - liveBalances[0]);
      // Delta phUSD needed for 0.1% invariant increase
      const deltaPhUsd = Number(newPhUsdBalance - liveBalances[1]);

      if (deltaPhUsd > 0 && deltaSusds > 0) {
        // Marginal exchange rate: phUSD price in sUSDS terms
        const phUsdInSusds = deltaSusds / deltaPhUsd;

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
