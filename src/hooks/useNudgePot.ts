import { useMemo } from 'react';
import { erc20Abi, formatUnits } from 'viem';
import type { Address } from 'viem';
import { useReadContract, useReadContracts } from 'wagmi';
import {
  batchNftMinterMultiTokenAbi,
  nudgeStreamerAbi,
} from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { useMinterPageView } from './useMinterPageView';
import { useBalancerPrice } from './useBalancerPrice';
import { useKenduPrice } from './useKenduPrice';
import { geometricSumRaw } from '../utils/batchMintMath';
import { canonicalSymbol, nudgeTokenMeta } from '../data/nudgeTokenMeta';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Liquid Sky Phoenix is the NFT the whale batch mints, and it is priced in
 * USDS. Hard-coding the prefix keeps this hook decoupled from the order of the
 * static-config array — same reasoning as `WhaleMintPanel`.
 */
const LIQUID_SKY_PHOENIX_TOKEN_PREFIX = 'USDS' as const;

/** USDS is a USD stablecoin, so one unit of mint cost is one dollar of mint cost. */
const USDS_DECIMALS = 18;

export interface NudgePotToken {
  /** ERC20 address, in on-chain whitelist order. */
  address: Address;
  /** Ticker as displayed — the canonical casing when we know the token, else the raw `symbol()`. */
  symbol: string;
  /** Canonical uppercase key (`mUSDC` → `USDC`), for metadata lookups and tests. */
  canonical: string;
  decimals: number;
  /** Already in the minter's custody: `balanceOf(minter)`. */
  balanceRaw: bigint;
  /**
   * Accrued but not yet settled on the NudgeStreamer —
   * `pendingStream(minter, token)`. `batchMint` flushes this into the pot
   * before it snapshots balances, so it is genuinely part of the reward.
   */
  pendingRaw: bigint;
  /** What a mint right now would actually pay out: `balanceRaw + pendingRaw`. */
  totalRaw: bigint;
  /** Undistributed remainder still held by the streamer — the ceiling `pendingRaw` accrues toward. */
  bufferRaw: bigint;
  /** Streamer depletion rate, scaled by 1e18. Drives the live counter. */
  rewardPerSecondRaw: bigint;
  /** True when this token has an active stream still paying out. */
  isStreaming: boolean;
  /** `totalRaw` rendered for display. */
  amountFormatted: string;
  /** USD value of this leg (present + due), or `null` when we have no price for the token. */
  usd: number | null;
  /** USD per whole token, or `null` when unpriced. Lets the live counter re-value as it ticks. */
  usdPerUnit: number | null;
  logo?: string;
  url?: string;
}

export interface UseNudgePotResult {
  /** Whitelist order is meaningful — `batchMint`'s `minRewards` is positional and must match. */
  tokens: NudgePotToken[];
  /** Raw on-chain `nudgeSize`, passed verbatim as `batchMint`'s `count`. */
  nudgeSizeRaw: bigint | undefined;
  /** `nudgeSize` as a number for display. `0` while loading. */
  count: number;
  /** Exact USDS the minter will pull, matching the on-chain geometric price ramp. */
  mintCostRaw: bigint;
  /** `mintCostRaw` in dollars (USDS pinned to $1). */
  mintCostUsd: number;
  /** Sum of the priced legs. Legs with no price contribute nothing. */
  potUsd: number;
  /** True when at least one leg has a balance but no USD price — the total is a lower bound. */
  isPotValuePartial: boolean;
  /** True once the whole pot is non-zero. A zero pot means there is no discount to offer. */
  hasReward: boolean;
  /**
   * Client clock (`Date.now()`) at the moment the pot reads resolved. The live
   * counter extrapolates from HERE rather than from the streamer's `lastUpdate`
   * so it only ever uses elapsed *deltas* — identical in the chain's clock and
   * the browser's — and never depends on the two being in sync.
   */
  readAtMs: number;
  /** BatchNFTMinter address, or undefined when not deployed on this chain. */
  minterAddress: Address | undefined;
  isLoading: boolean;
  /** Set when the minter is missing or is not the multi-token variant. */
  isUnavailable: boolean;
  refetch: () => void;
}

/**
 * Render-friendly amount. Big pots read better without cents; sub-unit
 * balances (a 6-decimal stablecoin dust pot, a fraction of a KENDU) would
 * round to "0.00" at two decimals, so they get more precision instead.
 */
export function formatTokenAmount(raw: bigint, decimals: number): string {
  const value = Number(formatUnits(raw, decimals));
  if (value === 0) return '0';
  if (value >= 1_000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  if (value >= 1) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/**
 * Live multi-token nudge reward pot for the whale batch mint.
 *
 * The reward token set is **read from the chain**, never listed in the UI:
 * `BatchNFTMinterMultiToken.getNudgeTokens()` returns the owner-managed
 * whitelist, and per-token `symbol` / `decimals` / `balanceOf(minter)` follow.
 * Because the minter address comes from `ContractAddressContext`, switching
 * networks re-reads that chain's whitelist and the token list adapts on its
 * own — mainnet will simply show whatever it has whitelisted once deployed.
 *
 * USD pricing per leg (see `nudgeTokenMeta`):
 *   - `stable` (USDC, USDS) → $1, hard-coded
 *   - `phusd`               → Balancer spot, the same figure the staking APYs use
 *   - `kendu`               → CoinGecko spot, one fetch per page load
 *   - anything else         → no price; the leg renders but is excluded from the total
 */
export function useNudgePot(): UseNudgePotResult {
  const { addresses } = useContractAddresses();
  const { data: minterData, refetch: refetchMinterData } = useMinterPageView();
  const { price: phUsdPrice } = useBalancerPrice();
  const { price: kenduPrice } = useKenduPrice();

  const minterAddress = addresses?.BatchNFTMinter as Address | undefined;
  const minterAvailable =
    !!minterAddress && minterAddress.toLowerCase() !== ZERO_ADDRESS;

  // Hook order must stay stable, so always call; gate execution via `enabled`.
  const {
    data: nudgeTokenAddresses,
    isLoading: isLoadingWhitelist,
    isError: isWhitelistError,
    refetch: refetchWhitelist,
  } = useReadContract({
    address: minterAddress,
    abi: batchNftMinterMultiTokenAbi,
    functionName: 'getNudgeTokens',
    query: { enabled: minterAvailable },
  });

  const { data: nudgeSizeRaw, isLoading: isLoadingNudgeSize } = useReadContract({
    address: minterAddress,
    abi: batchNftMinterMultiTokenAbi,
    functionName: 'nudgeSize',
    query: { enabled: minterAvailable },
  });

  // The streamer buffers bursty donations and meters them into the pot
  // linearly, so a large share of the reward can be sitting on it rather than
  // in the minter's balance. `batchMint` calls `pullPendingStream` over the
  // whole whitelist *before* it snapshots balances, which is what makes the
  // accrued-but-unsettled amount genuinely part of what a mint pays out.
  const { data: nudgeStreamerRaw, isLoading: isLoadingStreamer } =
    useReadContract({
      address: minterAddress,
      abi: batchNftMinterMultiTokenAbi,
      functionName: 'nudgeStreamer',
      query: { enabled: minterAvailable },
    });

  const nudgeStreamer = nudgeStreamerRaw as Address | undefined;
  const streamerAvailable =
    !!nudgeStreamer && nudgeStreamer.toLowerCase() !== ZERO_ADDRESS;

  const tokenAddresses = useMemo(
    () => (nudgeTokenAddresses as readonly Address[] | undefined) ?? [],
    [nudgeTokenAddresses]
  );

  // One multicall covering every whitelisted token. The contract list length
  // varies with the whitelist, which is fine — it is a single hook whose
  // argument changes, not a varying hook count.
  //
  // Per token: symbol / decimals / balanceOf on the ERC20, then pendingStream
  // and streams on the NudgeStreamer. `streams` supplies `buffer` and
  // `rewardPerSecond`, which are what let the UI keep counting between reads.
  const readsPerToken = streamerAvailable ? 5 : 3;
  const {
    data: tokenReads,
    dataUpdatedAt,
    isLoading: isLoadingTokenReads,
    refetch: refetchTokenReads,
  } = useReadContracts({
    contracts: tokenAddresses.flatMap((token) => [
      { address: token, abi: erc20Abi, functionName: 'symbol' } as const,
      { address: token, abi: erc20Abi, functionName: 'decimals' } as const,
      {
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [minterAddress as Address],
      } as const,
      ...(streamerAvailable
        ? ([
            {
              address: nudgeStreamer as Address,
              abi: nudgeStreamerAbi,
              functionName: 'pendingStream',
              args: [minterAddress as Address, token],
            },
            {
              address: nudgeStreamer as Address,
              abi: nudgeStreamerAbi,
              functionName: 'streams',
              args: [minterAddress as Address, token],
            },
          ] as const)
        : []),
    ]),
    query: {
      enabled: minterAvailable && tokenAddresses.length > 0,
      // A stream that runs dry, or a competing whale mint, only shows up on a
      // re-read; the live counter between polls is extrapolation, not truth.
      refetchInterval: 30_000,
    },
  });

  const tokens = useMemo<NudgePotToken[]>(() => {
    if (!tokenReads || tokenAddresses.length === 0) return [];

    return tokenAddresses.map((address, index) => {
      const base = index * readsPerToken;
      const symbolResult = tokenReads[base];
      const decimalsResult = tokenReads[base + 1];
      const balanceResult = tokenReads[base + 2];
      const pendingResult = streamerAvailable ? tokenReads[base + 3] : undefined;
      const streamResult = streamerAvailable ? tokenReads[base + 4] : undefined;

      // A failed metadata read must not blank the whole strip: fall back to a
      // truncated address and 18 decimals, which is what an ERC20 that fails
      // `decimals()` is conventionally assumed to use.
      const rawSymbol =
        symbolResult?.status === 'success'
          ? (symbolResult.result as string)
          : `${address.slice(0, 6)}…`;
      const decimals =
        decimalsResult?.status === 'success'
          ? Number(decimalsResult.result)
          : 18;
      const balanceRaw =
        balanceResult?.status === 'success'
          ? (balanceResult.result as bigint)
          : 0n;

      // A token with no registered stream reads back zeros rather than
      // reverting, so an unregistered leg needs no special case.
      const pendingRaw =
        pendingResult?.status === 'success'
          ? (pendingResult.result as bigint)
          : 0n;
      // `streams` returns (duration, buffer, rewardPerSecond, lastUpdate).
      const stream =
        streamResult?.status === 'success'
          ? (streamResult.result as readonly [bigint, bigint, bigint, bigint])
          : undefined;
      const bufferRaw = stream?.[1] ?? 0n;
      const rewardPerSecondRaw = stream?.[2] ?? 0n;

      const totalRaw = balanceRaw + pendingRaw;

      const canonical = canonicalSymbol(rawSymbol);
      const meta = nudgeTokenMeta(rawSymbol);
      // Everything downstream values the leg at present + due, because that is
      // what `batchMint` pays out.
      const amount = Number(formatUnits(totalRaw, decimals));

      let usdPerUnit: number | null = null;
      switch (meta?.priceSource) {
        case 'stable':
          usdPerUnit = 1;
          break;
        case 'phusd':
          // Mirrors `useStakingPageData`: the Balancer pool lives on mainnet,
          // so off-mainnet the read fails and phUSD falls back to its $1 peg.
          usdPerUnit = phUsdPrice ?? 1;
          break;
        case 'kendu':
          usdPerUnit = kenduPrice;
          break;
        default:
          usdPerUnit = null;
      }
      const usd = usdPerUnit === null ? null : amount * usdPerUnit;

      return {
        address,
        symbol: meta?.display ?? rawSymbol,
        canonical,
        decimals,
        balanceRaw,
        pendingRaw,
        totalRaw,
        bufferRaw,
        rewardPerSecondRaw,
        // A drained buffer still reads a non-zero rate — the rate is only
        // recomputed on deposit — so the buffer is what says "still paying".
        isStreaming: rewardPerSecondRaw > 0n && bufferRaw > 0n,
        amountFormatted: formatTokenAmount(totalRaw, decimals),
        usd,
        usdPerUnit,
        logo: meta?.logo,
        url: meta?.url,
      };
    });
  }, [
    tokenAddresses,
    tokenReads,
    readsPerToken,
    streamerAvailable,
    phUsdPrice,
    kenduPrice,
  ]);

  const potUsd = useMemo(
    () => tokens.reduce((sum, token) => sum + (token.usd ?? 0), 0),
    [tokens]
  );

  // Only an unpriced leg that actually holds something makes the total a lower
  // bound — an unpriced leg with a zero balance contributes nothing either way.
  const isPotValuePartial = useMemo(
    () => tokens.some((token) => token.usd === null && token.totalRaw > 0n),
    [tokens]
  );

  const count = nudgeSizeRaw !== undefined ? Number(nudgeSizeRaw) : 0;
  const lsp = minterData?.[LIQUID_SKY_PHOENIX_TOKEN_PREFIX];

  const mintCostRaw = useMemo(() => {
    if (!lsp || lsp.priceRaw <= 0n || count <= 0) return 0n;
    return geometricSumRaw(lsp.priceRaw, lsp.growthBasisPoints, count);
  }, [lsp, count]);

  const mintCostUsd = Number(formatUnits(mintCostRaw, USDS_DECIMALS));

  const isLoading =
    minterAvailable &&
    !isWhitelistError &&
    (isLoadingWhitelist ||
      isLoadingNudgeSize ||
      isLoadingStreamer ||
      (tokenAddresses.length > 0 && isLoadingTokenReads) ||
      !lsp ||
      lsp.priceRaw <= 0n);

  const refetch = () => {
    refetchWhitelist();
    refetchTokenReads();
    refetchMinterData();
  };

  return {
    tokens,
    nudgeSizeRaw: nudgeSizeRaw as bigint | undefined,
    count,
    mintCostRaw,
    mintCostUsd,
    potUsd,
    isPotValuePartial,
    hasReward: tokens.some((token) => token.totalRaw > 0n),
    readAtMs: dataUpdatedAt || Date.now(),
    minterAddress: minterAvailable ? minterAddress : undefined,
    isLoading,
    // `isWhitelistError` also catches a minter that is the single-token
    // BatchNFTMinter: `getNudgeTokens()` simply is not on its ABI, so the call
    // reverts rather than returning an empty list.
    isUnavailable: !minterAvailable || isWhitelistError,
    refetch,
  };
}

export default useNudgePot;
