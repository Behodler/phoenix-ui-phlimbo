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
      // sqrtPriceX96 conversion: price = (sqrtPriceX96 / 2^96)^2
      // Note: This gives price of token1 in terms of token0

      // For phUSD/sUSDS pool
      // Token ordering matters - need to check token0
      // The pool ID encodes the token ordering
      // phUSD address: 0xf3B5B661b92B75C71fA5Aba8Fd95D7514A9CD605
      // sUSDS comes before phUSD alphabetically when sorted by address
      // sUSDS: 0xa3931d71877c0e7a3148cb7eb4463524fec27fbd (lower, so token0)
      // phUSD: 0xf3B5B661b92B75C71fA5Aba8Fd95D7514A9CD605 (higher, so token1)
      // So sqrtPriceX96 gives us price of phUSD in sUSDS terms directly

      const sqrtPricePhUsd = Number(phUsdSusdsSlot0[0]);
      const pricePhUsdInSusds = Math.pow(sqrtPricePhUsd / Math.pow(2, 96), 2);

      // For USDC/sUSDS pool
      // USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (lower, so token0)
      // sUSDS: 0xa3931d71877c0e7a3148cb7eb4463524fec27fbd (higher, so token1)
      // So sqrtPriceX96 gives us price of sUSDS in USDC terms

      const sqrtPriceUsdc = Number(usdcSusdsSlot0[0]);
      const priceSusdsInUsdc = Math.pow(sqrtPriceUsdc / Math.pow(2, 96), 2);

      // phUSD has 18 decimals, sUSDS has 18 decimals, USDC has 6 decimals
      // Need to adjust for decimal differences
      // Price from pool is in terms of raw token amounts
      // For phUSD/sUSDS: price = (phUSD_amount * 10^18) / (sUSDS_amount * 10^18) - no adjustment needed
      // For USDC/sUSDS: price = (sUSDS_amount * 10^18) / (USDC_amount * 10^6)
      // So we need to multiply by 10^12 to normalize

      const priceSusdsInUsd = priceSusdsInUsdc * Math.pow(10, 12); // Adjust for USDC's 6 decimals

      // phUSD dollar price = phUSD price in sUSDS * sUSDS price in USD
      price = pricePhUsdInSusds * priceSusdsInUsd;

    } catch (e) {
      console.error('Error calculating price:', e);
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
