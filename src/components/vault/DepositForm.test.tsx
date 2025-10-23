import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DepositForm from './DepositForm';
import type { DepositFormProps } from '../../types/vault';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useReadContract: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
  })),
}));

// Mock contract address context
vi.mock('../../contexts/ContractAddressContext', () => ({
  useContractAddresses: vi.fn(() => ({
    addresses: {
      bondingCurve: '0x1234567890123456789012345678901234567890',
      dolaToken: '0x0987654321098765432109876543210987654321',
    },
    loading: false,
    error: null,
    networkType: 'local',
  })),
}));

// Mock generated wagmi
vi.mock('../../generated/wagmi', () => ({
  behodler3TokenlaunchAbi: [],
}));

// Mock child components
vi.mock('../ui/AmountDisplay', () => ({
  default: ({ amount }: { amount: number }) => (
    <div data-testid="amount-display">{amount}</div>
  ),
}));

vi.mock('../ui/TokenRow', () => ({
  default: ({ token }: { token: any }) => (
    <div data-testid="token-row">
      {token.name}: {token.balance}
    </div>
  ),
}));

vi.mock('../ui/AmountInput', () => ({
  default: ({ amount, onAmountChange, onMaxClick }: {
    amount: string;
    onAmountChange: (amount: string) => void;
    onMaxClick: () => void;
  }) => (
    <div data-testid="amount-input">
      <input
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        data-testid="amount-input-field"
      />
      <button onClick={onMaxClick} data-testid="max-button">Max</button>
    </div>
  ),
}));

vi.mock('../ui/RateInfo', () => ({
  default: ({ slippageBps, onSlippageChange, minReceived }: {
    slippageBps: number;
    onSlippageChange: (bps: number) => void;
    minReceived: number;
  }) => (
    <div data-testid="rate-info">
      <span data-testid="slippage-value">Slippage: {slippageBps}</span>
      <span data-testid="min-received">Min Received: {minReceived.toFixed(4)}</span>
      <button onClick={() => onSlippageChange(100)} data-testid="slippage-button">
        Change Slippage
      </button>
    </div>
  ),
}));

vi.mock('../ui/ActionButton', () => ({
  default: ({ disabled, onAction, label, variant, isLoading }: {
    disabled: boolean;
    onAction: () => void;
    label: string;
    variant?: string;
    isLoading?: boolean;
  }) => (
    <button
      disabled={disabled}
      onClick={onAction}
      data-testid="action-button"
      data-variant={variant}
      data-loading={isLoading}
    >
      {label}
    </button>
  ),
}));

vi.mock('./DepositConfirmationDialog', () => ({
  default: ({ isOpen, onClose, onConfirm, data, isLoading }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (slippageBps: number) => void;
    data: any;
    isLoading?: boolean;
  }) => (
    isOpen ? (
      <div data-testid="confirmation-dialog">
        <div data-testid="dialog-input-amount">Input: {data.inputAmount} {data.inputToken}</div>
        <div data-testid="dialog-output-amount">Output: {data.outputAmount.toFixed(4)} {data.outputToken}</div>
        <div data-testid="dialog-price-impact">Price Impact: {(Math.ceil(data.priceImpact * 100 * 100) / 100).toFixed(2)}%</div>
        <div data-testid="dialog-slippage">Slippage: {data.slippage} bps</div>
        <button onClick={onClose} data-testid="dialog-cancel">Cancel</button>
        <button onClick={() => onConfirm(data.slippage)} data-testid="dialog-confirm" disabled={isLoading}>
          Confirm
        </button>
      </div>
    ) : null
  ),
}));

describe('DepositForm Component', () => {
  const defaultProps: DepositFormProps = {
    formData: {
      amount: '',
      autoStake: false,
      slippageBps: 10, // 0.10%
    },
    onFormChange: vi.fn(),
    constants: {
      dolaToPhUSDRate: 0.81, // 1 phUSD costs 0.81 DOLA
    },
    tokenInfo: {
      name: 'DOLA',
      balance: 10000,
      balanceUsd: 10000,
      icon: 'dola.png',
    },
    onDeposit: vi.fn(),
    isTransacting: false,
    needsApproval: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Slippage Calculations - Small Amounts', () => {
    it('should calculate slippage for 1 DOLA deposit', () => {
      const props = { ...defaultProps };
      props.formData.amount = '1';

      render(<DepositForm {...props} />);

      // Expected phUSD: 1 / 0.81 = 1.2346
      // Min received with 0.10% slippage: 1.2346 * (1 - 0.001) = 1.2333
      const minReceived = screen.getByTestId('min-received');
      expect(minReceived).toBeInTheDocument();
      expect(minReceived.textContent).toContain('1.2333');
    });

    it('should calculate slippage for 10 DOLA deposit', () => {
      const props = { ...defaultProps };
      props.formData.amount = '10';

      render(<DepositForm {...props} />);

      // Expected phUSD: 10 / 0.81 = 12.3457
      // Min received with 0.10% slippage: 12.3457 * (1 - 0.001) = 12.3333
      const minReceived = screen.getByTestId('min-received');
      expect(minReceived.textContent).toContain('12.3333');
    });
  });

  describe('Slippage Calculations - Medium Amounts', () => {
    it('should calculate slippage for 100 DOLA deposit', () => {
      const props = { ...defaultProps };
      props.formData.amount = '100';

      render(<DepositForm {...props} />);

      // Expected phUSD: 100 / 0.81 = 123.4568
      // Min received with 0.10% slippage: 123.4568 * (1 - 0.001) = 123.3333
      const minReceived = screen.getByTestId('min-received');
      expect(minReceived.textContent).toContain('123.3333');
    });

    it('should calculate slippage for 1000 DOLA deposit', () => {
      const props = { ...defaultProps };
      props.formData.amount = '1000';

      render(<DepositForm {...props} />);

      // Expected phUSD: 1000 / 0.81 = 1234.5679
      // Min received with 0.10% slippage: 1234.5679 * (1 - 0.001) = 1233.3333
      const minReceived = screen.getByTestId('min-received');
      expect(minReceived.textContent).toContain('1233.3333');
    });
  });

  describe('Slippage Calculations - Large Amounts', () => {
    it('should calculate slippage for 10000 DOLA deposit', () => {
      const props = { ...defaultProps };
      props.formData.amount = '10000';

      render(<DepositForm {...props} />);

      // Expected phUSD: 10000 / 0.81 = 12345.6790
      // Min received with 0.10% slippage: 12345.6790 * (1 - 0.001) = 12333.3333
      const minReceived = screen.getByTestId('min-received');
      expect(minReceived.textContent).toContain('12333.3333');
    });

    it('should calculate slippage for 50000 DOLA deposit', () => {
      const props = { ...defaultProps };
      props.formData.amount = '50000';

      render(<DepositForm {...props} />);

      // Expected phUSD: 50000 / 0.81 = 61728.3951
      // Min received with 0.10% slippage: 61728.3951 * (1 - 0.001) = 61666.6667
      const minReceived = screen.getByTestId('min-received');
      expect(minReceived.textContent).toContain('61666.6667');
    });
  });

  describe('Button States', () => {
    it('should show "Enter Amount" when amount is empty', () => {
      const props = { ...defaultProps };
      props.formData.amount = '';

      render(<DepositForm {...props} />);

      const button = screen.getByTestId('action-button');
      expect(button).toHaveTextContent('Enter Amount');
      expect(button).toBeDisabled();
    });

    it('should show "Insufficient Balance" when amount exceeds balance', () => {
      const props = { ...defaultProps };
      props.formData.amount = '15000'; // More than 10000 balance

      render(<DepositForm {...props} />);

      const button = screen.getByTestId('action-button');
      expect(button).toHaveTextContent('Insufficient Balance');
      expect(button).toBeDisabled();
    });

    it('should show "Approve DOLA" when approval is needed', () => {
      const props = { ...defaultProps };
      props.formData.amount = '100';
      props.needsApproval = true;

      render(<DepositForm {...props} />);

      const button = screen.getByTestId('action-button');
      expect(button).toHaveTextContent('Approve DOLA');
      expect(button).toHaveAttribute('data-variant', 'approve');
      expect(button).not.toBeDisabled();
    });

    it('should show "Deposit" when amount is valid and approved', () => {
      const props = { ...defaultProps };
      props.formData.amount = '100';
      props.needsApproval = false;

      render(<DepositForm {...props} />);

      const button = screen.getByTestId('action-button');
      expect(button).toHaveTextContent('Deposit');
      expect(button).not.toBeDisabled();
    });
  });

  describe('Deposit Flow', () => {
    it('should open confirmation dialog when deposit button is clicked', async () => {
      const user = userEvent.setup();
      const props = { ...defaultProps };
      props.formData.amount = '100';
      props.needsApproval = false;

      render(<DepositForm {...props} />);

      const depositButton = screen.getByTestId('action-button');
      await user.click(depositButton);

      // Confirmation dialog should be open
      const dialog = screen.getByTestId('confirmation-dialog');
      expect(dialog).toBeInTheDocument();

      // Check data passed to dialog
      expect(screen.getByTestId('dialog-input-amount')).toHaveTextContent('100 DOLA');
      expect(screen.getByTestId('dialog-output-amount')).toContain('phUSD');
    });

    it('should call onDeposit when confirmation is confirmed', async () => {
      const user = userEvent.setup();
      const onDeposit = vi.fn();
      const props = { ...defaultProps, onDeposit };
      props.formData.amount = '100';
      props.needsApproval = false;

      render(<DepositForm {...props} />);

      // Click deposit button
      const depositButton = screen.getByTestId('action-button');
      await user.click(depositButton);

      // Confirm in dialog
      const confirmButton = screen.getByTestId('dialog-confirm');
      await user.click(confirmButton);

      expect(onDeposit).toHaveBeenCalledOnce();
    });

    it('should close dialog when canceled', async () => {
      const user = userEvent.setup();
      const props = { ...defaultProps };
      props.formData.amount = '100';
      props.needsApproval = false;

      render(<DepositForm {...props} />);

      // Click deposit button
      const depositButton = screen.getByTestId('action-button');
      await user.click(depositButton);

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

      render(<DepositForm {...props} />);

      const amountInput = screen.getByTestId('amount-input-field');
      await user.type(amountInput, '250');

      expect(onFormChange).toHaveBeenCalledWith({ amount: '250' });
    });

    it('should set max amount when max button is clicked', async () => {
      const user = userEvent.setup();
      const onFormChange = vi.fn();
      const props = { ...defaultProps, onFormChange };
      props.tokenInfo.balance = 5000;

      render(<DepositForm {...props} />);

      const maxButton = screen.getByTestId('max-button');
      await user.click(maxButton);

      expect(onFormChange).toHaveBeenCalledWith({ amount: '5000' });
    });
  });

  describe('Approval Flow', () => {
    it('should call onApprove when approve button is clicked', async () => {
      const user = userEvent.setup();
      const onApprove = vi.fn();
      const props = { ...defaultProps, onApprove };
      props.formData.amount = '100';
      props.needsApproval = true;

      render(<DepositForm {...props} />);

      const approveButton = screen.getByTestId('action-button');
      expect(approveButton).toHaveTextContent('Approve DOLA');

      await user.click(approveButton);

      expect(onApprove).toHaveBeenCalledOnce();
    });
  });
});
