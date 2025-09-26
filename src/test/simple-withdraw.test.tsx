import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { MockBlockchainProvider, useMockBlockchain } from '../hooks/useMockBlockchain';

// Simple test component to verify withdraw functionality
function WithdrawTestComponent() {
  const blockchain = useMockBlockchain();

  const handleWithdraw = async (amount: number) => {
    try {
      await blockchain.executeTransaction({
        type: 'withdraw',
        amount: amount,
        tokenIn: { symbol: 'pxUSD', balance: amount, balanceUsd: amount },
        tokenOut: { symbol: 'DOLA', balance: amount * 0.98, balanceUsd: amount * 0.98 }, // 2% fee
      });
    } catch (error) {
      // Handle transaction failure
    }
  };

  return (
    <div>
      <div data-testid="pxusd-balance">{blockchain.balances.pxUSD?.balance || 0}</div>
      <div data-testid="dola-balance">{blockchain.balances.DOLA?.balance || 0}</div>

      <button
        onClick={() => {
          blockchain.updateBalance('pxUSD', { balance: 1000, balanceUsd: 1000 });
          blockchain.updateBalance('DOLA', { balance: 0, balanceUsd: 0 });
        }}
        data-testid="setup-balance"
      >
        Setup Balance
      </button>

      <button
        onClick={() => handleWithdraw(100)}
        data-testid="withdraw-100"
      >
        Withdraw 100
      </button>

      <button
        onClick={() => handleWithdraw(250.5)}
        data-testid="withdraw-250"
      >
        Withdraw 250.5
      </button>
    </div>
  );
}

function SimpleWithdrawTest() {
  return (
    <MockBlockchainProvider>
      <WithdrawTestComponent />
    </MockBlockchainProvider>
  );
}

describe('Simple Withdraw Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate and apply exactly 2% fee for 100 pxUSD withdrawal', async () => {
    const user = userEvent.setup();
    render(<SimpleWithdrawTest />);

    // Setup initial balance
    await user.click(screen.getByTestId('setup-balance'));
    await waitFor(() => {
      expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('1000');
      expect(screen.getByTestId('dola-balance')).toHaveTextContent('0');
    });

    // Perform withdrawal
    await user.click(screen.getByTestId('withdraw-100'));

    // Wait for transaction to complete
    await waitFor(() => {
      expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('900'); // 1000 - 100
      expect(screen.getByTestId('dola-balance')).toHaveTextContent('98');    // 100 * 0.98 (2% fee)
    }, { timeout: 10000 });

    // Verify exactly 2% fee was applied
    const pxUSDBalance = parseInt(screen.getByTestId('pxusd-balance').textContent || '0');
    const dolaBalance = parseFloat(screen.getByTestId('dola-balance').textContent || '0');

    expect(pxUSDBalance).toBe(900);
    expect(dolaBalance).toBe(98);

    // Verify fee calculation: withdrawn 100, received 98, so fee was 2
    const feeAmount = 100 - dolaBalance;
    const feePercentage = (feeAmount / 100) * 100;
    expect(feePercentage).toBe(2);
  });

  it('should calculate and apply exactly 2% fee for 250.5 pxUSD withdrawal', async () => {
    const user = userEvent.setup();
    render(<SimpleWithdrawTest />);

    // Setup initial balance
    await user.click(screen.getByTestId('setup-balance'));
    await waitFor(() => {
      expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('1000');
      expect(screen.getByTestId('dola-balance')).toHaveTextContent('0');
    });

    // Perform withdrawal
    await user.click(screen.getByTestId('withdraw-250'));

    // Wait for transaction to complete
    await waitFor(() => {
      expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('749.5'); // 1000 - 250.5
    }, { timeout: 10000 });

    const dolaBalance = parseFloat(screen.getByTestId('dola-balance').textContent || '0');
    const expectedDola = 250.5 * 0.98; // 245.49

    expect(dolaBalance).toBeCloseTo(expectedDola, 2);

    // Verify exactly 2% fee was applied
    const feeAmount = 250.5 - dolaBalance;
    const expectedFee = 250.5 * 0.02; // 5.01
    expect(feeAmount).toBeCloseTo(expectedFee, 2);
  });

  it('should handle multiple withdrawals with consistent 2% fee', async () => {
    const user = userEvent.setup();
    render(<SimpleWithdrawTest />);

    // Setup initial balance
    await user.click(screen.getByTestId('setup-balance'));
    await waitFor(() => {
      expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('1000');
      expect(screen.getByTestId('dola-balance')).toHaveTextContent('0');
    });

    // First withdrawal: 100 pxUSD
    await user.click(screen.getByTestId('withdraw-100'));
    await waitFor(() => {
      expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('900');
      expect(screen.getByTestId('dola-balance')).toHaveTextContent('98');
    }, { timeout: 10000 });

    // Second withdrawal: 250.5 pxUSD
    await user.click(screen.getByTestId('withdraw-250'));
    await waitFor(() => {
      expect(screen.getByTestId('pxusd-balance')).toHaveTextContent('649.5'); // 900 - 250.5
    }, { timeout: 10000 });

    // Final DOLA balance should be: 98 + (250.5 * 0.98) = 98 + 245.49 = 343.49
    const finalDolaBalance = parseFloat(screen.getByTestId('dola-balance').textContent || '0');
    const expectedFinalDola = 98 + (250.5 * 0.98);
    expect(finalDolaBalance).toBeCloseTo(expectedFinalDola, 2);

    // Verify total fees: (100 + 250.5) * 0.02 = 7.01
    const totalWithdrawn = 100 + 250.5;
    const totalFees = totalWithdrawn - finalDolaBalance;
    const expectedTotalFees = totalWithdrawn * 0.02;
    expect(totalFees).toBeCloseTo(expectedTotalFees, 2);
  });
});