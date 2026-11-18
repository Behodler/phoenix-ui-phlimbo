import { useMemo } from 'react';
import { erc20Abi, zeroAddress } from 'viem';
import type { Address } from 'viem';
import { useReadContract, useReadContracts } from 'wagmi';
import { batchNftMinterNudgeDiscountAbi, nudgeStreamerAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { nudgeTokenMeta } from '../data/nudgeTokenMeta';

export interface NudgeStream {
  address: Address;
  symbol: string;
  decimals: number;
  /** `pendingStream(minter, token)`: accrued but not yet settled into the minter. */
  pendingRaw: bigint;
  /** `streams(minter, token)` = (duration, buffer, rewardPerSecond, lastUpdate). */
  durationSeconds: bigint;
  bufferRaw: bigint;
  rewardPerSecondRaw: bigint;
  /** A drained buffer still reads a non-zero rate, so the buffer is what says "still paying". */
  isStreaming: boolean;
}

export interface UseNudgeStreamsResult {
  streams: NudgeStream[];
  /** `NudgeDiscountBatchMinter`, or undefined when it is the zero address on this chain. */
  minterAddress: Address | undefined;
  /** The streamer as the minter reports it, or undefined when none is wired. */
  streamerAddress: Address | undefined;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Per-token NudgeStreamer streams into `BatchNFTMinterNudgeDiscount`, the live
 * whale-discount minter. The token set is the minter's own `getNudgeTokens()`
 * whitelist (bonus tokens plus the discount token), never a UI list.
 *
 * Every figure is block-attested; this hook does no extrapolation.
 */
export function useNudgeStreams(): UseNudgeStreamsResult {
  const { addresses } = useContractAddresses();
  const rawMinter = addresses?.NudgeDiscountBatchMinter as Address | undefined;
  const minterAddress =
    rawMinter && rawMinter.toLowerCase() !== zeroAddress ? rawMinter : undefined;

  const {
    data: whitelistRaw,
    isLoading: isLoadingWhitelist,
    refetch: refetchWhitelist,
  } = useReadContract({
    address: minterAddress,
    abi: batchNftMinterNudgeDiscountAbi,
    functionName: 'getNudgeTokens',
    query: { enabled: !!minterAddress },
  });

  const { data: streamerRaw, isLoading: isLoadingStreamer } = useReadContract({
    address: minterAddress,
    abi: batchNftMinterNudgeDiscountAbi,
    functionName: 'nudgeStreamer',
    query: { enabled: !!minterAddress },
  });

  const streamerAddress =
    streamerRaw && (streamerRaw as Address).toLowerCase() !== zeroAddress
      ? (streamerRaw as Address)
      : undefined;

  const tokens = useMemo(
    () => (whitelistRaw as readonly Address[] | undefined) ?? [],
    [whitelistRaw]
  );

  const {
    data: reads,
    isLoading: isLoadingReads,
    refetch: refetchReads,
  } = useReadContracts({
    contracts: tokens.flatMap((token) => [
      { address: token, abi: erc20Abi, functionName: 'symbol' } as const,
      { address: token, abi: erc20Abi, functionName: 'decimals' } as const,
      {
        address: streamerAddress as Address,
        abi: nudgeStreamerAbi,
        functionName: 'pendingStream',
        args: [minterAddress as Address, token],
      } as const,
      {
        address: streamerAddress as Address,
        abi: nudgeStreamerAbi,
        functionName: 'streams',
        args: [minterAddress as Address, token],
      } as const,
    ]),
    query: {
      enabled: !!minterAddress && !!streamerAddress && tokens.length > 0,
      refetchInterval: 30_000,
    },
  });

  const streams = useMemo<NudgeStream[]>(() => {
    if (!reads || tokens.length === 0) return [];
    return tokens.map((address, index) => {
      const base = index * 4;
      const ok = <T,>(i: number, fallback: T): T =>
        reads[base + i]?.status === 'success' ? (reads[base + i].result as T) : fallback;

      const rawSymbol = ok<string>(0, `${address.slice(0, 6)}…`);
      const stream = ok<readonly [bigint, bigint, bigint, bigint] | undefined>(3, undefined);
      const bufferRaw = stream?.[1] ?? 0n;
      const rewardPerSecondRaw = stream?.[2] ?? 0n;
      return {
        address,
        symbol: nudgeTokenMeta(rawSymbol)?.display ?? rawSymbol,
        decimals: Number(ok<number>(1, 18)),
        pendingRaw: ok<bigint>(2, 0n),
        durationSeconds: stream?.[0] ?? 0n,
        bufferRaw,
        rewardPerSecondRaw,
        isStreaming: rewardPerSecondRaw > 0n && bufferRaw > 0n,
      };
    });
  }, [reads, tokens]);

  return {
    streams,
    minterAddress,
    streamerAddress,
    isLoading: isLoadingWhitelist || isLoadingStreamer || isLoadingReads,
    refetch: () => {
      refetchWhitelist();
      refetchReads();
    },
  };
}
