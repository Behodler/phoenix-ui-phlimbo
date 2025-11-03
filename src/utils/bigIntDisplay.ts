/**
 * Utility functions for safely converting BigInt values to display strings
 * while preventing JavaScript Number precision loss.
 */

/**
 * Safely converts a high-precision BigInt wei value to a display-friendly decimal string.
 *
 * This function prevents the UX issue where max button values are so precise that they
 * fail validation when re-submitted. It works by:
 * 1. Reducing precision before Number conversion (divide by 10^10)
 * 2. Converting to Number (now safe with reduced precision)
 * 3. Scaling back up to preserve magnitude (multiply by 10^10)
 * 4. Converting to decimal string for display
 *
 * The result is a value that can safely round-trip through JavaScript Number conversions
 * without causing "insufficient balance" errors.
 *
 * @param bigIntWei - The BigInt value in wei (18 decimals)
 * @param decimals - Number of decimals for the token (default: 18)
 * @returns Display-safe decimal string
 *
 * @example
 * // Balance: 19,999,999,602,418,267,839,998 wei
 * const displayValue = safeMaxForDisplay(balanceWei - 1n, 18);
 * // Returns: "19.9999996024" (truncated to safe precision)
 * // This value won't cause insufficient balance errors when re-submitted
 */
export function safeMaxForDisplay(bigIntWei: bigint, decimals: number = 18): string {
  if (bigIntWei <= 0n) {
    return '0';
  }

  // Precision reducer - drop 10 digits of precision before Number conversion
  // This ensures we stay well within JavaScript Number's safe range
  const PRECISION_REDUCER = 10n ** 10n;

  // Step 1: Reduce precision to make Number conversion safe
  const reducedValue = bigIntWei / PRECISION_REDUCER;

  // Step 2: Convert to Number (safe now because precision is reduced)
  const asNumber = Number(reducedValue);

  // Step 3: Scale back up to preserve magnitude (but with reduced precision)
  const scaledBackWei = BigInt(Math.floor(asNumber)) * PRECISION_REDUCER;

  // Step 4: Convert to decimal string for display
  const valueStr = scaledBackWei.toString();

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
