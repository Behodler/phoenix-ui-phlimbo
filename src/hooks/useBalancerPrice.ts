import { useReadContract } from 'wagmi';

// Balancer e-CLP pool address for phUSD/sUSDS
const BALANCER_POOL_ADDRESS = '0x5b26d938f0be6357c39e936cc9c2277b9334ea58' as const;

// sUSDS ERC4626 contract address
const SUSDS_ADDRESS = '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd' as const;

// Minimal ABI for Balancer e-CLP pool getRate
const balancerPoolAbi = [
  {
    name: 'getRate',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
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
 * 1. Read Balancer e-CLP pool getRate() to get the BPT rate (phUSD value in sUSDS terms)
 * 2. Read sUSDS ERC4626 convertToAssets to get sUSDS value in USD (underlying USDS = $1)
 * 3. Combine: phUSD_USD_price = pool_rate * sUSDS_USD_value
 *
 * Using ERC4626 convertToAssets for USD conversion because:
 * - Immune to pool manipulation
 * - Direct oracle from the sUSDS vault itself
 * - USDS underlying is worth $1
 */
export function useBalancerPrice(): UseBalancerPriceResult {
  // Read getRate() from Balancer e-CLP pool
  const {
    data: poolRate,
    isLoading: isLoadingPoolRate,
    isError: isErrorPoolRate,
    error: errorPoolRate,
  } = useReadContract({
    address: BALANCER_POOL_ADDRESS,
    abi: balancerPoolAbi,
    functionName: 'getRate',
    query: {
      enabled: true,
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  });

  // Read sUSDS ERC4626 convertToAssets to get USD value of 1 sUSDS
  // 1e18 shares (1 sUSDS) converts to X USDS (underlying), where USDS = $1
  const {
    data: sUsdsConvertResult,
    isLoading: isLoadingSusdsConvert,
    isError: isErrorSusdsConvert,
    error: errorSusdsConvert,
  } = useReadContract({
    address: SUSDS_ADDRESS,
    abi: erc4626Abi,
    functionName: 'convertToAssets',
    args: [BigInt('1000000000000000000')], // 1e18 shares
    query: {
      enabled: true,
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  });

  const isLoading = isLoadingPoolRate || isLoadingSusdsConvert;
  const isError = isErrorPoolRate || isErrorSusdsConvert;
  const error = errorPoolRate || errorSusdsConvert;

  // Calculate price from pool rate and ERC4626 convertToAssets
  let price: number | null = null;

  if (poolRate !== undefined && sUsdsConvertResult !== undefined) {
    try {
      // ========== STEP 1: Get pool rate from Balancer e-CLP ==========
      // getRate() returns the BPT rate scaled by 1e18
      // This represents the value of the pool token in terms of the pool's assets
      const rateNormalized = Number(poolRate) / 1e18;

      // ========== STEP 2: Get sUSDS to USD ratio from ERC4626 convertToAssets ==========
      // sUSDS is an ERC4626 vault with USDS as underlying (USDS = $1)
      // convertToAssets(1e18) returns how many USDS (wei) 1 sUSDS is worth
      const sUsdsToUsdRatio = Number(sUsdsConvertResult) / 1e18;

      // ========== STEP 3: Calculate final phUSD price in USD ==========
      // phUSD price = pool rate * sUSDS-to-USD conversion
      price = rateNormalized * sUsdsToUsdRatio;

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
