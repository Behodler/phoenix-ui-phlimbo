import { useReadContract } from 'wagmi';

// Pool IDs for Uniswap V4 pools (these are poolIds, not contract addresses)
// phUSD/sUSDS pool
const PHUSD_SUSDS_POOL_ID = '0x114bcf3588537bba82c7e31fb8caf355921edb29971fedde97221b5c843a3e05';
// USDC/sUSDS pool (for getting sUSDS price in USD)
const USDC_SUSDS_POOL_ID = '0x251a9b67c78e6ef5f9be63f91d6a8ef814663bf03fc14602e41c34bd8bbb1392';

// Token addresses (used in comments for documentation of pool ordering)
// phUSD: 0xf3B5B661b92B75C71fA5Aba8Fd95D7514A9CD605
// sUSDS: 0xa3931d71877c0e7a3148cb7eb4463524fec27fbd
// USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

// Minimal ABI for Uniswap V4 StateView
const stateViewAbi = [
  {
    name: 'getSlot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' },
    ],
  },
] as const;

// Uniswap V4 StateView contract on mainnet
const STATE_VIEW_ADDRESS = '0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227';

export interface UseUniswapPriceResult {
  price: number | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Hook to fetch phUSD price from Uniswap V4 pools
 *
 * Price calculation:
 * 1. Read phUSD/sUSDS pool to get phUSD price in sUSDS
 * 2. Read USDC/sUSDS pool to get sUSDS price in USDC (=USD)
 * 3. Combine: phUSD_USD_price = phUSD_sUSDS_price * sUSDS_USD_price
 *
 * Uniswap V4 sqrtPriceX96 math:
 * - sqrtPriceX96 = sqrt(price) * 2^96, where price = token1 / token0
 * - token0 is the token with the lower address (lexicographically)
 * - The resulting ratio appears usable directly without decimal adjustment
 */
export function useUniswapPrice(): UseUniswapPriceResult {
  // Read slot0 for phUSD/sUSDS pool
  const {
    data: phUsdSusdsSlot0,
    isLoading: isLoadingPhUsdPool,
    isError: isErrorPhUsdPool,
    error: errorPhUsdPool,
  } = useReadContract({
    address: STATE_VIEW_ADDRESS as `0x${string}`,
    abi: stateViewAbi,
    functionName: 'getSlot0',
    args: [PHUSD_SUSDS_POOL_ID as `0x${string}`],
    query: {
      enabled: true,
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  });

  // Read slot0 for USDC/sUSDS pool
  const {
    data: usdcSusdsSlot0,
    isLoading: isLoadingUsdcPool,
    isError: isErrorUsdcPool,
    error: errorUsdcPool,
  } = useReadContract({
    address: STATE_VIEW_ADDRESS as `0x${string}`,
    abi: stateViewAbi,
    functionName: 'getSlot0',
    args: [USDC_SUSDS_POOL_ID as `0x${string}`],
    query: {
      enabled: true,
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  });

  const isLoading = isLoadingPhUsdPool || isLoadingUsdcPool;
  const isError = isErrorPhUsdPool || isErrorUsdcPool;
  const error = errorPhUsdPool || errorUsdcPool;

  // Calculate price from sqrtPriceX96 values
  let price: number | null = null;

  if (phUsdSusdsSlot0 && usdcSusdsSlot0) {
    try {
      // ========== PHUSD/SUSDS POOL CALCULATION ==========
      // Pool: phUSD/sUSDS
      // - token0 = sUSDS (0xa39... lower address) - 18 decimals
      // - token1 = phUSD (0xf3B... higher address) - 18 decimals
      // - sqrtPriceX96 gives: token1_raw / token0_raw = phUSD_raw / sUSDS_raw
      // - Since both tokens have 18 decimals, no decimal adjustment needed
      // - The ratio represents: how many phUSD per sUSDS
      // - To get phUSD value in sUSDS, we invert: sUSDS_per_phUSD = 1 / phUSD_per_sUSDS

      const sqrtPricePhUsd = Number(phUsdSusdsSlot0[0]);
      const phUsdPerSusdsRaw = Math.pow(sqrtPricePhUsd / Math.pow(2, 96), 2);
      // No decimal adjustment needed (both 18 decimals)
      const phUsdPerSusds = phUsdPerSusdsRaw;
      // How many sUSDS one phUSD is worth
      const phUsdValueInSusds = 1 / phUsdPerSusds;

      // Debug logging
      console.log('[useUniswapPrice] phUSD/sUSDS pool sqrtPriceX96:', phUsdSusdsSlot0[0]?.toString());
      console.log('[useUniswapPrice] phUsdPerSusdsRaw:', phUsdPerSusdsRaw);
      console.log('[useUniswapPrice] phUsdValueInSusds (sUSDS per phUSD):', phUsdValueInSusds);

      // ========== USDC/SUSDS POOL CALCULATION ==========
      // Pool: USDC/sUSDS
      // - token0 = USDC (0xA0b... lower address) - 6 decimals
      // - token1 = sUSDS (0xa39... higher address) - 18 decimals
      // - sqrtPriceX96 gives: token1/token0 = sUSDS/USDC ratio
      // - Invert to get USD value of sUSDS (USDC per sUSDS)
      //
      // NOTE: No decimal adjustment applied - the sqrtPriceX96 math appears to
      // produce usable ratios directly. The 91c bug was due to showing sUSDS price
      // instead of properly chaining phUSD -> sUSDS -> USD.

      const sqrtPriceUsdc = Number(usdcSusdsSlot0[0]);
      const susdsPerUsdcRaw = Math.pow(sqrtPriceUsdc / Math.pow(2, 96), 2);

      // Invert to get USDC per sUSDS (USD value of 1 sUSDS)
      const susdsValueInUsd = 1 / susdsPerUsdcRaw;

      // Debug logging
      console.log('[useUniswapPrice] USDC/sUSDS pool sqrtPriceX96:', usdcSusdsSlot0[0]?.toString());
      console.log('[useUniswapPrice] susdsPerUsdcRaw:', susdsPerUsdcRaw);
      console.log('[useUniswapPrice] susdsValueInUsd (USDC per sUSDS):', susdsValueInUsd);

      // ========== FINAL PRICE CALCULATION ==========
      // phUSD dollar price = phUSD value in sUSDS * sUSDS value in USD
      price = phUsdValueInSusds * susdsValueInUsd;

      console.log('[useUniswapPrice] Final phUSD price:', phUsdValueInSusds, '*', susdsValueInUsd, '=', price);

    } catch (e) {
      console.error('[useUniswapPrice] Error calculating price:', e);
    }
  }

  return {
    price,
    isLoading,
    isError,
    error: error as Error | null,
  };
}

export default useUniswapPrice;
