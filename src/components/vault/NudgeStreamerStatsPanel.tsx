import { formatUnits } from "viem";
import { useNudgePot } from "../../hooks/useNudgePot";

/**
 * `NudgeStreamer.rewardPerSecond` is scaled by the contract's own `PRECISION`
 * (1e18) as a fixed-point multiplier. It is NOT decimal normalization — it
 * cancels out of `rewardPerSecond * elapsed / PRECISION`, leaving the token's
 * native units. Dividing by `10^(18 + decimals)` therefore yields whole tokens
 * per second whatever the token's decimals are.
 */
const STREAM_PRECISION_DECIMALS = 18;

const SECONDS_PER_DAY = 86_400n;

/** Seconds → days, rendered for a settings row (the configured window). */
function formatWindow(seconds: bigint): string {
  if (seconds === 0n) return "—";
  const days = Number(seconds) / Number(SECONDS_PER_DAY);
  return `${days.toLocaleString("en-US", { maximumFractionDigits: 2 })} d`;
}

/**
 * Days of runway actually left, from *now*.
 *
 * The streamer never shrinks `buffer` as time passes — it only debits it in
 * `_settle`, which runs on `collectNudge` / `pullPendingStream` / re-register.
 * Between settlements the accrual lives entirely in the `lastUpdate` timestamp,
 * so a naive `buffer / rewardPerSecond` reports the runway as it stood at the
 * LAST SETTLEMENT and sits pinned at the configured window until someone
 * flushes the leg.
 *
 * `pendingStream` is exactly that unreported elapsed slice — read in the same
 * multicall, so the same block — which makes the undrained remainder
 * `buffer - pending` and the runway `(buffer - pending) / rewardPerSecond`.
 * That subtraction is what turns this back into a countdown, and it stays
 * block-attested: no browser clock is compared against `block.timestamp`.
 *
 * It is still deliberately NOT the configured window — every `collectNudge`
 * re-sizes `rewardPerSecond` from the whole buffer over a fresh window, so a
 * top-up mid-stream stretches the real runway past the setting.
 */
function formatDaysLeft(
  bufferRaw: bigint,
  pendingRaw: bigint,
  rewardPerSecondRaw: bigint,
): string {
  if (rewardPerSecondRaw === 0n) return "—";
  // `pendingStream` is capped at the buffer on-chain, but clamp anyway so a
  // stale pending read can never produce a negative runway.
  const undrainedRaw = pendingRaw >= bufferRaw ? 0n : bufferRaw - pendingRaw;
  if (undrainedRaw === 0n) return "0";
  // undrained / (rewardPerSecond / PRECISION) = undrained * PRECISION / rewardPerSecond.
  const secondsLeft =
    (undrainedRaw * 10n ** BigInt(STREAM_PRECISION_DECIMALS)) /
    rewardPerSecondRaw;
  const days = Number(secondsLeft) / Number(SECONDS_PER_DAY);
  return days.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Whole tokens per second, with enough precision that a slow stream is visible. */
function formatPerSecond(rewardPerSecondRaw: bigint, decimals: number): string {
  if (rewardPerSecondRaw === 0n) return "—";
  const perSecond = Number(
    formatUnits(rewardPerSecondRaw, STREAM_PRECISION_DECIMALS + decimals),
  );
  return perSecond.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

/** Undistributed remainder still held by the streamer, in token units. */
function formatRemaining(bufferRaw: bigint, decimals: number): string {
  const value = Number(formatUnits(bufferRaw, decimals));
  if (value === 0) return "0";
  if (value >= 1) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/**
 * Admin read-only view of the NudgeStreamer's per-token streams into the
 * BatchNFTMinter's whale-discount pot.
 *
 * The token set comes from `BatchNFTMinterMultiToken.getNudgeTokens()` via
 * `useNudgePot`, so it adapts per chain on its own — USDC is simply whichever
 * of these rows the streamer happens to be funding. Nothing here is
 * hard-coded to a token list.
 *
 * Every figure is a block-attested read: this panel does no live
 * extrapolation, unlike the user-facing whale-discount counter.
 */
export default function NudgeStreamerStatsPanel() {
  const {
    tokens,
    streamerAddress,
    minterAddress,
    isLoading,
    isUnavailable,
    refetch,
  } = useNudgePot();

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          NudgeStreamer — Streams
        </h3>
        <span className="text-xs font-mono text-muted-foreground">
          {streamerAddress
            ? `${streamerAddress.slice(0, 6)}…${streamerAddress.slice(-4)}`
            : "—"}
        </span>
      </div>

      {isUnavailable || !minterAddress ? (
        <p className="text-sm text-muted-foreground">
          BatchNFTMinter (multi-token) not deployed on this chain.
        </p>
      ) : !streamerAddress ? (
        <p className="text-sm text-muted-foreground">
          The minter has no NudgeStreamer wired.
        </p>
      ) : isLoading && tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading streams…</p>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The nudge whitelist is empty.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left font-normal pb-2">Token</th>
                  <th className="text-right font-normal pb-2">Window</th>
                  <th className="text-right font-normal pb-2">Days left</th>
                  <th className="text-right font-normal pb-2">Per second</th>
                  <th className="text-right font-normal pb-2">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.address} className="border-t border-border">
                    <td className="py-2 pr-2 text-foreground">
                      {token.symbol}
                      {!token.isStreaming && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          idle
                        </span>
                      )}
                    </td>
                    <td className="py-2 pl-2 text-right font-mono text-foreground">
                      {formatWindow(token.durationSeconds)}
                    </td>
                    <td className="py-2 pl-2 text-right font-mono text-foreground">
                      {formatDaysLeft(
                        token.bufferRaw,
                        token.pendingRaw,
                        token.rewardPerSecondRaw,
                      )}
                    </td>
                    <td className="py-2 pl-2 text-right font-mono text-foreground">
                      {formatPerSecond(
                        token.rewardPerSecondRaw,
                        token.decimals,
                      )}
                    </td>
                    <td className="py-2 pl-2 text-right font-mono text-foreground">
                      {formatRemaining(token.bufferRaw, token.decimals)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 pt-3 border-t border-border">
            <button
              onClick={() => refetch()}
              className="text-xs text-accent hover:text-accent/80 underline"
            >
              Refresh Streams
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
            <strong>Note:</strong> One row per token in{" "}
            <code>getNudgeTokens()</code>, read from{" "}
            <code>NudgeStreamer.streams(minter, token)</code>.{" "}
            <strong>Window</strong> is the configured depletion window (
            <code>duration</code>) the rate was last sized against;{" "}
            <strong>Days left</strong> is the real runway from now,{" "}
            <code>(buffer − pendingStream) ÷ rewardPerSecond</code>. The{" "}
            <code>pendingStream</code> term is load-bearing: the streamer debits{" "}
            <code>buffer</code> only when a leg is settled, so{" "}
            <code>buffer ÷ rewardPerSecond</code> alone sits pinned at the
            window until someone flushes it. It still drifts from the window
            because each <code>collectNudge</code> re-sizes the rate over a
            fresh window and each <code>batchMint</code> pulls the accrued
            stream out early. <strong>Per second</strong> is{" "}
            <code>rewardPerSecond ÷ 1e18</code> in the token&apos;s own units
            (the 1e18 is the streamer&apos;s fixed-point <code>PRECISION</code>,
            not decimals). <strong>Remaining</strong> is the undistributed{" "}
            <code>buffer</code> still held by the streamer — it already includes
            the accrued-but-unsettled slice that <code>pendingStream</code>{" "}
            reports. A row reads{" "}
            <span className="text-muted-foreground">idle</span> when it has no
            rate or an empty buffer.
          </p>
        </>
      )}
    </div>
  );
}
