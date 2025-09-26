import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import WithdrawTab from '../components/vault/WithdrawTab';
import type { WithdrawFormProps } from '../types/vault';

// Mock the child components
vi.mock('../components/ui/AmountDisplay', () => ({
  default: ({ amount }: { amount: number }) => (
    <div data-testid="amount-display">{amount}</div>
  )
}));

vi.mock('../components/ui/TokenRow', () => ({
  default: ({ token, onMaxClick }: { token: any, onMaxClick: () => void }) => (
    <div data-testid="token-row">
      <span>{token.name}: {token.balance}</span>
      <button onClick={onMaxClick} data-testid="max-button">Max</button>
    </div>
  )
}));

vi.mock('../components/ui/AmountInput', () => ({
  default: ({ amount, onAmountChange, onMaxClick }: {
    amount: string,
    onAmountChange: (amount: string) => void,
    onMaxClick: () => void
  }) => (
    <div data-testid="amount-input">
      <input
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        data-testid="amount-input-field"
      />
      <button onClick={onMaxClick} data-testid="amount-max-button">Max</button>
    </div>
  )
}));

vi.mock('../components/ui/RateInfo', () => ({
  default: ({ slippageBps, onSlippageChange, minReceived }: {
    slippageBps: number,
    onSlippageChange: (bps: number) => void,
    minReceived: number
  }) => (
    <div data-testid="rate-info">
      <span>Slippage: {slippageBps}</span>
      <span>Min Received: {minReceived}</span>
      <button onClick={() => onSlippageChange(100)} data-testid="slippage-button">
        Change Slippage
      </button>
    </div>
  )
}));

vi.mock('../components/ui/ActionButton', () => ({
  default: ({ disabled, onAction, label, isLoading }: {
    disabled: boolean,
    onAction: () => void,
    label: string,
    isLoading?: boolean
  }) => (
    <button
      disabled={disabled}
      onClick={onAction}
      data-testid="action-button"
      data-loading={isLoading}
    >
      {label}
    </button>
  )
}));

vi.mock('../components/vault/WithdrawConfirmationDialog', () => ({
  default: ({ isOpen, onClose, onConfirm, data, isLoading }: {
    isOpen: boolean,
    onClose: () => void,
    onConfirm: () => void,
    data: any,
    isLoading?: boolean
  }) => (
    isOpen ? (
      <div data-testid="confirmation-dialog">
        <div>Fee Amount: {data.feeAmount}</div>
        <div>Fee Rate: {data.feeRate}</div>
        <div>Amount After Fee: {data.amountAfterFee}</div>
        <div>Output Amount: {data.outputAmount}</div>
        <button onClick={onClose} data-testid="dialog-cancel">Cancel</button>
        <button onClick={onConfirm} data-testid="dialog-confirm" disabled={isLoading}>
          Confirm
        </button>
      </div>
    ) : null
  )
}));

describe('WithdrawTab Component', () => {
  const defaultProps: WithdrawFormProps = {
    formData: {
      amount: '',
      autoStake: false,
      slippageBps: 50
    },
    onFormChange: vi.fn(),
    constants: {
      dolaToPxUSDRate: 1.1 // DOLA to pxUSD rate
    },
    positionInfo: {
      value: 1000, // pxUSD balance
      valueUsd: 1000,
      isStaked: false
    },
    onWithdraw: vi.fn(),
    isTransacting: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Fee Calculations - Various Amounts', () => {
    it('should calculate 2% fee correctly for amount 100', async () => {
      const props = { ...defaultProps };
      const onFormChange = vi.fn();
      props.onFormChange = onFormChange;
      props.formData.amount = '100';

      render(<WithdrawTab {...props} />);

      // Should show fee information
      expect(screen.getByText(/Withdrawal Fee/)).toBeInTheDocument();
      expect(screen.getByText(/Fee \(2\.0%\)/)).toBeInTheDocument();
      expect(screen.getByText(/2\.0000 pxUSD/)).toBeInTheDocument(); // 2% of 100
      expect(screen.getByText(/89\.0909 DOLA/)).toBeInTheDocument(); // 98 / 1.1 rate
    });

    it('should calculate 2% fee correctly for amount 50', async () => {
      const props = { ...defaultProps };
      props.formData.amount = '50';

      render(<WithdrawTab {...props} />);

      expect(screen.getByText(/Fee \(2\.0%\)/)).toBeInTheDocument();
      expect(screen.getByText(/1\.0000 pxUSD/)).toBeInTheDocument(); // 2% of 50 = 1
      expect(screen.getByText(/44\.5455 DOLA/)).toBeInTheDocument(); // 49 / 1.1 rate
    });

    it('should calculate 2% fee correctly for amount 250.5', async () => {
      const props = { ...defaultProps };
      props.formData.amount = '250.5';

      render(<WithdrawTab {...props} />);

      expect(screen.getByText(/Fee \(2\.0%\)/)).toBeInTheDocument();
      expect(screen.getByText(/5\.0100 pxUSD/)).toBeInTheDocument(); // 2% of 250.5 = 5.01
      expect(screen.getByText(/223\.1727 DOLA/)).toBeInTheDocument(); // 245.49 / 1.1 rate (more precise)
    });

    it('should calculate 2% fee correctly for amount 1000', async () => {
      const props = { ...defaultProps };
      props.formData.amount = '1000';

      render(<WithdrawTab {...props} />);

      expect(screen.getByText(/Fee \(2\.0%\)/)).toBeInTheDocument();
      expect(screen.getByText(/20\.0000 pxUSD/)).toBeInTheDocument(); // 2% of 1000 = 20
      expect(screen.getByText(/890.9091 DOLA/)).toBeInTheDocument(); // 980 / 1.1 rate
    });

    it('should calculate 2% fee correctly for small decimals', async () => {
      const props = { ...defaultProps };
      props.formData.amount = '0.1';

      render(<WithdrawTab {...props} />);

      expect(screen.getByText(/Fee \(2\.0%\)/)).toBeInTheDocument();
      expect(screen.getByText(/0\.0020 pxUSD/)).toBeInTheDocument(); // 2% of 0.1 = 0.002
      expect(screen.getByText(/0\.0891 DOLA/)).toBeInTheDocument(); // 0.098 / 1.1 rate
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero amount correctly', async () => {
      const props = { ...defaultProps };
      props.formData.amount = '0';

      render(<WithdrawTab {...props} />);

      // Should not show fee information for zero amount
      expect(screen.queryByText(/Withdrawal Fee/)).not.toBeInTheDocument();
      expect(screen.getByTestId('action-button')).toHaveTextContent('Enter Amount');
      expect(screen.getByTestId('action-button')).toBeDisabled();
    });

    it('should handle empty amount correctly', async () => {
      const props = { ...defaultProps };
      props.formData.amount = '';

      render(<WithdrawTab {...props} />);

      // Should not show fee information for empty amount
      expect(screen.queryByText(/Withdrawal Fee/)).not.toBeInTheDocument();
      expect(screen.getByTestId('action-button')).toHaveTextContent('Enter Amount');
      expect(screen.getByTestId('action-button')).toBeDisabled();
    });

    it('should show insufficient balance error when amount exceeds balance', async () => {
      const props = { ...defaultProps };
      props.formData.amount = '1500'; // Exceeds balance of 1000
      props.positionInfo.value = 1000;

      render(<WithdrawTab {...props} />);

      expect(screen.getByTestId('action-button')).toHaveTextContent('Insufficient pxUSD Balance');
      expect(screen.getByTestId('action-button')).toBeDisabled();
    });

    it('should handle maximum available balance correctly', async () => {
      const props = { ...defaultProps };
      props.formData.amount = '1000'; // Exactly the balance
      props.positionInfo.value = 1000;

      render(<WithdrawTab {...props} />);

      expect(screen.getByText(/20\.0000 pxUSD/)).toBeInTheDocument(); // 2% fee
      expect(screen.getByText(/890.9091 DOLA/)).toBeInTheDocument(); // After fee conversion
      expect(screen.getByTestId('action-button')).toHaveTextContent('Withdraw');
      expect(screen.getByTestId('action-button')).not.toBeDisabled();
    });
  });

  describe('Withdrawal Flow', () => {
    it('should open confirmation dialog when withdraw button is clicked', async () => {
      const user = userEvent.setup();
      const props = { ...defaultProps };
      props.formData.amount = '100';

      render(<WithdrawTab {...props} />);

      const withdrawButton = screen.getByTestId('action-button');
      expect(withdrawButton).toHaveTextContent('Withdraw');

      await user.click(withdrawButton);

      // Confirmation dialog should be open
      const dialog = screen.getByTestId('confirmation-dialog');
      expect(dialog).toBeInTheDocument();

      // Check that fee data is passed correctly to dialog
      expect(screen.getByText('Fee Amount: 2')).toBeInTheDocument();
      expect(screen.getByText('Fee Rate: 0.02')).toBeInTheDocument();
      expect(screen.getByText('Amount After Fee: 98')).toBeInTheDocument();
    });

    it('should call onWithdraw when confirmation dialog is confirmed', async () => {
      const user = userEvent.setup();
      const onWithdraw = vi.fn();
      const props = { ...defaultProps, onWithdraw };
      props.formData.amount = '100';

      render(<WithdrawTab {...props} />);

      // Click withdraw button
      const withdrawButton = screen.getByTestId('action-button');
      await user.click(withdrawButton);

      // Confirm in dialog
      const confirmButton = screen.getByTestId('dialog-confirm');
      await user.click(confirmButton);

      expect(onWithdraw).toHaveBeenCalledOnce();

      // Dialog should be closed
      expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
    });

    it('should close dialog when canceled', async () => {
      const user = userEvent.setup();
      const props = { ...defaultProps };
      props.formData.amount = '100';

      render(<WithdrawTab {...props} />);

      // Click withdraw button
      const withdrawButton = screen.getByTestId('action-button');
      await user.click(withdrawButton);

      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();

      // Cancel dialog
      const cancelButton = screen.getByTestId('dialog-cancel');
      await user.click(cancelButton);

      expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    it('should call onFormChange when amount is changed', async () => {
      const user = userEvent.setup();
      const onFormChange = vi.fn();
      const props = { ...defaultProps, onFormChange };

      render(<WithdrawTab {...props} />);

      const amountInput = screen.getByTestId('amount-input-field');
      await user.type(amountInput, '123');

      expect(onFormChange).toHaveBeenCalledWith({ amount: '123' });
    });

    it('should set max amount when max button is clicked', async () => {
      const user = userEvent.setup();
      const onFormChange = vi.fn();
      const props = { ...defaultProps, onFormChange };
      props.positionInfo.value = 500;

      render(<WithdrawTab {...props} />);

      const maxButton = screen.getByTestId('max-button');
      await user.click(maxButton);

      expect(onFormChange).toHaveBeenCalledWith({ amount: '500' });
    });

    it('should call onFormChange when slippage is changed', async () => {
      const user = userEvent.setup();
      const onFormChange = vi.fn();
      const props = { ...defaultProps, onFormChange };

      render(<WithdrawTab {...props} />);

      const slippageButton = screen.getByTestId('slippage-button');
      await user.click(slippageButton);

      expect(onFormChange).toHaveBeenCalledWith({ slippageBps: 100 });
    });
  });

  describe('Loading States', () => {
    it('should show loading state on withdraw button when transacting', () => {
      const props = { ...defaultProps };
      props.formData.amount = '100';
      props.isTransacting = true;

      render(<WithdrawTab {...props} />);

      const actionButton = screen.getByTestId('action-button');
      expect(actionButton).toHaveAttribute('data-loading', 'true');
      expect(actionButton).toBeDisabled();
    });

    it('should pass loading state to confirmation dialog', async () => {
      const props = { ...defaultProps };
      props.formData.amount = '100';
      props.isTransacting = true;

      render(<WithdrawTab {...props} />);

      // Click withdraw button (even though it's disabled, for testing)
      const withdrawButton = screen.getByTestId('action-button');
      fireEvent.click(withdrawButton); // Use fireEvent to bypass disabled state

      const confirmButton = screen.getByTestId('dialog-confirm');
      expect(confirmButton).toBeDisabled();
    });
  });

  describe('Fee Rate Consistency', () => {
    const testAmounts = ['1', '10', '100', '500', '999.99', '0.01', '1234.56'];

    testAmounts.forEach(amount => {
      it(`should always apply exactly 2% fee for amount ${amount}`, () => {
        const props = { ...defaultProps };
        props.formData.amount = amount;

        render(<WithdrawTab {...props} />);

        if (parseFloat(amount) > 0) {
          expect(screen.getByText(/Fee \(2\.0%\)/)).toBeInTheDocument();

          const expectedFee = parseFloat(amount) * 0.02;
          const expectedFeeText = expectedFee.toFixed(4);

          expect(screen.getByText(new RegExp(expectedFeeText))).toBeInTheDocument();
        }
      });
    });
  });
});