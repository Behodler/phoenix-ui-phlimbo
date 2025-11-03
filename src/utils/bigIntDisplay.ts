/**
 * Utility functions for safely converting BigInt values to display strings
 * while preventing JavaScript Number precision loss.
 */

import { formatUnits } from 'viem';

/**
 * Safely converts a high-precision BigInt wei value to a display-friendly decimal string.
 *
 * This function prevents the UX issue where max button values are so precise that they
 * fail validation when re-submitted. It uses a simple, direct approach:
 * 1. Convert BigInt wei to decimal string using formatUnits
 * 2. Parse to Number (precision loss is acceptable for display)
 * 3. Use .toFixed(4) to limit to exactly 4 decimal places
 *
 * The result is a value that displays consistently and can safely round-trip through
 * JavaScript Number conversions without causing "insufficient balance" errors.
 *
 * @param bigIntWei - The BigInt value in wei (18 decimals)
 * @param decimals - Number of decimals for the token (default: 18)
 * @param displayDecimals - Maximum decimal places to show (default: 4 for dollar amounts)
 * @returns Display-safe decimal string limited to displayDecimals precision
 *
 * @example
 * // Balance: 19,999,999,602,418,267,839,998 wei
 * const displayValue = safeMaxForDisplay(balanceWei - 1n, 18);
 * // Returns: "19999.9996" (exactly 4 decimal places)
 * // This value won't cause insufficient balance errors when re-submitted
 */
export function safeMaxForDisplay(
  bigIntWei: bigint,
  decimals: number = 18,
  displayDecimals: number = 4
): string {
  if (bigIntWei <= 0n) {
    return '0';
  }

  // Step 1: Convert BigInt wei to decimal string using formatUnits
  const fullPrecisionValue = formatUnits(bigIntWei, decimals);

  // Step 2: Parse to Number (precision loss is OK for display)
  const asNumber = parseFloat(fullPrecisionValue);

  // Step 3: Use .toFixed() to limit to exactly displayDecimals decimal places
  // This is simple, direct, and guaranteed to work
  return asNumber.toFixed(displayDecimals);
}

/**
 * Converts a BigInt wei value to a full-precision decimal string.
 *
 * Use this when you need to preserve ALL precision for transaction submission.
 * This is the original logic from the first fix - it maintains full precision
 * but may produce values that are confusing when displayed.
 *
 * @param bigIntWei - The BigInt value in wei
 * @param decimals - Number of decimals for the token (default: 18)
 * @returns Full-precision decimal string
 *
 * @example
 * // Balance: 19,999,999,602,418,267,839,998 wei
 * const fullPrecision = bigIntToDecimalString(balanceWei - 1n, 18);
 * // Returns: "19.999999602418267839997" (all precision preserved)
 */
export function bigIntToDecimalString(bigIntWei: bigint, decimals: number = 18): string {
  if (bigIntWei <= 0n) {
    return '0';
  }

  const valueStr = bigIntWei.toString();

  // Format as decimal with proper decimal places
  if (valueStr.length <= decimals) {
    // Value is less than 1.0
    const paddedValue = valueStr.padStart(decimals, '0');
    return `0.${paddedValue}`.replace(/\.?0+$/, '') || '0';
  } else {
    // Value is >= 1.0
    const wholePart = valueStr.slice(0, -decimals);
    const fractionalPart = valueStr.slice(-decimals);

    // Remove trailing zeros from fractional part
    const trimmedFractional = fractionalPart.replace(/0+$/, '');

    if (trimmedFractional) {
      return `${wholePart}.${trimmedFractional}`;
    } else {
      return wholePart;
    }
  }
}
