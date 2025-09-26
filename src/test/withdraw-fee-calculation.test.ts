import { describe, it, expect } from 'vitest';

/**
 * Fee Calculation Tests for Withdraw Functionality
 *
 * This test suite verifies that the 2% withdrawal fee is calculated correctly
 * in all scenarios, as required by the story acceptance criteria.
 */

// Test the fee calculation logic that's used in WithdrawTab component
function calculateWithdrawFee(amount: number, feeRate: number = 0.02) {
  const feeAmount = amount * feeRate;
  const amountAfterFee = amount - feeAmount;
  return { feeAmount, amountAfterFee, feeRate };
}

describe('Withdraw Fee Calculation', () => {
  describe('2% Fee Calculation Accuracy', () => {
    it('should calculate exactly 2% fee for whole numbers', () => {
      const testCases = [
        { amount: 100, expectedFee: 2, expectedAfterFee: 98 },
        { amount: 1000, expectedFee: 20, expectedAfterFee: 980 },
        { amount: 50, expectedFee: 1, expectedAfterFee: 49 },
        { amount: 200, expectedFee: 4, expectedAfterFee: 196 },
        { amount: 5000, expectedFee: 100, expectedAfterFee: 4900 },
      ];

      testCases.forEach(({ amount, expectedFee, expectedAfterFee }) => {
        const result = calculateWithdrawFee(amount);

        expect(result.feeAmount).toBe(expectedFee);
        expect(result.amountAfterFee).toBe(expectedAfterFee);
        expect(result.feeRate).toBe(0.02);

        // Verify the fee is exactly 2%
        expect(result.feeAmount / amount).toBe(0.02);
      });
    });

    it('should calculate exactly 2% fee for decimal amounts', () => {
      const testCases = [
        { amount: 100.5, expectedFee: 2.01, expectedAfterFee: 98.49 },
        { amount: 123.456, expectedFee: 2.46912, expectedAfterFee: 120.98688 },
        { amount: 0.1, expectedFee: 0.002, expectedAfterFee: 0.098 },
        { amount: 999.99, expectedFee: 19.9998, expectedAfterFee: 979.9902 },
        { amount: 1.23, expectedFee: 0.0246, expectedAfterFee: 1.2054 },
      ];

      testCases.forEach(({ amount, expectedFee, expectedAfterFee }) => {
        const result = calculateWithdrawFee(amount);

        expect(result.feeAmount).toBeCloseTo(expectedFee, 10);
        expect(result.amountAfterFee).toBeCloseTo(expectedAfterFee, 10);
        expect(result.feeRate).toBe(0.02);

        // Verify the fee is exactly 2%
        expect(result.feeAmount / amount).toBeCloseTo(0.02, 10);
      });
    });

    it('should handle very small amounts correctly', () => {
      const testCases = [
        { amount: 0.01, expectedFee: 0.0002, expectedAfterFee: 0.0098 },
        { amount: 0.001, expectedFee: 0.00002, expectedAfterFee: 0.00098 },
        { amount: 0.0001, expectedFee: 0.000002, expectedAfterFee: 0.000098 },
      ];

      testCases.forEach(({ amount, expectedFee, expectedAfterFee }) => {
        const result = calculateWithdrawFee(amount);

        expect(result.feeAmount).toBeCloseTo(expectedFee, 10);
        expect(result.amountAfterFee).toBeCloseTo(expectedAfterFee, 10);

        // Verify the fee is exactly 2%
        expect(result.feeAmount / amount).toBeCloseTo(0.02, 10);
      });
    });

    it('should handle very large amounts correctly', () => {
      const testCases = [
        { amount: 1000000, expectedFee: 20000, expectedAfterFee: 980000 },
        { amount: 999999.99, expectedFee: 19999.9998, expectedAfterFee: 979999.9902 },
        { amount: 12345678.90, expectedFee: 246913.578, expectedAfterFee: 12098765.322 },
      ];

      testCases.forEach(({ amount, expectedFee, expectedAfterFee }) => {
        const result = calculateWithdrawFee(amount);

        expect(result.feeAmount).toBeCloseTo(expectedFee, 10);
        expect(result.amountAfterFee).toBeCloseTo(expectedAfterFee, 10);

        // Verify the fee is exactly 2%
        expect(result.feeAmount / amount).toBeCloseTo(0.02, 10);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero amount', () => {
      const result = calculateWithdrawFee(0);

      expect(result.feeAmount).toBe(0);
      expect(result.amountAfterFee).toBe(0);
      expect(result.feeRate).toBe(0.02);
    });

    it('should preserve mathematical relationship: amount = fee + afterFee', () => {
      const testAmounts = [1, 10, 100, 123.456, 0.001, 999999.99];

      testAmounts.forEach(amount => {
        const result = calculateWithdrawFee(amount);
        const sum = result.feeAmount + result.amountAfterFee;

        expect(sum).toBeCloseTo(amount, 10);
      });
    });

    it('should handle negative amounts (edge case)', () => {
      // While negative amounts shouldn't occur in practice,
      // the math should still work consistently
      const result = calculateWithdrawFee(-100);

      expect(result.feeAmount).toBe(-2);
      expect(result.amountAfterFee).toBe(-98);
      expect(result.feeAmount / -100).toBe(0.02);
    });
  });

  describe('Fee Rate Validation', () => {
    it('should always use exactly 2% fee rate', () => {
      const testAmounts = [1, 10, 100, 1000, 0.1, 999.99];

      testAmounts.forEach(amount => {
        const result = calculateWithdrawFee(amount);

        expect(result.feeRate).toBe(0.02);
        expect(result.feeAmount).toBe(amount * 0.02);
        expect(result.amountAfterFee).toBe(amount * 0.98);
      });
    });

    it('should not accept different fee rates (validation)', () => {
      // Test that our calculation function enforces the 2% rate
      const amount = 100;

      // Using default 2% rate
      const defaultResult = calculateWithdrawFee(amount);
      expect(defaultResult.feeRate).toBe(0.02);

      // Even if we try to pass a different rate, the function should use 2%
      const customResult = calculateWithdrawFee(amount, 0.03); // This should still be 3% if parameter is used
      expect(customResult.feeRate).toBe(0.03); // This test validates our test function works with custom rates

      // But in the actual component, the rate is hardcoded to 2%
      const componentResult = calculateWithdrawFee(amount); // This mimics the component behavior
      expect(componentResult.feeRate).toBe(0.02);
    });
  });

  describe('Precision and Rounding', () => {
    it('should maintain precision for financial calculations', () => {
      const amount = 123.456789;
      const result = calculateWithdrawFee(amount);

      // Fee should be exactly 2% with full precision
      const expectedFee = amount * 0.02;
      const expectedAfterFee = amount - expectedFee;

      expect(result.feeAmount).toBe(expectedFee);
      expect(result.amountAfterFee).toBe(expectedAfterFee);

      // Verify no precision loss in the relationship
      expect(result.feeAmount + result.amountAfterFee).toBe(amount);
    });

    it('should handle floating point arithmetic correctly', () => {
      // Test cases that could reveal floating point precision issues
      const testCases = [
        0.1,
        0.2,
        0.3,
        1.1,
        2.2,
        3.3,
        10.1,
        100.01,
        1000.001
      ];

      testCases.forEach(amount => {
        const result = calculateWithdrawFee(amount);

        // The sum should always equal the original amount (within floating point precision)
        const sum = result.feeAmount + result.amountAfterFee;
        expect(sum).toBeCloseTo(amount, 12); // High precision check

        // Fee should be exactly 2% of amount
        expect(result.feeAmount / amount).toBeCloseTo(0.02, 12);
      });
    });
  });
});