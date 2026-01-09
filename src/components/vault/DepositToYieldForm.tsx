import { useState } from 'react';
import { parseUnits } from 'viem';
import type { TokenInfo } from '../../types/vault';
import { safeMaxForDisplay } from '../../utils/bigIntDisplay';
import AmountDisplay from '../ui/AmountDisplay';
import TokenRow from '../ui/TokenRow';
import AmountInput from '../ui/AmountInput';
import ActionButton from '../ui/ActionButton';
import DepositToYieldConfirmationDialog from './DepositToYieldConfirmationDialog';
import { log } from '../../utils/logger';

// Props interface for DepositToYieldForm - simplified from MintForm
export interface DepositToYieldFormProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  tokenInfo: TokenInfo;
  onDeposit: () => void;
  isTransacting?: boolean;
  needsApproval?: boolean;
  onApprove?: () => void;
  isAllowanceLoading?: boolean;
  isPaused?: boolean;
}

export default function DepositToYieldForm({
  amount,
  onAmountChange,
  tokenInfo,
  onDeposit,
  isTransacting = false,
  needsApproval = false,
  onApprove,
  isAllowanceLoading = false,
  isPaused = false
}: DepositToYieldFormProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  // Validate input and parse to BigInt with error handling
  let inputAmountWei = 0n;
  let parseError = false;

  if (amount && amount !== '0' && amount !== '') {
    try {
      inputAmountWei = parseUnits(amount, 18);
    } catch (error) {
      // Handle parsing errors gracefully without crashing
      parseError = true;
      log.warn('Failed to parse amount:', amount, error);
    }
  }

  // For display purposes only - use parseFloat sparingly
  const parsedAmountForDisplay = parseFloat(amount) || 0;

  // Validate input format and decimal places
  const validateInput = (value: string): string => {
    // Allow empty string
    if (value === '') {
      return '';
    }

    // Check for invalid characters (allow only digits, one decimal point, and leading minus)
    if (!/^-?\d*\.?\d*$/.test(value)) {
      return 'Please enter a valid number';
    }

    // Check for negative numbers
    if (value.startsWith('-')) {
      return 'Please enter a positive number';
    }

    // Check for multiple decimal points
    if ((value.match(/\./g) || []).length > 1) {
      return 'Please enter a valid number';
    }

    // Check decimal places (maximum 4)
    const decimalIndex = value.indexOf('.');
    if (decimalIndex !== -1) {
      const decimalPlaces = value.length - decimalIndex - 1;
      if (decimalPlaces > 4) {
        return 'Maximum 4 decimal places allowed';
      }
    }

    // Check for exponential notation
    if (/[eE]/.test(value)) {
      return 'Please enter a valid number';
    }

    return '';
  };

  const handleAmountChange = (newAmount: string) => {
    // Trim whitespace
    const trimmedAmount = newAmount.trim();

    // Validate input
    const error = validateInput(trimmedAmount);
    setValidationError(error);

    // Always update the form to allow user to see what they're typing
    // But validation error will prevent submission
    onAmountChange(trimmedAmount);
  };

  const handleMaxClick = () => {
    // Use raw BigInt balance if available to maintain precision
    if (tokenInfo.balanceRaw !== undefined) {
      // Subtract 1 wei to ensure we never round up
      const truncatedBalanceWei = tokenInfo.balanceRaw - BigInt(1);
      // Use safe display truncation to prevent validation errors
      const displayValue = safeMaxForDisplay(truncatedBalanceWei, 18);
      log.debug('MAX CLICKED - safeMaxForDisplay returned:', displayValue);
      log.debug('MAX CLICKED - truncatedBalanceWei:', truncatedBalanceWei.toString());
      onAmountChange(displayValue);
    } else {
      // Fallback to previous flooring logic if raw balance not available
      const flooredBalance = Math.floor(tokenInfo.balance * 1e18) / 1e18;
      log.debug('MAX CLICKED - fallback value:', flooredBalance.toString());
      onAmountChange(flooredBalance.toString());
    }
  };

  const handleApprove = async () => {
    if (onApprove) {
      setIsApproving(true);
      try {
        await onApprove();
      } finally {
        setIsApproving(false);
      }
    }
  };

  const handleInitiateDeposit = () => {
    setShowConfirmation(true);
  };

  const handleConfirmDeposit = async () => {
    setShowConfirmation(false);
    onDeposit();
  };

  const handleCancelDeposit = () => {
    setShowConfirmation(false);
  };

  // Determine button state and properties
  // Validate against the maximum value that the max button would produce
  const maxAllowedWei = tokenInfo.balanceRaw !== undefined
    ? parseUnits(safeMaxForDisplay(tokenInfo.balanceRaw - 1n, 18), 18)
    : parseUnits(String(tokenInfo.balance), 18);

  const isAmountValid = inputAmountWei > 0n && inputAmountWei <= maxAllowedWei;
  const hasValidationError = validationError !== '' || parseError;
  const buttonDisabled = !isAmountValid || hasValidationError || isTransacting || isApproving || isAllowanceLoading;

  let buttonLabel = "Enter Amount";
  let buttonVariant: 'primary' | 'approve' = 'primary';
  let buttonAction = handleInitiateDeposit;
  let buttonLoading = false;

  if (!isAmountValid && inputAmountWei > 0n) {
    buttonLabel = "Insufficient Balance";
  } else if (isAmountValid) {
    if (needsApproval) {
      buttonLabel = "Approve DOLA";
      buttonVariant = 'approve';
      buttonAction = handleApprove;
      buttonLoading = isApproving;
    } else {
      buttonLabel = "Deposit to Earn Yield";
      buttonAction = handleInitiateDeposit;
      buttonLoading = isTransacting;
    }
  }

  return (
    <>
      <div className="p-6">
        {/* Yield Deposit Header */}
        <div className="bg-pxusd-teal-700 border border-pxusd-teal-500 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-pxusd-teal-300 mb-1">Deposit to Earn Yield</h3>
          <p className="text-sm text-muted-foreground">
            Deposit your DOLA to earn yield in both phUSD and USDC
          </p>
        </div>

        <AmountDisplay amount={parsedAmountForDisplay} showDollarEstimate={true} />

        <div className="h-px w-full bg-border mb-6" />

        <TokenRow token={tokenInfo} />

        <AmountInput
          amount={amount}
          onAmountChange={handleAmountChange}
          onMaxClick={handleMaxClick}
        />

        {/* Validation Error Display */}
        {validationError && (
          <div className="text-sm text-red-500 mb-4 -mt-3">
            {validationError}
          </div>
        )}

        {/* Parse Error Display */}
        {parseError && !validationError && (
          <div className="text-sm text-red-500 mb-4 -mt-3">
            Please enter a valid number
          </div>
        )}

        {/* No rate info section - this is a direct deposit, not a mint/exchange */}

        {/* Conditionally render button or pause message based on pause state */}
        {isPaused === true ? (
          <div className="bg-pxusd-orange-900/20 border border-pxusd-orange-500 rounded-lg p-4 text-center">
            <p className="text-pxusd-orange-300 font-semibold">Phoenix is currently paused</p>
          </div>
        ) : (
          <ActionButton
            disabled={buttonDisabled}
            onAction={buttonAction}
            label={buttonLabel}
            variant={buttonVariant}
            isLoading={buttonLoading}
          />
        )}
      </div>

      <DepositToYieldConfirmationDialog
        isOpen={showConfirmation}
        onClose={handleCancelDeposit}
        onConfirm={handleConfirmDeposit}
        isLoading={isTransacting}
        depositAmount={parsedAmountForDisplay}
      />
    </>
  );
}
