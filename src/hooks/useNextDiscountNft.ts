import { useEffect, useState } from 'react';
import type { Address } from 'viem';
import { useNudgeStreams } from './useNudgeStreams';
import type { DiscountFund } from './useDiscountBatchMinter';
import { computeNextDiscountNft } from '../lib/nextDiscountNft';

/** Countdown tick. */
const CLOCK_TICK_MS = 1000;

export interface UseNextDiscountNftArgs {
  /** The panel's own visibility rule (loaded, below the cap). The fund checks are added here. */
  enabled: boolean;
  fund: DiscountFund | undefined;
  /** `dataUpdatedAt` of the read that produced `fund`. */
  fundReadAtMs: number;
  /** Current per-NFT price P0 (18 dp). */
  p0Raw: bigint | undefined;
  /** The minter's `discountToken()`: selects the stream leg (by address, never by symbol). */
  discountToken: Address | undefined;
}

export interface NextDiscountNftView {
  visible: boolean;
  /** 0–100. */
  fillPct: number;
  /** `null` while paused. */
  secondsLeft: number | null;
  paused: boolean;
}

const HIDDEN: NextDiscountNftView = { visible: false, fillPct: 0, secondsLeft: null, paused: false };

/**
 * Live "next discount NFT" progress for the Whale Discount panel.
 *
 * Combines the minter's block-attested fund (`potUSD`, `nextStepUSDC`, read at
 * `fundReadAtMs`) with the NudgeStreamer leg for the minter's discount token,
 * and extrapolates the stream between reads on a 1 s clock. The clock runs
 * only while the strip is visible and not paused, and every new minter read
 * re-anchors it. Display only: nothing here feeds a transaction.
 */
export function useNextDiscountNft({
  enabled,
  fund,
  fundReadAtMs,
  p0Raw,
  discountToken,
}: UseNextDiscountNftArgs): NextDiscountNftView {
  const { streams } = useNudgeStreams();

  const visible =
    enabled && !!fund && fund.nextStepUsdcRaw > 0n && p0Raw !== undefined && p0Raw > 0n;

  const leg = discountToken
    ? streams.find((s) => s.address.toLowerCase() === discountToken.toLowerCase())
    : undefined;

  const [nowMs, setNowMs] = useState(Date.now);

  const result =
    visible && fund && p0Raw !== undefined
      ? computeNextDiscountNft({
          potUsdRaw: fund.potUsdRaw,
          nextStepUsdcRaw: fund.nextStepUsdcRaw,
          p0Raw,
          rewardPerSecondRaw: leg?.rewardPerSecondRaw,
          bufferRaw: leg?.bufferRaw,
          pendingRaw: leg?.pendingRaw,
          isStreaming: leg?.isStreaming,
          // A new read re-anchors: elapsed restarts from 0 and never goes negative.
          elapsedSec: Math.max(0, nowMs - fundReadAtMs) / 1000,
        })
      : undefined;

  const ticking = !!result && !result.paused;

  useEffect(() => {
    if (!ticking) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [ticking, fundReadAtMs]);

  if (!result) return HIDDEN;
  return { visible: true, ...result };
}
