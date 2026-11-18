/**
 * Format a raw token amount to 2 dp, floored, with en-US thousands separators.
 * BigInt maths only: 18-dp amounts exceed 2^53, so never go through `Number`.
 */
export function formatTokenAmount2dp(raw: bigint, decimals: number): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const scale = 10n ** BigInt(decimals);
  const integer = abs / scale;
  const cents = ((abs % scale) * 100n) / scale;
  const intText = integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${intText}.${cents.toString().padStart(2, '0')}`;
}
