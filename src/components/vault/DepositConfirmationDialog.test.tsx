import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DepositConfirmationDialog from './DepositConfirmationDialog';

// Mock ConfirmationDialog
vi.mock('../ui/ConfirmationDialog', () => ({
  default: ({ isOpen, onClose, onConfirm, title, confirmLabel, isLoading, disabled, children }: any) => (
    isOpen ? (
      <div data-testid="confirmation-dialog">
        <h2 data-testid="dialog-title">{title}</h2>
        <div data-testid="dialog-content">{children}</div>
        <button onClick={onClose} data-testid="dialog-cancel">Cancel</button>
        <button
          onClick={onConfirm}
          data-testid="dialog-confirm"
          disabled={disabled || isLoading}
          data-loading={isLoading}
        >
          {confirmLabel}
        </button>
      </div>
    ) : null
  ),
}));

describe('DepositConfirmationDialog Component', () => {
  const defaultData = {
    inputAmount: 100,
    inputToken: 'DOLA',
    outputAmount: 123.4568,
    outputToken: 'phUSD',
    priceImpact: 0.0001, // 0.01%
    slippage: 10, // 0.10% (10 basis points)
    marginalPrice: 0.81,
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    data: defaultData,
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display Tests', () => {
    it('should display deposit amount correctly', () => {
      render(<DepositConfirmationDialog {...defaultProps} />);

      expect(screen.getByText(/You're depositing/i)).toBeInTheDocument();
      expect(screen.getByText(/100/)).toBeInTheDocument();
      expect(screen.getByText(/DOLA/)).toBeInTheDocument();
    });

    it('should display expected output amount correctly', () => {
      render(<DepositConfirmationDialog {...defaultProps} />);

      expect(screen.getByText(/You'll receive/i)).toBeInTheDocument();
      expect(screen.getByText(/123\.4568/)).toBeInTheDocument();
      expect(screen.getByText(/phUSD/)).toBeInTheDocument();
    });

    it('should display price impact correctly', () => {
      render(<DepositConfirmationDialog {...defaultProps} />);

      expect(screen.getByText(/Price Impact/i)).toBeInTheDocument();
      expect(screen.getByText(/0\.01%/)).toBeInTheDocument();
    });

    it('should display slippage tolerance as percentage', () => {
      render(<DepositConfirmationDialog {...defaultProps} />);

      expect(screen.getByText(/Maximum Slippage/i)).toBeInTheDocument();
      // 10 bps = 0.10%
      const slippageInput = screen.getByDisplayValue('0.10');
      expect(slippageInput).toBeInTheDocument();
    });
  });

  describe('Slippage Calculations - Small Amounts', () => {
    it('should calculate minimum received for 1 DOLA with 0.10% slippage', () => {
      const props = {
        ...defaultProps,
        data: {
          ...defaultData,
          inputAmount: 1,
          outputAmount: 1.2346, // 1 / 0.81
          slippage: 10, // 0.10%
        },
      };

      render(<DepositConfirmationDialog {...props} />);

      expect(screen.getByText(/Minimum Received/i)).toBeInTheDocument();
      // Min received: 1.2346 * (1 - 0.001) = 1.2333
      expect(screen.getByText(/1\.2333/)).toBeInTheDocument();
    });

    it('should calculate minimum received for 10 DOLA with 0.10% slippage', () => {
      const props = {
        ...defaultProps,
        data: {
          ...defaultData,
          inputAmount: 10,
          outputAmount: 12.3457, // 10 / 0.81
          slippage: 10, // 0.10%
        },
      };

      render(<DepositConfirmationDialog {...props} />);

      // Min received: 12.3457 * (1 - 0.001) = 12.3333
      expect(screen.getByText(/12\.3333/)).toBeInTheDocument();
    });
  });

  describe('Slippage Calculations - Medium Amounts', () => {
    it('should calculate minimum received for 100 DOLA', () => {
      render(<DepositConfirmationDialog {...defaultProps} />);

      expect(screen.getByText(/Minimum Received/i)).toBeInTheDocument();
      // 123.4568 * (1 - 0.001) = 123.3333
      expect(screen.getByText(/123\.3333/)).toBeInTheDocument();
    });

    it('should calculate minimum received for 1000 DOLA', () => {
      const props = {
        ...defaultProps,
        data: {
          ...defaultData,
          inputAmount: 1000,
          outputAmount: 1234.5679, // 1000 / 0.81
          slippage: 10, // 0.10%
        },
      };

      render(<DepositConfirmationDialog {...props} />);

      // Min received: 1234.5679 * (1 - 0.001) = 1233.3333
      expect(screen.getByText(/1233\.3333/)).toBeInTheDocument();
    });
  });

  describe('Slippage Calculations - Large Amounts', () => {
    it('should calculate minimum received for 10000 DOLA', () => {
      const props = {
        ...defaultProps,
        data: {
          ...defaultData,
          inputAmount: 10000,
          outputAmount: 12345.6790, // 10000 / 0.81
          slippage: 10, // 0.10%
        },
      };

      render(<DepositConfirmationDialog {...props} />);

      // Min received: 12345.6790 * (1 - 0.001) = 12333.3333
      expect(screen.getByText(/12333\.3333/)).toBeInTheDocument();
    });
  });

  describe('Editable Slippage', () => {
    it('should allow user to edit slippage tolerance', async () => {
      const user = userEvent.setup();
      render(<DepositConfirmationDialog {...defaultProps} />);

      const slippageInput = screen.getByDisplayValue('0.10') as HTMLInputElement;

      await user.clear(slippageInput);
      await user.type(slippageInput, '0.50');

      await waitFor(() => {
        expect(slippageInput.value).toBe('0.50');
      });
    });

    it('should update minimum received when slippage is changed', async () => {
      const user = userEvent.setup();
      render(<DepositConfirmationDialog {...defaultProps} />);

      const slippageInput = screen.getByDisplayValue('0.10');

      // Change slippage from 0.10% to 0.50%
      await user.clear(slippageInput);
      await user.type(slippageInput, '0.50');

      // Wait for debounced update (300ms)
      await waitFor(() => {
        // Min received with 0.50%: 123.4568 * (1 - 0.005) = 122.8395
        expect(screen.getByText(/122\.8395/)).toBeInTheDocument();
      }, { timeout: 500 });
    });

    it('should pass updated slippage to onConfirm', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const props = { ...defaultProps, onConfirm };

      render(<DepositConfirmationDialog {...props} />);

      const slippageInput = screen.getByDisplayValue('0.10');

      // Change slippage to 1.00% (100 bps)
      await user.clear(slippageInput);
      await user.type(slippageInput, '1.00');

      const confirmButton = screen.getByTestId('dialog-confirm');
      await user.click(confirmButton);

      // Should pass 100 bps
      expect(onConfirm).toHaveBeenCalledWith(100);
    });
  });

  describe('Price Impact Warnings', () => {
    it('should show warning for high price impact (>5%)', () => {
      const props = {
        ...defaultProps,
        data: {
          ...defaultData,
          priceImpact: 0.08, // 8%
        },
      };

      render(<DepositConfirmationDialog {...props} />);

      expect(screen.getByText(/High price impact detected/i)).toBeInTheDocument();
      expect(screen.getByText(/8\.00%/)).toBeInTheDocument();
    });

    it('should not show warning for low price impact (<5%)', () => {
      const props = {
        ...defaultProps,
        data: {
          ...defaultData,
          priceImpact: 0.02, // 2%
        },
      };

      render(<DepositConfirmationDialog {...props} />);

      expect(screen.queryByText(/High price impact detected/i)).not.toBeInTheDocument();
    });

    it('should show warning when slippage is insufficient', () => {
      const props = {
        ...defaultProps,
        data: {
          ...defaultData,
          priceImpact: 0.05, // 5% price impact
          slippage: 10, // 0.10% slippage (insufficient)
        },
      };

      render(<DepositConfirmationDialog {...props} />);

      expect(screen.getByText(/Slippage tolerance too low/i)).toBeInTheDocument();
      expect(screen.getByText(/requires at least 5\.00%/i)).toBeInTheDocument();
    });

    it('should disable confirm button when slippage is insufficient', () => {
      const props = {
        ...defaultProps,
        data: {
          ...defaultData,
          priceImpact: 0.10, // 10% price impact
          slippage: 10, // 0.10% slippage (insufficient)
        },
      };

      render(<DepositConfirmationDialog {...props} />);

      const confirmButton = screen.getByTestId('dialog-confirm');
      expect(confirmButton).toBeDisabled();
    });
  });

  describe('Dialog Interactions', () => {
    it('should call onClose when cancel is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const props = { ...defaultProps, onClose };

      render(<DepositConfirmationDialog {...props} />);

      const cancelButton = screen.getByTestId('dialog-cancel');
      await user.click(cancelButton);

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should call onConfirm when confirm is clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const props = { ...defaultProps, onConfirm };

      render(<DepositConfirmationDialog {...props} />);

      const confirmButton = screen.getByTestId('dialog-confirm');
      await user.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledWith(10); // Default slippage bps
    });

    it('should not render when isOpen is false', () => {
      const props = { ...defaultProps, isOpen: false };

      render(<DepositConfirmationDialog {...props} />);

      expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
    });

    it('should show loading state on confirm button', () => {
      const props = { ...defaultProps, isLoading: true };

      render(<DepositConfirmationDialog {...props} />);

      const confirmButton = screen.getByTestId('dialog-confirm');
      expect(confirmButton).toBeDisabled();
      expect(confirmButton).toHaveAttribute('data-loading', 'true');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero price impact', () => {
      const props = {
        ...defaultProps,
        data: {
          ...defaultData,
          priceImpact: 0,
        },
      };

      render(<DepositConfirmationDialog {...props} />);

      expect(screen.getByText(/0\.00%/)).toBeInTheDocument();
      expect(screen.queryByText(/High price impact/i)).not.toBeInTheDocument();
    });

    it('should handle very small amounts', () => {
      const props = {
        ...defaultProps,
        data: {
          ...defaultData,
          inputAmount: 0.01,
          outputAmount: 0.0123,
          slippage: 10,
        },
      };

      render(<DepositConfirmationDialog {...props} />);

      expect(screen.getByText(/0\.01/)).toBeInTheDocument();
      expect(screen.getByText(/0\.0123/)).toBeInTheDocument();
    });

    it('should sync slippage when dialog reopens', () => {
      const { rerender } = render(
        <DepositConfirmationDialog {...defaultProps} isOpen={false} />
      );

      // Change data and reopen
      const newData = { ...defaultData, slippage: 50 };
      rerender(
        <DepositConfirmationDialog {...defaultProps} data={newData} isOpen={true} />
      );

      // Should show new slippage value (50 bps = 0.50%)
      expect(screen.getByDisplayValue('0.50')).toBeInTheDocument();
    });
  });
});
