import { describe, it, expect } from 'vitest';
import { parseUnits } from 'viem';
import { geometricSumRaw, parseUsdsInput } from '../batchMintMath';
import { bigIntToDecimalString } from '../bigIntDisplay';

describe('geometricSumRaw', () => {
  it('returns 0 for count <= 0', () => {
    expect(geometricSumRaw(parseUnits('10', 18), 100, 0)).toBe(0n);
    expect(geometricSumRaw(parseUnits('10', 18), 100, -1)).toBe(0n);
  });

  it('returns 0 when priceRaw <= 0', () => {
    expect(geometricSumRaw(0n, 100, 5)).toBe(0n);
    expect(geometricSumRaw(-1n, 100, 5)).toBe(0n);
  });

  it('returns priceRaw exactly for count = 1 (no growth applied)', () => {
    const price = parseUnits('10', 18);
    expect(geometricSumRaw(price, 100, 1)).toBe(price);
    // Even with zero growth.
    expect(geometricSumRaw(price, 0, 1)).toBe(price);
  });

  it('returns priceRaw * count when growthBasisPoints = 0', () => {
    const price = parseUnits('7.5', 18);
    expect(geometricSumRaw(price, 0, 5)).toBe(price * 5n);
    expect(geometricSumRaw(price, 0, 20)).toBe(price * 20n);
  });

  // User's example from the story: price 10 USDS, growth 1%, count 3 → 30.301 USDS.
  // 10 + 10 * 1.01 + 10 * 1.01^2 = 10 + 10.1 + 10.201 = 30.301
  // Both 10.1 and 10.201 are exactly representable at 18 decimals, so no flooring loss.
  it('matches the user example: price=10, growth=1%, count=3 → 30.301 (exact at 18 decimals)', () => {
    const result = geometricSumRaw(parseUnits('10', 18), 100, 3);
    expect(result).toBe(parseUnits('30.301', 18));
  });

  it('count = 20 produces a sum greater than 20 * priceRaw under positive growth', () => {
    const price = parseUnits('10', 18);
    const sum = geometricSumRaw(price, 250, 20); // 2.5%
    // Lower bound: > priceRaw * 20 because every later step is strictly larger.
    expect(sum).toBeGreaterThan(price * 20n);
    // Upper bound: closed-form ceiling 10 * ((1.025^20 - 1) / 0.025) ≈ 255.444
    // Stay safely above the integer-floored truth.
    expect(sum).toBeLessThan(parseUnits('256', 18));
  });

  it('matches a reference loop exactly for arbitrary inputs (integer-division parity)', () => {
    const price = 12_345_678_901_234_567_890n; // ~12.345... with 18 decimals
    const growth = 137; // 1.37%
    const count = 17;

    // Reference loop, identical math, structured slightly differently as a guard.
    let total = 0n;
    let current = price;
    const num = BigInt(10_000 + growth);
    const den = 10_000n;
    for (let i = 0; i < count; i++) {
      total = total + current;
      current = (current * num) / den;
    }

    expect(geometricSumRaw(price, growth, count)).toBe(total);
  });

  it('handles 8-decimal tokens (WBTC-like) without precision drift', () => {
    // Not used by Liquid Sky (USDS, 18-decimal) but proves the helper is decimal-agnostic.
    const price = parseUnits('1', 8); // 1 WBTC-equivalent
    const sum = geometricSumRaw(price, 250, 4); // 2.5%, 4 mints
    // 1 + 1.025 + 1.050625 + 1.076890... at 8 decimals → integer floor at each step.
    expect(sum).toBeGreaterThan(parseUnits('4.15', 8));
    expect(sum).toBeLessThan(parseUnits('4.16', 8));
  });
});

describe('parseUsdsInput', () => {
  it('returns null for empty / whitespace input', () => {
    expect(parseUsdsInput('', 18)).toBeNull();
    expect(parseUsdsInput('   ', 18)).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(parseUsdsInput('abc', 18)).toBeNull();
    expect(parseUsdsInput('1.2.3', 18)).toBeNull();
    expect(parseUsdsInput('1e3', 18)).toBeNull();
    expect(parseUsdsInput('NaN', 18)).toBeNull();
  });

  it('returns null for negative input', () => {
    expect(parseUsdsInput('-1', 18)).toBeNull();
    expect(parseUsdsInput('-0.5', 18)).toBeNull();
    expect(parseUsdsInput('1-2', 18)).toBeNull();
  });

  it('returns null for a lone decimal point', () => {
    expect(parseUsdsInput('.', 18)).toBeNull();
  });

  it('returns null when fractional digits exceed decimals', () => {
    // 19 fractional digits with 18-decimal token.
    expect(parseUsdsInput('1.1234567890123456789', 18)).toBeNull();
    // 9 fractional digits with 8-decimal token.
    expect(parseUsdsInput('1.123456789', 8)).toBeNull();
  });

  it('parses valid integer and decimal inputs', () => {
    expect(parseUsdsInput('0', 18)).toBe(0n);
    expect(parseUsdsInput('10', 18)).toBe(parseUnits('10', 18));
    expect(parseUsdsInput('30.301', 18)).toBe(parseUnits('30.301', 18));
    // Trailing/leading whitespace tolerated.
    expect(parseUsdsInput('  30.301  ', 18)).toBe(parseUnits('30.301', 18));
    // Bare decimal (no integer) tolerated.
    expect(parseUsdsInput('.5', 18)).toBe(parseUnits('0.5', 18));
    // Bare decimal (no fractional) tolerated.
    expect(parseUsdsInput('5.', 18)).toBe(parseUnits('5', 18));
  });

  it('round-trips through bigIntToDecimalString for representative values', () => {
    const cases = ['0.5', '10', '30.301', '12345.6789'];
    for (const c of cases) {
      const raw = parseUsdsInput(c, 18);
      expect(raw).not.toBeNull();
      // bigIntToDecimalString trims trailing zeros — compare numerically.
      const back = bigIntToDecimalString(raw as bigint, 18);
      expect(parseFloat(back)).toBeCloseTo(parseFloat(c), 10);
    }
  });
});
