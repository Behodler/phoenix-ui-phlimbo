import { useReadContract } from 'wagmi';
import { log } from '../utils/logger';

// Pool ID for Uniswap V4 phUSD/sUSDS pool
const PHUSD_SUSDS_POOL_ID = '0x114bcf3588537bba82c7e31fb8caf355921edb29971fedde97221b5c843a3e05';

// Token addresses
// phUSD: 0xf3B5B661b92B75C71fA5Aba8Fd95D7514A9CD605
// sUSDS: 0xa3931d71877c0e7a3148cb7eb4463524fec27fbd (ERC4626 vault, underlying is USDS worth $1)

// sUSDS ERC4626 contract address
const SUSDS_ADDRESS = '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd' as const;

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

// Uniswap V4 StateView contract on mainnet
const STATE_VIEW_ADDRESS = '0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227';

export interface UseUniswapPriceResult {
  price: number | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Hook to fetch phUSD price in USD
 *
 * Price calculation:
 * 1. Read phUSD/sUSDS pool to get phUSD value in sUSDS
 * 2. Read sUSDS ERC4626 convertToAssets to get sUSDS value in USD (underlying USDS = $1)
 * 3. Combine: phUSD_USD_price = phUSD_sUSDS_value * sUSDS_USD_value
 *
 * Using ERC4626 convertToAssets instead of USDC/sUSDS Uniswap pool because:
 * - Avoids decimal mismatch issues (USDC=6, sUSDS=18)
 * - Avoids JavaScript Number precision loss
 * - Immune to pool manipulation
 * - Direct oracle from the sUSDS vault itself
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

  const isLoading = isLoadingPhUsdPool || isLoadingSusdsConvert;
  const isError = isErrorPhUsdPool || isErrorSusdsConvert;
  const error = errorPhUsdPool || errorSusdsConvert;

  // Calculate price from sqrtPriceX96 and ERC4626 convertToAssets
  let price: number | null = null;

  if (phUsdSusdsSlot0 && sUsdsConvertResult !== undefined) {
    try {
      // ========== STEP 1: Get raw sqrtPriceX96 from phUSD/sUSDS pool ==========
      const sqrtPriceX96Raw = phUsdSusdsSlot0[0];
      log.debug('[useUniswapPrice] Step 1: Raw sqrtPriceX96 from phUSD/sUSDS pool:', sqrtPriceX96Raw.toString());

      // ========== STEP 2: Convert sqrtPriceX96 to Number and divide by 2^96 ==========
      const sqrtPricePhUsd = Number(sqrtPriceX96Raw);
      const TWO_POW_96 = Math.pow(2, 96);
      const sqrtPriceNormalized = sqrtPricePhUsd / TWO_POW_96;
      log.debug('[useUniswapPrice] Step 2: sqrtPriceX96 / 2^96 =', sqrtPriceNormalized);

      // ========== STEP 3: Square to get phUSD per sUSDS ratio ==========
      // Pool ordering: token0 = sUSDS (lower address), token1 = phUSD (higher address)
      // sqrtPriceX96 gives: sqrt(token1/token0) = sqrt(phUSD/sUSDS)
      // Squared: phUSD/sUSDS = how many phUSD per 1 sUSDS
      const phUsdPerSusds = Math.pow(sqrtPriceNormalized, 2);
      log.debug('[useUniswapPrice] Step 3: Squared to get phUsdPerSusds =', phUsdPerSusds);

      // ========== STEP 4: Invert to get sUSDS value of 1 phUSD ==========
      // We want: how many sUSDS is 1 phUSD worth?
      const phUsdValueInSusds = 1 / phUsdPerSusds;
      log.debug('[useUniswapPrice] Step 4: Inverted to get phUsdValueInSusds =', phUsdValueInSusds);

      // ========== STEP 5: Get sUSDS to USD ratio from ERC4626 convertToAssets ==========
      // sUSDS is an ERC4626 vault with USDS as underlying (USDS = $1)
      // convertToAssets(1e18) returns how many USDS (wei) 1 sUSDS is worth
      const rawConvertResult = sUsdsConvertResult;
      log.debug('[useUniswapPrice] Step 5: sUSDS convertToAssets(1e18) raw result =', rawConvertResult.toString());

      // ========== STEP 6: Calculate sUSDS to USD ratio ==========
      // Divide by 1e18 to get the ratio (since USDS has 18 decimals and is worth $1)
      const sUsdsToUsdRatio = Number(rawConvertResult) / 1e18;
      log.debug('[useUniswapPrice] Step 6: sUsdsToUsdRatio = rawResult / 1e18 =', sUsdsToUsdRatio);

      // ========== STEP 7: Calculate final phUSD price in USD ==========
      // phUSD dollar price = (sUSDS per phUSD) * (USD per sUSDS)
      price = phUsdValueInSusds * sUsdsToUsdRatio;
      log.debug('[useUniswapPrice] Step 7: Final price = phUsdValueInSusds * sUsdsToUsdRatio =', phUsdValueInSusds, '*', sUsdsToUsdRatio, '=', price);

    } catch (e) {
      log.error('[useUniswapPrice] Error calculating price:', e);
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
