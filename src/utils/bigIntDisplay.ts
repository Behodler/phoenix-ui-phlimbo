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
 * 5. Limiting to 4 decimal places for consistency with dollar amounts
 *
 * The result is a value that can safely round-trip through JavaScript Number conversions
 * without causing "insufficient balance" errors, and displays with consistent precision.
 *
 * @param bigIntWei - The BigInt value in wei (18 decimals)
 * @param decimals - Number of decimals for the token (default: 18)
 * @param displayDecimals - Maximum decimal places to show (default: 4 for dollar amounts)
 * @returns Display-safe decimal string limited to displayDecimals precision
 *
 * @example
 * // Balance: 19,999,999,602,418,267,839,998 wei
 * const displayValue = safeMaxForDisplay(balanceWei - 1n, 18);
 * // Returns: "19999.9996" (truncated to 4 decimal places)
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
  let formattedValue: string;
  if (valueStr.length <= decimals) {
    // Value is less than 1.0
    const paddedValue = valueStr.padStart(decimals, '0');
    formattedValue = `0.${paddedValue}`.replace(/\.?0+$/, '') || '0';
  } else {
    // Value is >= 1.0
    const wholePart = valueStr.slice(0, -decimals);
    const fractionalPart = valueStr.slice(-decimals);

    // Remove trailing zeros from fractional part
    const trimmedFractional = fractionalPart.replace(/0+$/, '');

    if (trimmedFractional) {
      formattedValue = `${wholePart}.${trimmedFractional}`;
    } else {
      formattedValue = wholePart;
    }
  }

  // Step 5: Limit to displayDecimals (4 for dollar amounts)
  // This ensures consistency with validation error messages
  const parts = formattedValue.split('.');
  if (parts.length === 2 && parts[1].length > displayDecimals) {
    // Truncate to displayDecimals (no rounding to avoid going over limit)
    return `${parts[0]}.${parts[1].substring(0, displayDecimals)}`;
  }

  return formattedValue;
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
