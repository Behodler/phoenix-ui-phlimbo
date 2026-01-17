import { useState } from 'react';
import { parseUnits, formatUnits } from 'viem';
import { safeMaxForDisplay } from '../../utils/bigIntDisplay';
import AmountDisplay from '../ui/AmountDisplay';
import AmountInput from '../ui/AmountInput';
import ActionButton from '../ui/ActionButton';
import WithdrawFromYieldConfirmationDialog from './WithdrawFromYieldConfirmationDialog';
import { log } from '../../utils/logger';
import phUSD from "../../assets/phUSD.png";

// Props interface for WithdrawFromYieldForm
export interface WithdrawFromYieldFormProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  onWithdraw: () => void | Promise<void>;  // Can be sync or async
  isTransacting?: boolean;
  isPaused?: boolean;
  // Real data props from DepositView polling
  stakedBalance: bigint;  // User's staked phUSD amount (18 decimals)
  pendingPhUsdRewards: bigint;  // Pending phUSD yield (18 decimals)
  pendingStableRewards: bigint;  // Pending USDC yield (6 decimals)
  onRefresh?: () => void;  // Callback to trigger data refresh after transaction
}

export default function WithdrawFromYieldForm({
  amount,
  onAmountChange,
  onWithdraw,
  isTransacting = false,
  isPaused = false,
  stakedBalance,
  pendingPhUsdRewards,
  pendingStableRewards,
  onRefresh: _onRefresh  // Currently unused - refresh is called in VaultPage's handleWithdrawFromYield
}: WithdrawFromYieldFormProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  // Convert bigint values to display numbers
  const stakedBalanceDisplay = Number(formatUnits(stakedBalance, 18));
  const pendingPhUsdDisplay = Number(formatUnits(pendingPhUsdRewards, 18));
  const pendingStableDisplay = Number(formatUnits(pendingStableRewards, 6));  // USDC has 6 decimals

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

  // Calculate proportional yield based on withdrawal percentage
  const withdrawalPercentage = parsedAmountForDisplay > 0 && stakedBalanceDisplay > 0
    ? Math.min(parsedAmountForDisplay / stakedBalanceDisplay, 1)
    : 0;

  // Calculate proportional yield amounts using real data
  const proportionalPhUsdYield = pendingPhUsdDisplay * withdrawalPercentage;
  const proportionalUsdcYield = pendingStableDisplay * withdrawalPercentage;
  const totalPhUsdToReceive = parsedAmountForDisplay + proportionalPhUsdYield;

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
    // Subtract 1 wei to ensure we never round up (handle zero balance case)
    const truncatedBalanceWei = stakedBalance > 0n ? stakedBalance - 1n : 0n;
    // Use safe display truncation to prevent validation errors
    const displayValue = safeMaxForDisplay(truncatedBalanceWei, 18);
    log.debug('MAX CLICKED - safeMaxForDisplay returned:', displayValue);
    onAmountChange(displayValue);
  };

  const handleInitiateWithdraw = () => {
    setShowConfirmation(true);
  };

  const handleConfirmWithdraw = async () => {
    setShowConfirmation(false);
    await onWithdraw();
  };

  const handleCancelWithdraw = () => {
    setShowConfirmation(false);
  };

  // Determine button state and properties
  // Validate against the maximum value that the max button would produce (handle zero balance case)
  const maxAllowedWei = stakedBalance > 0n
    ? parseUnits(safeMaxForDisplay(stakedBalance - 1n, 18), 18)
    : 0n;

  const isAmountValid = inputAmountWei > 0n && inputAmountWei <= maxAllowedWei;
  const hasValidationError = validationError !== '' || parseError;
  const buttonDisabled = !isAmountValid || hasValidationError || isTransacting;

  let buttonLabel = "Enter Amount";
  const buttonVariant: 'primary' | 'approve' = 'primary';
  let buttonAction = handleInitiateWithdraw;
  let buttonLoading = false;

  if (!isAmountValid && inputAmountWei > 0n) {
    buttonLabel = "Insufficient Balance";
  } else if (isAmountValid) {
    buttonLabel = "Withdraw";
    buttonAction = handleInitiateWithdraw;
    buttonLoading = isTransacting;
  }

  // Format number for display
  const formatNumber = (num: number, decimals = 4) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <>
      <div className="p-6">
        {/* Yield Withdraw Header */}
        <div className="bg-pxusd-teal-700 border border-pxusd-teal-500 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-pxusd-teal-300 mb-1">Withdraw & Claim Yield</h3>
          <p className="text-sm text-muted-foreground">
            Withdraw your staked phUSD and claim earned yield in phUSD and USDC
          </p>
        </div>

        <AmountDisplay amount={parsedAmountForDisplay} showDollarEstimate={true} />

        <div className="h-px w-full bg-border mb-6" />

        {/* Staked Balance Display */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img
              src={phUSD}
              alt="phUSD icon"
              className="h-10 w-10 rounded-full flex-shrink-0 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-foreground">phUSD (Staked)</div>
              <div className="text-xs sm:text-sm text-muted-foreground break-words">
                Staked {formatNumber(stakedBalanceDisplay)} (${formatNumber(stakedBalanceDisplay)})
              </div>
            </div>
          </div>
        </div>

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

        {/* Receive Breakdown Section */}
        {parsedAmountForDisplay > 0 && !hasValidationError && (
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <div className="text-sm font-semibold text-foreground mb-3">Receive Breakdown</div>

            {/* phUSD Breakdown */}
            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Principal (phUSD)</span>
                <span className="text-foreground">{formatNumber(parsedAmountForDisplay)} phUSD</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">+ Earned Yield (phUSD)</span>
                <span className="text-pxusd-teal-300">+{formatNumber(proportionalPhUsdYield)} phUSD</span>
              </div>
              <div className="h-px w-full bg-border my-2" />
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-foreground">Total phUSD</span>
                <span className="text-pxusd-teal-300">{formatNumber(totalPhUsdToReceive)} phUSD</span>
              </div>
            </div>

            {/* USDC Yield */}
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">+ Earned Yield (USDC)</span>
                <span className="text-pxusd-teal-300">+{formatNumber(proportionalUsdcYield)} USDC</span>
              </div>
            </div>
          </div>
        )}

        {/* Conditionally render button or pause message based on pause state */}
        {isPaused === true ? (
          <div className="bg-pxusd-orange-900/20 border border-pxusd-orange-500 rounded-lg p-4 text-center">
            <p className="text-pxusd-orange-300 font-semibold">Protocol Paused</p>
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

      <WithdrawFromYieldConfirmationDialog
        isOpen={showConfirmation}
        onClose={handleCancelWithdraw}
        onConfirm={handleConfirmWithdraw}
        isLoading={isTransacting}
        principalAmount={parsedAmountForDisplay}
        phUsdYield={proportionalPhUsdYield}
        usdcYield={proportionalUsdcYield}
        totalPhUsd={totalPhUsdToReceive}
      />
    </>
  );
}
