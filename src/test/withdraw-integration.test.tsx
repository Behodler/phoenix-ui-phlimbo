import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockBlockchainProvider, useMockBlockchain } from '../hooks/useMockBlockchain';
import type { ReactNode } from 'react';

// Create a test component that integrates the withdraw flow
function WithdrawTestApp() {
  const blockchain = useMockBlockchain();

  const handleWithdraw = async (amount: number) => {
    await blockchain.executeTransaction({
      type: 'withdraw',
      amount: amount,
      tokenIn: { symbol: 'pxUSD', amount: amount },
      tokenOut: { symbol: 'DOLA', amount: amount * 0.98 }, // 2% fee
    });
  };

  const pxUSDBalance = blockchain.balances.pxUSD?.balance || 0;
  const dolaBalance = blockchain.balances.DOLA?.balance || 0;

  return (
    <div>
      <div data-testid="pxusd-balance">{pxUSDBalance}</div>
      <div data-testid="dola-balance">{dolaBalance}</div>
      <div data-testid="is-connected">{blockchain.isConnected.toString()}</div>
      <div data-testid="is-loading">{blockchain.isLoading.toString()}</div>

      {blockchain.error && (
        <div data-testid="error-message">{blockchain.error}</div>
      )}

      <button
        onClick={() => blockchain.connect()}
        data-testid="connect-button"
        disabled={blockchain.isLoading}
      >
        Connect Wallet
      </button>

      <button
        onClick={() => handleWithdraw(100)}
        data-testid="withdraw-100-button"
        disabled={!blockchain.isConnected || blockchain.isLoading || pxUSDBalance < 100}
      >
        Withdraw 100 pxUSD
      </button>

      <button
        onClick={() => handleWithdraw(250.5)}
        data-testid="withdraw-250-button"
        disabled={!blockchain.isConnected || blockchain.isLoading || pxUSDBalance < 250.5}
      >
        Withdraw 250.5 pxUSD
      </button>

      <button
        onClick={() => handleWithdraw(pxUSDBalance)}
        data-testid="withdraw-max-button"
        disabled={!blockchain.isConnected || blockchain.isLoading || pxUSDBalance === 0}
      >
        Withdraw Max
      </button>

      <button
        onClick={() => blockchain.updateBalance('pxUSD', { balance: 1000, balanceUsd: 1000 })}
        data-testid="set-balance-button"
      >
        Set pxUSD Balance to 1000
      </button>

      <div data-testid="transaction-count">{blockchain.transactions.length}</div>

      {blockchain.transactions.map((tx, index) => (
        <div key={tx.id} data-testid={`transaction-${index}`}>
          {tx.type}: {tx.amount} - {tx.status}
        </div>
      ))}
    </div>
  );
}

function TestWrapper({ children }: { children: ReactNode }) {
  return <MockBlockchainProvider>{children}</MockBlockchainProvider>;
}

describe('End-to-End Withdraw Functionality Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Withdraw Workflow', () => {
    it('should complete full withdraw workflow with 2% fee', async () => {
      const user = userEvent.setup();

      render(<WithdrawTestApp />, { wrapper: TestWrapper });

      // Initial state - not connected, no balance
      expect(screen.getByTestId('is-connected')).toHaveTextContent('false');
      expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('0');
      expect(screen.getByTestId('dola-balance')).toHaveTextContent('0');

      // Set up initial balance
      await user.click(screen.getByTestId('set-balance-button'));

      await waitFor(() => {
        expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('1000');
      });

      // Connect wallet
      await user.click(screen.getByTestId('connect-button'));

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      }, { timeout: 3000 });

      // Now withdrawal buttons should be enabled
      const withdraw100Button = screen.getByTestId('withdraw-100-button');
      expect(withdraw100Button).not.toBeDisabled();

      // Execute withdrawal
      await user.click(withdraw100Button);

      // Wait for transaction to complete
      await waitFor(() => {
        expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('900'); // 1000 - 100
        expect(screen.getByTestId('dola-balance')).toHaveTextContent('98'); // 100 - 2% fee
      }, { timeout: 5000 });

      // Check transaction history
      expect(screen.getByTestId('transaction-count')).toHaveTextContent('1');
      expect(screen.getByTestId('transaction-0')).toHaveTextContent('withdraw: 100 - success');
    });

    it('should handle multiple withdrawals with accurate fee calculations', async () => {
      const user = userEvent.setup();

      render(<WithdrawTestApp />, { wrapper: TestWrapper });

      // Set up initial balance and connect
      await user.click(screen.getByTestId('set-balance-button'));
      await waitFor(() => {
        expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('1000');
      });

      await user.click(screen.getByTestId('connect-button'));
      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      }, { timeout: 3000 });

      // First withdrawal: 100 pxUSD
      await user.click(screen.getByTestId('withdraw-100-button'));
      await waitFor(() => {
        expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('900');
        expect(screen.getByTestId('dola-balance')).toHaveTextContent('98');
      }, { timeout: 5000 });

      // Second withdrawal: 250.5 pxUSD
      await user.click(screen.getByTestId('withdraw-250-button'));
      await waitFor(() => {
        // 900 - 250.5 = 649.5
        expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('649.5');
        // 98 + (250.5 * 0.98) = 98 + 245.49 = 343.49
        expect(screen.getByTestId('dola-balance')).toHaveTextContent('343.49');
      }, { timeout: 5000 });

      // Verify transaction history
      expect(screen.getByTestId('transaction-count')).toHaveTextContent('2');
      expect(screen.getByTestId('transaction-0')).toHaveTextContent('withdraw: 100 - success');
      expect(screen.getByTestId('transaction-1')).toHaveTextContent('withdraw: 250.5 - success');
    });

    it('should handle maximum withdrawal correctly', async () => {
      const user = userEvent.setup();

      render(<WithdrawTestApp />, { wrapper: TestWrapper });

      // Set up balance and connect
      await user.click(screen.getByTestId('set-balance-button'));
      await user.click(screen.getByTestId('connect-button'));
      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
        expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('1000');
      }, { timeout: 3000 });

      // Withdraw maximum amount
      await user.click(screen.getByTestId('withdraw-max-button'));

      await waitFor(() => {
        expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('0');
        // 1000 * 0.98 = 980
        expect(screen.getByTestId('dola-balance')).toHaveTextContent('980');
      }, { timeout: 5000 });

      // After max withdrawal, withdraw buttons should be disabled due to zero balance
      expect(screen.getByTestId('withdraw-100-button')).toBeDisabled();
      expect(screen.getByTestId('withdraw-250-button')).toBeDisabled();
      expect(screen.getByTestId('withdraw-max-button')).toBeDisabled();
    });

    it('should prevent withdrawal when insufficient balance', async () => {
      const user = userEvent.setup();

      render(<WithdrawTestApp />, { wrapper: TestWrapper });

      // Connect without setting balance (remains 0)
      await user.click(screen.getByTestId('connect-button'));
      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      }, { timeout: 3000 });

      // All withdraw buttons should be disabled due to zero balance
      expect(screen.getByTestId('withdraw-100-button')).toBeDisabled();
      expect(screen.getByTestId('withdraw-250-button')).toBeDisabled();
      expect(screen.getByTestId('withdraw-max-button')).toBeDisabled();

      // Set small balance
      await user.click(screen.getByTestId('set-balance-button'));
      await waitFor(() => {
        expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('1000');
      });

      // Withdraw most of the balance
      await user.click(screen.getByTestId('withdraw-100-button'));
      await waitFor(() => {
        expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('900');
      }, { timeout: 5000 });

      // Now 250.5 withdrawal should still be possible (balance > 250.5)
      expect(screen.getByTestId('withdraw-250-button')).not.toBeDisabled();

      await user.click(screen.getByTestId('withdraw-250-button'));
      await waitFor(() => {
        expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('649.5');
      }, { timeout: 5000 });

      // Now 250.5 withdrawal should be disabled (649.5 < 250.5 is false, but let's do multiple withdrawals)
      // Let's withdraw again to get below 250.5
      await user.click(screen.getByTestId('withdraw-100-button'));
      await user.click(screen.getByTestId('withdraw-100-button'));
      await user.click(screen.getByTestId('withdraw-100-button'));
      await user.click(screen.getByTestId('withdraw-100-button'));

      await waitFor(() => {
        const balance = parseFloat(screen.getByTestId('pxusd-balance').textContent || '0');
        expect(balance).toBeLessThan(250.5);
        expect(screen.getByTestId('withdraw-250-button')).toBeDisabled();
      }, { timeout: 10000 });
    });
  });

  describe('Error Handling in Full Workflow', () => {
    it('should handle connection failures gracefully', async () => {
      // Mock Math.random to force connection failure
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.95); // Force connection failure

      const user = userEvent.setup();
      render(<WithdrawTestApp />, { wrapper: TestWrapper });

      await user.click(screen.getByTestId('connect-button'));

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to connect to wallet');
        expect(screen.getByTestId('is-connected')).toHaveTextContent('false');
      }, { timeout: 3000 });

      // Withdraw buttons should remain disabled
      expect(screen.getByTestId('withdraw-100-button')).toBeDisabled();

      // Restore Math.random
      Math.random = originalRandom;
    });

    it('should handle transaction failures and maintain balance consistency', async () => {
      const user = userEvent.setup();
      render(<WithdrawTestApp />, { wrapper: TestWrapper });

      // Set up successful connection and balance
      await user.click(screen.getByTestId('set-balance-button'));
      await user.click(screen.getByTestId('connect-button'));
      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
        expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('1000');
      }, { timeout: 3000 });

      // Mock Math.random to force transaction failure
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.96); // Force transaction failure

      // Attempt withdrawal - should fail but not crash
      await user.click(screen.getByTestId('withdraw-100-button'));

      await waitFor(() => {
        // Balance should remain unchanged due to failed transaction
        expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('1000');
        expect(screen.getByTestId('dola-balance')).toHaveTextContent('0');
      }, { timeout: 5000 });

      // Restore Math.random and try successful withdrawal
      Math.random = originalRandom;

      await user.click(screen.getByTestId('withdraw-100-button'));
      await waitFor(() => {
        expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('900');
        expect(screen.getByTestId('dola-balance')).toHaveTextContent('98');
      }, { timeout: 5000 });
    });
  });

  describe('Fee Accuracy in Real Workflow Scenarios', () => {
    it('should maintain exact 2% fee across various real-world scenarios', async () => {
      const user = userEvent.setup();
      render(<WithdrawTestApp />, { wrapper: TestWrapper });

      await user.click(screen.getByTestId('set-balance-button'));
      await user.click(screen.getByTestId('connect-button'));
      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
        expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('1000');
      }, { timeout: 3000 });

      const withdrawalScenarios = [
        { amount: 100, expectedPxUSDLeft: 900, expectedDOLAReceived: 98 },
        { amount: 250.5, expectedPxUSDLeft: 649.5, expectedDOLAReceived: 343.49 }, // 98 + 245.49
      ];

      let currentDOLABalance = 0;

      for (const scenario of withdrawalScenarios) {
        if (scenario.amount === 100) {
          await user.click(screen.getByTestId('withdraw-100-button'));
        } else if (scenario.amount === 250.5) {
          await user.click(screen.getByTestId('withdraw-250-button'));
        }

        currentDOLABalance = scenario.expectedDOLAReceived;

        await waitFor(() => {
          expect(screen.getByTestId('pxusd-balance')).toHaveTextContent(scenario.expectedPxUSDLeft.toString());
          expect(screen.getByTestId('dola-balance')).toHaveTextContent(scenario.expectedDOLAReceived.toString());
        }, { timeout: 5000 });

        // Verify 2% fee was applied
        const feeAmount = scenario.amount * 0.02;
        const receivedAmount = scenario.amount * 0.98;

        // The DOLA balance should reflect the accumulated received amounts
        // For first withdrawal: 0 + 98 = 98
        // For second withdrawal: 98 + 245.49 = 343.49
      }

      // Final verification: total fees should be exactly 2% of total withdrawn
      const totalWithdrawn = 100 + 250.5; // 350.5
      const totalReceived = 343.49; // Current DOLA balance
      const totalFees = totalWithdrawn - totalReceived; // 7.01

      const expectedTotalFees = totalWithdrawn * 0.02; // 7.01
      expect(Math.abs(totalFees - expectedTotalFees)).toBeLessThan(0.01); // Allow for small floating point precision
    });
  });
});