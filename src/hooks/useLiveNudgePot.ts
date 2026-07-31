import { useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import type { NudgePotToken } from './useNudgePot';

/**
 * The streamer scales `rewardPerSecond` by 1e18 as an internal fixed-point
 * multiplier (NudgeStreamer.PRECISION). It is NOT decimal normalization — it
 * cancels out of `rewardPerSecond * elapsed / PRECISION`, so the result is in
 * the token's own native units whatever its decimals.
 */
const STREAM_PRECISION = 10n ** 18n;

/**
 * Default repaint cadence: 0.5 Hz. The figures step every two seconds rather
 * than animating — a deliberate trade of smoothness for a near-idle panel. The
 * counter still tracks the stream exactly, since each tick recomputes from
 * elapsed time rather than accumulating per-frame increments, so the cadence
 * only sets how often the number repaints, never what it lands on.
 */
const DEFAULT_TICK_MS = 2_000;

export interface UseLiveNudgePotOptions {
  /** Override the repaint cadence in ms. Defaults to 2000 (0.5 Hz). */
  tickMs?: number;
}

export interface LiveNudgeToken extends NudgePotToken {
  /** `totalRaw` carried forward to now: balance + the stream accrued since the read. */
  liveTotalRaw: bigint;
  /** The accrued-but-unsettled portion of `liveTotalRaw`. */
  livePendingRaw: bigint;
  /** `liveTotalRaw` rendered — extra precision while a stream is actually moving it. */
  liveAmountFormatted: string;
  /** USD value of `liveTotalRaw`, or `null` when the token is unpriced. */
  liveUsd: number | null;
}

export interface UseLiveNudgePotResult {
  tokens: LiveNudgeToken[];
  /** Live aggregate of the priced legs. */
  potUsd: number;
  /** True while at least one leg is still streaming — i.e. the figures are moving. */
  isStreaming: boolean;
}

/**
 * Streaming legs need visible decimals or the "live" figure just sits there;
 * settled legs keep the tidier snapshot formatting.
 */
function formatLiveAmount(
  raw: bigint,
  decimals: number,
  streaming: boolean
): string {
  const value = Number(formatUnits(raw, decimals));
  if (streaming) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  }
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
 * Carries a nudge pot forward between polls.
 *
 * `useNudgePot` gives the pot as of a block; the NudgeStreamer keeps metering
 * into it every second in between. This hook extrapolates that accrual so the
 * banner counts up the way the stable-staker surfaces do, rather than jumping
 * once per refetch.
 *
 * Two deliberate choices about *what* is extrapolated:
 *
 *  - **Anchored to `readAtMs`, not to the stream's `lastUpdate`.** We add
 *    `rewardPerSecond × (now − readAtMs)` to the pending figure the chain
 *    returned. Only elapsed differences are used, so a browser clock offset
 *    from the chain's cannot skew the result; anchoring to `lastUpdate` would
 *    bake that offset straight into the number.
 *  - **Capped at the buffer.** `_accrued` is `min(rate × elapsed, buffer)`, so
 *    once a stream has paid out its buffer the counter must stop rather than
 *    invent tokens that are not there.
 *
 * This is presentation only. The value that goes on-chain as `minRewards` stays
 * `totalRaw` — the figure a block actually attested to.
 */
export function useLiveNudgePot(
  tokens: NudgePotToken[],
  readAtMs: number,
  { tickMs = DEFAULT_TICK_MS }: UseLiveNudgePotOptions = {}
): UseLiveNudgePotResult {
  const anyStreaming = tokens.some((token) => token.isStreaming);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Reset the clock on every fresh read so the first frame after a refetch
  // shows the chain's own figure rather than a stale extrapolation.
  useEffect(() => {
    setNowMs(Date.now());
  }, [readAtMs]);

  useEffect(() => {
    if (!anyStreaming) return;
    const id = setInterval(() => setNowMs(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [anyStreaming, readAtMs, tickMs]);

  return useMemo(() => {
    // Guard against a clock that jumped backwards: never un-accrue.
    const elapsedMs = Math.max(0, nowMs - readAtMs);

    const liveTokens = tokens.map((token): LiveNudgeToken => {
      let livePendingRaw = token.pendingRaw;

      if (token.isStreaming) {
        const accruedSinceRead =
          (token.rewardPerSecondRaw * BigInt(Math.floor(elapsedMs))) /
          (1000n * STREAM_PRECISION);
        livePendingRaw += accruedSinceRead;
        // `buffer` is the whole undistributed remainder and `pending` is the
        // settled-but-untransferred slice of it, so the buffer is the ceiling.
        if (livePendingRaw > token.bufferRaw) {
          livePendingRaw = token.bufferRaw;
        }
      }

      const liveTotalRaw = token.balanceRaw + livePendingRaw;
      const amount = Number(formatUnits(liveTotalRaw, token.decimals));

      return {
        ...token,
        livePendingRaw,
        liveTotalRaw,
        liveAmountFormatted: formatLiveAmount(
          liveTotalRaw,
          token.decimals,
          token.isStreaming
        ),
        liveUsd:
          token.usdPerUnit === null ? null : amount * token.usdPerUnit,
      };
    });

    return {
      tokens: liveTokens,
      potUsd: liveTokens.reduce((sum, token) => sum + (token.liveUsd ?? 0), 0),
      isStreaming: anyStreaming,
    };
  }, [tokens, readAtMs, nowMs, anyStreaming]);
}

export default useLiveNudgePot;
