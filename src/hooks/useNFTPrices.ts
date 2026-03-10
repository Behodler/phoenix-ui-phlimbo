import { useReadContract } from 'wagmi';

// Mainnet addresses
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as const;
const EYE = '0x155ff1A85F440EE0A382eA949f24CE4E0b751c65' as const;
const SCX = '0x1B8568FbB47708E9E9D31Ff303254f748805bF21' as const;
const FLAX = '0x0cf758D4303295C43CD95e1232f0101ADb3DA9E8' as const;
const SUSDS = '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd' as const;

// Uniswap V2 Factory
const UNISWAP_V2_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f' as const;

// Chainlink price feeds
const ETH_USD_FEED = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419' as const;
const BTC_USD_FEED = '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c' as const;

// Minimal ABIs
const factoryAbi = [
  {
    name: 'getPair',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    outputs: [{ name: 'pair', type: 'address' }],
  },
] as const;

const pairAbi = [
  {
    name: 'getReserves',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' },
    ],
  },
  {
    name: 'token0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const chainlinkAbi = [
  {
    name: 'latestRoundData',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
  },
] as const;

const erc4626Abi = [
  {
    name: 'convertToAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: 'assets', type: 'uint256' }],
  },
] as const;

export interface UseNFTPricesResult {
  prices: Record<string, number | null>;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Hook to fetch USD prices for all NFT input tokens.
 *
 * - EYE, SCX, FLAX: Uniswap V2 WETH pair reserves -> ETH price -> multiply by Chainlink ETH/USD
 * - sUSDS: ERC4626 convertToAssets (1 sUSDS -> USDS, USDS ~ $1)
 * - BTC: Chainlink BTC/USD feed directly
 *
 * All queries use staleTime: Infinity (load once on page load, no refetching).
 */
export function useNFTPrices(): UseNFTPricesResult {
  const queryOpts = { staleTime: Infinity } as const;

  // --- Chainlink feeds ---

  const {
    data: ethUsdData,
    isLoading: isLoadingEthUsd,
    isError: isErrorEthUsd,
  } = useReadContract({
    address: ETH_USD_FEED,
    abi: chainlinkAbi,
    functionName: 'latestRoundData',
    query: queryOpts,
  });

  const {
    data: btcUsdData,
    isLoading: isLoadingBtcUsd,
    isError: isErrorBtcUsd,
  } = useReadContract({
    address: BTC_USD_FEED,
    abi: chainlinkAbi,
    functionName: 'latestRoundData',
    query: queryOpts,
  });

  // --- Uniswap V2 pair addresses ---

  const {
    data: eyePair,
    isLoading: isLoadingEyePair,
    isError: isErrorEyePair,
  } = useReadContract({
    address: UNISWAP_V2_FACTORY,
    abi: factoryAbi,
    functionName: 'getPair',
    args: [EYE, WETH],
    query: queryOpts,
  });

  const {
    data: scxPair,
    isLoading: isLoadingScxPair,
    isError: isErrorScxPair,
  } = useReadContract({
    address: UNISWAP_V2_FACTORY,
    abi: factoryAbi,
    functionName: 'getPair',
    args: [SCX, WETH],
    query: queryOpts,
  });

  const {
    data: flaxPair,
    isLoading: isLoadingFlaxPair,
    isError: isErrorFlaxPair,
  } = useReadContract({
    address: UNISWAP_V2_FACTORY,
    abi: factoryAbi,
    functionName: 'getPair',
    args: [FLAX, WETH],
    query: queryOpts,
  });

  // --- Pair reserves and token0 (enabled when pair address resolves) ---

  const {
    data: eyeReserves,
    isLoading: isLoadingEyeReserves,
    isError: isErrorEyeReserves,
  } = useReadContract({
    address: eyePair as `0x${string}` | undefined,
    abi: pairAbi,
    functionName: 'getReserves',
    query: { ...queryOpts, enabled: !!eyePair },
  });

  const {
    data: eyeToken0,
    isLoading: isLoadingEyeToken0,
    isError: isErrorEyeToken0,
  } = useReadContract({
    address: eyePair as `0x${string}` | undefined,
    abi: pairAbi,
    functionName: 'token0',
    query: { ...queryOpts, enabled: !!eyePair },
  });

  const {
    data: scxReserves,
    isLoading: isLoadingScxReserves,
    isError: isErrorScxReserves,
  } = useReadContract({
    address: scxPair as `0x${string}` | undefined,
    abi: pairAbi,
    functionName: 'getReserves',
    query: { ...queryOpts, enabled: !!scxPair },
  });

  const {
    data: scxToken0,
    isLoading: isLoadingScxToken0,
    isError: isErrorScxToken0,
  } = useReadContract({
    address: scxPair as `0x${string}` | undefined,
    abi: pairAbi,
    functionName: 'token0',
    query: { ...queryOpts, enabled: !!scxPair },
  });

  const {
    data: flaxReserves,
    isLoading: isLoadingFlaxReserves,
    isError: isErrorFlaxReserves,
  } = useReadContract({
    address: flaxPair as `0x${string}` | undefined,
    abi: pairAbi,
    functionName: 'getReserves',
    query: { ...queryOpts, enabled: !!flaxPair },
  });

  const {
    data: flaxToken0,
    isLoading: isLoadingFlaxToken0,
    isError: isErrorFlaxToken0,
  } = useReadContract({
    address: flaxPair as `0x${string}` | undefined,
    abi: pairAbi,
    functionName: 'token0',
    query: { ...queryOpts, enabled: !!flaxPair },
  });

  // --- sUSDS ERC4626 convertToAssets ---

  const {
    data: susdsAssets,
    isLoading: isLoadingSusds,
    isError: isErrorSusds,
  } = useReadContract({
    address: SUSDS,
    abi: erc4626Abi,
    functionName: 'convertToAssets',
    args: [BigInt('1000000000000000000')], // 1e18
    query: queryOpts,
  });

  // --- Aggregate loading / error ---

  const isLoading =
    isLoadingEthUsd ||
    isLoadingBtcUsd ||
    isLoadingEyePair ||
    isLoadingScxPair ||
    isLoadingFlaxPair ||
    isLoadingEyeReserves ||
    isLoadingEyeToken0 ||
    isLoadingScxReserves ||
    isLoadingScxToken0 ||
    isLoadingFlaxReserves ||
    isLoadingFlaxToken0 ||
    isLoadingSusds;

  const isError =
    isErrorEthUsd ||
    isErrorBtcUsd ||
    isErrorEyePair ||
    isErrorScxPair ||
    isErrorFlaxPair ||
    isErrorEyeReserves ||
    isErrorEyeToken0 ||
    isErrorScxReserves ||
    isErrorScxToken0 ||
    isErrorFlaxReserves ||
    isErrorFlaxToken0 ||
    isErrorSusds;

  // --- Compute prices ---

  const prices: Record<string, number | null> = {
    EYE: null,
    SCX: null,
    FLAX: null,
    sUSDS: null,
    BTC: null,
  };

  // ETH/USD from Chainlink (8 decimals)
  const ethUsd =
    ethUsdData !== undefined ? Number(ethUsdData[1]) / 1e8 : null;

  // BTC/USD from Chainlink (8 decimals)
  if (btcUsdData !== undefined) {
    prices.BTC = Number(btcUsdData[1]) / 1e8;
  }

  // sUSDS price: convertToAssets returns USDS amount for 1e18 shares, USDS ~ $1
  if (susdsAssets !== undefined) {
    prices.sUSDS = Number(susdsAssets) / 1e18;
  }

  // Helper: compute token price in USD from Uniswap V2 reserves
  function computeUniV2Price(
    reserves: readonly [bigint, bigint, number] | undefined,
    token0: string | undefined,
    tokenAddress: string,
    ethPrice: number | null,
  ): number | null {
    if (!reserves || !token0 || ethPrice === null) return null;

    const [reserve0, reserve1] = reserves;
    const r0 = Number(reserve0);
    const r1 = Number(reserve1);

    if (r0 === 0 || r1 === 0) return null;

    // Determine which reserve is WETH and which is the token
    const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
    const tokenReserve = isToken0 ? r0 : r1;
    const wethReserve = isToken0 ? r1 : r0;

    // All tokens are 18 decimals and WETH is 18 decimals, so ratio is direct
    const tokenPriceInEth = wethReserve / tokenReserve;
    return tokenPriceInEth * ethPrice;
  }

  prices.EYE = computeUniV2Price(eyeReserves, eyeToken0, EYE, ethUsd);
  prices.SCX = computeUniV2Price(scxReserves, scxToken0, SCX, ethUsd);
  prices.FLAX = computeUniV2Price(flaxReserves, flaxToken0, FLAX, ethUsd);

  return { prices, isLoading, isError };
}

export default useNFTPrices;
