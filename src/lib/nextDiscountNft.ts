/**
 * Pure maths for the "Next discount NFT" progress strip on the Whale Discount
 * panel (`BatchNFTMinterNudgeDiscount`).
 *
 * Inputs come from two block-attested reads: the minter's `previewBatch()`
 * (`potUSD` 18 dp, `nextStepUSDC` 6 dp) and the NudgeStreamer's
 * `streams(minter, discountToken)` / `pendingStream(...)`. Between reads the
 * stream is extrapolated linearly at `rewardPerSecond`.
 *
 * `potUSD` already includes the streamer's unpulled accrual, so `pendingRaw`
 * is only used to work out how much of the buffer is still undrained.
 */

const WAD = 10n ** 18n;

export interface NextDiscountNftInputs {
  /** `previewBatch().potUSD` (18 dp, net of tin). */
  potUsdRaw: bigint;
  /** `previewBatch().nextStepUSDC` (6 dp): extra USDC for `free` to grow by one. */
  nextStepUsdcRaw: bigint;
  /** Current per-NFT price P0 (18 dp). */
  p0Raw: bigint;
  /** `streams().rewardPerSecond` (USDC 6 dp per second, scaled by 1e18). `undefined` = no stream. */
  rewardPerSecondRaw: bigint | undefined;
  /** `streams().buffer` (USDC 6 dp). */
  bufferRaw: bigint | undefined;
  /** `pendingStream()` (USDC 6 dp): accrued, not yet settled. */
  pendingRaw: bigint | undefined;
  isStreaming: boolean | undefined;
  /** Seconds since `potUsdRaw` / `nextStepUsdcRaw` were read. */
  elapsedSec: number;
}

export interface NextDiscountNft {
  /** 0–100. */
  fillPct: number;
  /** Seconds until the next discount NFT. 0 when the step is due; `null` while paused. */
  secondsLeft: number | null;
  /** The stream cannot cover what remains: the bar holds and the countdown reads "Paused". */
  paused: boolean;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x) || x < 0) return 0;
  return x > 1 ? 1 : x;
}

/**
 * Fill toward, and time until, the next free NFT.
 *
 * - `fill0 = (potUSD mod P0) / P0`, the fill at read time.
 * - `remaining = max(0, nextStepUSDC − rate·elapsed / 1e18)`.
 * - `fill = 1 − (1 − fill0) · remaining / nextStepUSDC`. Scaling the USD-space
 *   fill by the USDC-space remainder makes the PSM `tin` cancel, so it is never read.
 * - `secondsLeft = ceil(remaining · 1e18 / rate)`.
 *
 * Paused (no extrapolation, bar holds at `fill0`) when the stream is missing,
 * not streaming, has a zero rate, or its undrained buffer
 * (`buffer − pending`) is short of `nextStepUSDC`.
 */
export function computeNextDiscountNft(input: NextDiscountNftInputs): NextDiscountNft {
  const { potUsdRaw, nextStepUsdcRaw, p0Raw, rewardPerSecondRaw, bufferRaw, pendingRaw, isStreaming } = input;

  const fill0 = p0Raw > 0n ? clamp01(Number(potUsdRaw % p0Raw) / Number(p0Raw)) : 0;

  const undrained =
    bufferRaw !== undefined ? bufferRaw - (pendingRaw ?? 0n) : undefined;
  const paused =
    rewardPerSecondRaw === undefined ||
    undrained === undefined ||
    !isStreaming ||
    rewardPerSecondRaw <= 0n ||
    undrained < nextStepUsdcRaw;

  if (paused || nextStepUsdcRaw <= 0n) {
    return { fillPct: fill0 * 100, secondsLeft: null, paused: true };
  }

  const elapsedMs = BigInt(Math.max(0, Math.floor(input.elapsedSec * 1000)));
  const accruedRaw = (rewardPerSecondRaw * elapsedMs) / (1000n * WAD);
  const remainingRaw = accruedRaw >= nextStepUsdcRaw ? 0n : nextStepUsdcRaw - accruedRaw;

  const fill = clamp01(1 - (1 - fill0) * (Number(remainingRaw) / Number(nextStepUsdcRaw)));

  const num = remainingRaw * WAD;
  const secondsLeft = Number((num + rewardPerSecondRaw - 1n) / rewardPerSecondRaw);

  return { fillPct: fill * 100, secondsLeft, paused: false };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** `HH:MM:SS`; `Nd HH:MM:SS` at 24 h or more; anything ≤ 0 is `00:00:00`. */
export function formatCountdown(sec: number): string {
  const total = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const days = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hms = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}
