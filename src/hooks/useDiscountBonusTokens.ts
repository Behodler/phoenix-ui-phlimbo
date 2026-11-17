import { useMemo } from 'react';
import { erc20Abi, formatUnits, zeroAddress } from 'viem';
import type { Address, PublicClient } from 'viem';
import { useReadContract, useReadContracts } from 'wagmi';
import { batchNftMinterNudgeDiscountAbi, nudgeStreamerAbi } from '@behodler/phase2-wagmi-hooks';
import { usePolling } from '../contexts/PollingContext';
import { useBalancerPrice } from './useBalancerPrice';
import { useKenduPrice } from './useKenduPrice';
import { formatTokenAmount, nudgeUsdPerUnit } from './useNudgePot';
import { canonicalSymbol, nudgeTokenMeta } from '../data/nudgeTokenMeta';

const BONUS_REFRESH_INTERVAL_MS = 12_000;

export interface DiscountBonusToken {
  address: Address;
  symbol: string;
  /** Canonical key (`mKENDU` → `KENDU`), for metadata lookups and test ids. */
  canonical: string;
  decimals: number;
  /** What the next batch pays out: `balanceOf(minter) + pendingStream(minter, token)`. */
  totalRaw: bigint;
  amountFormatted: string;
  /** USD value of `totalRaw`, or `null` when the token has no price source. */
  usd: number | null;
  logo?: string;
}

export interface DiscountBonusTokensResult {
  /** Only legs with a non-zero payout, in `getBonusTokens()` order. */
  tokens: DiscountBonusToken[];
  /** Every leg, zero or not, in `getBonusTokens()` order. Empty until the reads land. */
  all: DiscountBonusToken[];
  /** Sum of the priced legs. */
  usdTotal: number;
  /** True when a non-zero leg has no USD price, so `usdTotal` is a lower bound. */
  isPartial: boolean;
}

/**
 * Bonus ("promo") tokens a `BatchNFTMinterNudgeDiscount` batch pays out on top
 * of the NFTs.
 *
 * `batchMint` calls `pullPendingStream` over the whole whitelist, then pays the
 * minter's ENTIRE balance of every bonus token (the whitelist minus the
 * discount token) to the recipient. So each leg is `balanceOf(minter)` plus the
 * streamer's `pendingStream(minter, token)`, the same rule `useNudgePot` uses
 * for the multi-token minter. Display only: `mint()` signs floors from a fresh
 * `readBonusAmounts` read, never from these polled figures.
 */
export function useDiscountBonusTokens(
  minter: Address | undefined,
  bonusTokens: readonly Address[] | undefined
): DiscountBonusTokensResult {
  const { isPollingEnabled } = usePolling();
  const { price: phUsdPrice } = useBalancerPrice();
  const { price: kenduPrice } = useKenduPrice();
  const refetchInterval = isPollingEnabled ? BONUS_REFRESH_INTERVAL_MS : false;

  const { data: streamerRaw } = useReadContract({
    address: minter,
    abi: batchNftMinterNudgeDiscountAbi,
    functionName: 'nudgeStreamer',
    query: { enabled: !!minter },
  });
  const streamer =
    streamerRaw && (streamerRaw as Address).toLowerCase() !== zeroAddress
      ? (streamerRaw as Address)
      : undefined;

  const tokenList = useMemo(() => bonusTokens ?? [], [bonusTokens]);
  const readsPerToken = streamer ? 4 : 3;

  const { data: reads } = useReadContracts({
    contracts: tokenList.flatMap((token) => [
      { address: token, abi: erc20Abi, functionName: 'symbol' } as const,
      { address: token, abi: erc20Abi, functionName: 'decimals' } as const,
      { address: token, abi: erc20Abi, functionName: 'balanceOf', args: [minter as Address] } as const,
      ...(streamer
        ? ([
            {
              address: streamer,
              abi: nudgeStreamerAbi,
              functionName: 'pendingStream',
              args: [minter as Address, token],
            },
          ] as const)
        : []),
    ]),
    query: { enabled: !!minter && tokenList.length > 0, refetchInterval },
  });

  return useMemo<DiscountBonusTokensResult>(() => {
    if (!reads || tokenList.length === 0) return { tokens: [], all: [], usdTotal: 0, isPartial: false };

    const all = tokenList.map((address, index): DiscountBonusToken => {
      const base = index * readsPerToken;
      const ok = <T,>(i: number, fallback: T): T =>
        reads[base + i]?.status === 'success' ? (reads[base + i].result as T) : fallback;

      const rawSymbol = ok<string>(0, `${address.slice(0, 6)}…`);
      const decimals = Number(ok<number>(1, 18));
      const totalRaw = ok<bigint>(2, 0n) + (streamer ? ok<bigint>(3, 0n) : 0n);
      const meta = nudgeTokenMeta(rawSymbol);
      const usdPerUnit = nudgeUsdPerUnit(meta, phUsdPrice, kenduPrice);
      return {
        address,
        symbol: meta?.display ?? rawSymbol,
        canonical: canonicalSymbol(rawSymbol),
        decimals,
        totalRaw,
        amountFormatted: formatTokenAmount(totalRaw, decimals),
        usd: usdPerUnit === null ? null : Number(formatUnits(totalRaw, decimals)) * usdPerUnit,
        logo: meta?.logo,
      };
    });

    const tokens = all.filter((token) => token.totalRaw > 0n);
    return {
      tokens,
      all,
      usdTotal: tokens.reduce((sum, token) => sum + (token.usd ?? 0), 0),
      isPartial: tokens.some((token) => token.usd === null),
    };
  }, [reads, tokenList, readsPerToken, streamer, phUsdPrice, kenduPrice]);
}

/**
 * Fresh, block-attested payout of each bonus token, in `bonusTokens` order:
 * `balanceOf(minter) + pendingStream(minter, token)`. `batchMint` flushes the
 * streams and then checks each `bonusMinRewards[j]` against exactly this
 * balance, so these are the floors to sign. Accrual only grows the figure
 * between this read and the transaction; only another batch (or a rescue)
 * can lower it, which is what the floor exists to catch.
 */
export async function readBonusAmounts(
  client: Pick<PublicClient, 'readContract'>,
  minter: Address,
  bonusTokens: readonly Address[],
): Promise<bigint[]> {
  if (bonusTokens.length === 0) return [];
  const streamerRaw = (await client.readContract({
    address: minter,
    abi: batchNftMinterNudgeDiscountAbi,
    functionName: 'nudgeStreamer',
  })) as Address;
  const streamer = streamerRaw.toLowerCase() !== zeroAddress ? streamerRaw : undefined;
  return Promise.all(
    bonusTokens.map(async (token) => {
      const [balance, pending] = await Promise.all([
        client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [minter] }),
        streamer
          ? client.readContract({
              address: streamer,
              abi: nudgeStreamerAbi,
              functionName: 'pendingStream',
              args: [minter, token],
            })
          : Promise.resolve(0n),
      ]);
      return (balance as bigint) + (pending as bigint);
    }),
  );
}

export default useDiscountBonusTokens;
