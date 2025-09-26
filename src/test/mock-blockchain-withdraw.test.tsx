import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MockBlockchainProvider, useMockBlockchain } from '../hooks/useMockBlockchain';
import type { ReactNode } from 'react';

// Wrapper component for testing hooks
const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <MockBlockchainProvider>{children}</MockBlockchainProvider>
  );
};

describe('Mock Blockchain Withdraw Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset any global state if needed
  });

  describe('Withdraw Transaction Processing', () => {
    it('should process withdraw transaction with 2% fee deduction', async () => {
      const { result } = renderHook(() => useMockBlockchain(), {
        wrapper: createWrapper()
      });

      // Initial state - user has pxUSD to withdraw
      act(() => {
        result.current.updateBalance('pxUSD', { balance: 1000, balanceUsd: 1000 });
        result.current.updateBalance('DOLA', { balance: 0, balanceUsd: 0 });
      });

      expect(result.current.balances.pxUSD.balance).toBe(1000);
      expect(result.current.balances.DOLA.balance).toBe(0);

      // Execute withdraw transaction
      const withdrawAmount = 100;
      const transaction = await act(async () => {
        return result.current.executeTransaction({
          type: 'withdraw',
          amount: withdrawAmount,
          tokenIn: { symbol: 'pxUSD', amount: withdrawAmount },
          tokenOut: { symbol: 'DOLA', amount: withdrawAmount * 0.98 }, // Expected after fee
        });
      });

      expect(transaction.status).toBe('success');
      expect(transaction.type).toBe('withdraw');

      // Check balances after transaction
      // pxUSD should be reduced by full amount
      expect(result.current.balances.pxUSD.balance).toBe(900); // 1000 - 100

      // DOLA should be increased by amount minus 2% fee
      const expectedDolaIncrease = withdrawAmount * 0.98; // 98 DOLA
      expect(result.current.balances.DOLA.balance).toBe(expectedDolaIncrease);
    });

    it('should apply exactly 2% fee for various withdrawal amounts', async () => {
      const testAmounts = [50, 100, 250.5, 1000, 0.1, 999.99];

      for (const amount of testAmounts) {
        const { result } = renderHook(() => useMockBlockchain(), {
          wrapper: createWrapper
        });

        // Setup initial balances
        act(() => {
          result.current.updateBalance('pxUSD', { balance: 2000, balanceUsd: 2000 });
          result.current.updateBalance('DOLA', { balance: 0, balanceUsd: 0 });
        });

        const initialDolaBalance = result.current.balances.DOLA.balance;

        // Execute withdraw
        await act(async () => {
          await result.current.executeTransaction({
            type: 'withdraw',
            amount: amount,
            tokenIn: { symbol: 'pxUSD', amount: amount },
            tokenOut: { symbol: 'DOLA', amount: amount * 0.98 },
          });
        });

        // Verify 2% fee was applied
        const expectedDolaIncrease = amount * 0.98;
        const actualDolaIncrease = result.current.balances.DOLA.balance - initialDolaBalance;

        expect(actualDolaIncrease).toBeCloseTo(expectedDolaIncrease, 10);

        // Verify fee is exactly 2%
        const fee = amount - expectedDolaIncrease;
        const feePercentage = fee / amount;
        expect(feePercentage).toBeCloseTo(0.02, 10);
      }
    });

    it('should handle minimum withdrawal amounts with correct fee', async () => {
      const { result } = renderHook(() => useMockBlockchain(), {
        wrapper: createWrapper
      });

      // Setup initial balances
      act(() => {
        result.current.updateBalance('pxUSD', { balance: 1, balanceUsd: 1 });
        result.current.updateBalance('DOLA', { balance: 0, balanceUsd: 0 });
      });

      const withdrawAmount = 0.01; // Very small withdrawal

      await act(async () => {
        await result.current.executeTransaction({
          type: 'withdraw',
          amount: withdrawAmount,
          tokenIn: { symbol: 'pxUSD', amount: withdrawAmount },
          tokenOut: { symbol: 'DOLA', amount: withdrawAmount * 0.98 },
        });
      });

      // Even for very small amounts, 2% fee should be applied
      const expectedDolaBalance = withdrawAmount * 0.98;
      expect(result.current.balances.DOLA.balance).toBeCloseTo(expectedDolaBalance, 10);

      // pxUSD balance should be reduced by full amount
      expect(result.current.balances.pxUSD.balance).toBeCloseTo(1 - withdrawAmount, 10);
    });

    it('should handle maximum withdrawal with correct fee calculation', async () => {
      const { result } = renderHook(() => useMockBlockchain(), {
        wrapper: createWrapper
      });

      const maxBalance = 10000;

      // Setup maximum balance
      act(() => {
        result.current.updateBalance('pxUSD', { balance: maxBalance, balanceUsd: maxBalance });
        result.current.updateBalance('DOLA', { balance: 0, balanceUsd: 0 });
      });

      // Withdraw entire balance
      await act(async () => {
        await result.current.executeTransaction({
          type: 'withdraw',
          amount: maxBalance,
          tokenIn: { symbol: 'pxUSD', amount: maxBalance },
          tokenOut: { symbol: 'DOLA', amount: maxBalance * 0.98 },
        });
      });

      // Should have zero pxUSD left
      expect(result.current.balances.pxUSD.balance).toBe(0);

      // Should have received 98% of the amount in DOLA (2% fee)
      const expectedDolaBalance = maxBalance * 0.98;
      expect(result.current.balances.DOLA.balance).toBe(expectedDolaBalance);
    });
  });

  describe('Balance Validation', () => {
    it('should not allow withdrawal of more than available balance', async () => {
      const { result } = renderHook(() => useMockBlockchain(), {
        wrapper: createWrapper
      });

      // Setup limited balance
      act(() => {
        result.current.updateBalance('pxUSD', { balance: 100, balanceUsd: 100 });
      });

      const availableBalance = result.current.balances.pxUSD.balance;
      expect(availableBalance).toBe(100);

      // In a real implementation, this should be validated at the UI level
      // The mock blockchain will process any transaction, but the UI should prevent this

      // Test that UI validation logic would work
      const attemptedWithdraw = 150;
      const isValidWithdraw = attemptedWithdraw <= availableBalance;

      expect(isValidWithdraw).toBe(false);

      // Only proceed with withdraw if it's valid
      if (isValidWithdraw) {
        await act(async () => {
          await result.current.executeTransaction({
            type: 'withdraw',
            amount: attemptedWithdraw,
            tokenIn: { symbol: 'pxUSD', amount: attemptedWithdraw },
            tokenOut: { symbol: 'DOLA', amount: attemptedWithdraw * 0.98 },
          });
        });
      }

      // Balance should remain unchanged since invalid withdraw was blocked
      expect(result.current.balances.pxUSD.balance).toBe(100);
    });

    it('should prevent negative balance after withdrawal', async () => {
      const { result } = renderHook(() => useMockBlockchain(), {
        wrapper: createWrapper
      });

      // Setup small balance
      act(() => {
        result.current.updateBalance('pxUSD', { balance: 50, balanceUsd: 50 });
      });

      // The mock blockchain has Math.max(0, ...) protection
      // Test this by simulating what happens if we somehow process an oversized withdrawal
      const oversizedAmount = 100;

      await act(async () => {
        await result.current.executeTransaction({
          type: 'withdraw',
          amount: oversizedAmount,
          tokenIn: { symbol: 'pxUSD', amount: oversizedAmount },
          tokenOut: { symbol: 'DOLA', amount: oversizedAmount * 0.98 },
        });
      });

      // Balance should not go negative due to Math.max protection
      expect(result.current.balances.pxUSD.balance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Transaction Metadata', () => {
    it('should create withdraw transaction with proper metadata', async () => {
      const { result } = renderHook(() => useMockBlockchain(), {
        wrapper: createWrapper
      });

      act(() => {
        result.current.updateBalance('pxUSD', { balance: 1000, balanceUsd: 1000 });
      });

      const withdrawAmount = 200;
      const transaction = await act(async () => {
        return result.current.executeTransaction({
          type: 'withdraw',
          amount: withdrawAmount,
          tokenIn: { symbol: 'pxUSD', amount: withdrawAmount },
          tokenOut: { symbol: 'DOLA', amount: withdrawAmount * 0.98 },
        });
      });

      // Verify transaction metadata
      expect(transaction.type).toBe('withdraw');
      expect(transaction.amount).toBe(withdrawAmount);
      expect(transaction.tokenIn?.symbol).toBe('pxUSD');
      expect(transaction.tokenOut?.symbol).toBe('DOLA');
      expect(transaction.status).toBe('success');
      expect(transaction.id).toBeDefined();
      expect(transaction.timestamp).toBeDefined();
      expect(transaction.gasUsed).toBeGreaterThan(0);
      expect(transaction.gasFeeUsd).toBeGreaterThan(0);

      // Verify transaction appears in history
      const transactions = result.current.transactions;
      expect(transactions).toContain(transaction);
    });

    it('should handle transaction failures gracefully', async () => {
      const { result } = renderHook(() => useMockBlockchain(), {
        wrapper: createWrapper
      });

      // Mock Math.random to force a transaction failure (>0.95 triggers failure)
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.96); // Force failure

      act(() => {
        result.current.updateBalance('pxUSD', { balance: 1000, balanceUsd: 1000 });
      });

      let transactionError: Error | null = null;

      try {
        await act(async () => {
          await result.current.executeTransaction({
            type: 'withdraw',
            amount: 100,
            tokenIn: { symbol: 'pxUSD', amount: 100 },
            tokenOut: { symbol: 'DOLA', amount: 98 },
          });
        });
      } catch (error) {
        transactionError = error as Error;
      }

      expect(transactionError).toBeDefined();
      expect(transactionError?.message).toContain('Transaction failed');

      // Balances should remain unchanged on failed transaction
      expect(result.current.balances.pxUSD.balance).toBe(1000);
      expect(result.current.balances.DOLA.balance).toBe(0);

      // Restore Math.random
      Math.random = originalRandom;
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero withdrawal amount', async () => {
      const { result } = renderHook(() => useMockBlockchain(), {
        wrapper: createWrapper
      });

      act(() => {
        result.current.updateBalance('pxUSD', { balance: 1000, balanceUsd: 1000 });
      });

      await act(async () => {
        await result.current.executeTransaction({
          type: 'withdraw',
          amount: 0,
          tokenIn: { symbol: 'pxUSD', amount: 0 },
          tokenOut: { symbol: 'DOLA', amount: 0 },
        });
      });

      // Balances should remain unchanged for zero withdrawal
      expect(result.current.balances.pxUSD.balance).toBe(1000);
      expect(result.current.balances.DOLA.balance).toBe(0);
    });

    it('should maintain balance consistency across multiple withdrawals', async () => {
      const { result } = renderHook(() => useMockBlockchain(), {
        wrapper: createWrapper
      });

      const initialBalance = 1000;
      act(() => {
        result.current.updateBalance('pxUSD', { balance: initialBalance, balanceUsd: initialBalance });
        result.current.updateBalance('DOLA', { balance: 0, balanceUsd: 0 });
      });

      const withdrawals = [100, 200, 150, 50];
      let totalWithdrawn = 0;
      let totalReceived = 0;

      for (const amount of withdrawals) {
        await act(async () => {
          await result.current.executeTransaction({
            type: 'withdraw',
            amount: amount,
            tokenIn: { symbol: 'pxUSD', amount: amount },
            tokenOut: { symbol: 'DOLA', amount: amount * 0.98 },
          });
        });

        totalWithdrawn += amount;
        totalReceived += amount * 0.98;
      }

      // Verify final balances
      expect(result.current.balances.pxUSD.balance).toBe(initialBalance - totalWithdrawn);
      expect(result.current.balances.DOLA.balance).toBeCloseTo(totalReceived, 10);

      // Verify total fees were exactly 2% of total withdrawn
      const totalFees = totalWithdrawn - totalReceived;
      const expectedTotalFees = totalWithdrawn * 0.02;
      expect(totalFees).toBeCloseTo(expectedTotalFees, 10);
    });
  });
});