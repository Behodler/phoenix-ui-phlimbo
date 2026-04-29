/**
 * Math helpers for the batch-mint flow.
 *
 * `geometricSumRaw` mirrors the on-chain integer-division loop in
 * `NFTMinterV2._executeMint` (`price = price * (10_000 + growthBasisPoints) / 10_000`)
 * so the off-chain computed sum equals exactly what `BatchNFTMinter.batchMint`
 * will pull on-chain. Avoids any sub-wei underpayment that would revert the batch.
 *
 * `parseUsdsInput` parses a user-typed decimal string (e.g. "30.301") to a bigint
 * with the supplied decimals. Returns `null` for any invalid input (non-numeric,
 * negative, NaN, multiple decimal points). Tolerates leading/trailing whitespace.
 */

import { parseUnits } from 'viem';

/**
 * Compute the geometric sum of mint prices for `count` consecutive mints,
 * starting from `priceRaw` and growing by `growthBasisPoints` per mint.
 *
 * Mirrors Solidity integer division exactly:
 *   price_{i+1} = price_i * (10_000 + growthBasisPoints) / 10_000
 *
 * @param priceRaw            Current dispatcher price (raw bigint, e.g. 18-decimal wei).
 * @param growthBasisPoints   Per-mint growth in basis points (e.g. `100` = 1%).
 * @param count               Number of mints (>= 1). Counts <= 0 return 0n.
 * @returns                   Sum of `count` consecutive mint prices.
 */
export function geometricSumRaw(
  priceRaw: bigint,
  growthBasisPoints: number,
  count: number,
): bigint {
  if (count <= 0) return 0n;
  if (priceRaw <= 0n) return 0n;
  const num = BigInt(10_000 + growthBasisPoints);
  const den = 10_000n;
  let total = 0n;
  let current = priceRaw;
  for (let i = 0; i < count; i++) {
    total += current;
    current = (current * num) / den; // integer division — matches Solidity
  }
  return total;
}

/**
 * Parse a user-typed decimal string into a bigint with `decimals` precision.
 *
 * Returns `null` for invalid input so callers can keep the previous valid
 * `manualAmountRaw` and visually flag the textbox.
 *
 * Rules:
 *   - Trims surrounding whitespace.
 *   - Empty string → null.
 *   - Negative sign (anywhere) → null.
 *   - Anything that isn't `\d*(\.\d*)?` → null.
 *   - More than `decimals` fractional digits → null (would lose precision).
 *   - Falls back to `viem.parseUnits` for the actual conversion.
 */
export function parseUsdsInput(input: string, decimals: number): bigint | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes('-')) return null;
  if (!/^\d*(\.\d*)?$/.test(trimmed)) return null;

  // Disallow lone "." or ".x" with no integer part beyond bare "."
  if (trimmed === '.') return null;

  // Disallow more fractional digits than decimals (parseUnits would throw).
  const dotIdx = trimmed.indexOf('.');
  if (dotIdx >= 0) {
    const fractional = trimmed.slice(dotIdx + 1);
    if (fractional.length > decimals) return null;
  }

  try {
    return parseUnits(trimmed as `${number}`, decimals);
  } catch {
    return null;
  }
}
