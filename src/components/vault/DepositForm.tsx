import { useState } from 'react';
import { useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import type { DepositFormProps } from '../../types/vault';
import { behodler3TokenlaunchAbi } from '@behodler/wagmi-hooks';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import { safeMaxForDisplay } from '../../utils/bigIntDisplay';
import AmountDisplay from '../ui/AmountDisplay';
import TokenRow from '../ui/TokenRow';
import AmountInput from '../ui/AmountInput';
import RateInfo from '../ui/RateInfo';
import ActionButton from '../ui/ActionButton';
import DepositConfirmationDialog from './DepositConfirmationDialog';
import { log } from '../../utils/logger';

export default function DepositForm({
  formData,
  onFormChange,
  constants,
  tokenInfo,
  onDeposit,
  isTransacting = false,
  needsApproval = false,
  onApprove,
  isAllowanceLoading = false,
  isPaused = false
}: DepositFormProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  // Get contract addresses for bonding curve
  const { addresses } = useContractAddresses();

  // Validate input and parse to BigInt with error handling
  let inputAmountWei = 0n;
  let parseError = false;

  if (formData.amount && formData.amount !== '0' && formData.amount !== '') {
    try {
      inputAmountWei = parseUnits(formData.amount, 18);
    } catch (error) {
      // Handle parsing errors gracefully without crashing
      parseError = true;
      log.warn('Failed to parse amount:', formData.amount, error);
    }
  }

  // For display purposes only - use parseFloat sparingly
  const parsedAmountForDisplay = parseFloat(formData.amount) || 0;

  // Fetch expected bonding tokens output from bonding curve contract
  const { data: expectedOutputWei } = useReadContract({
    address: addresses?.bondingCurve as `0x${string}` | undefined,
    abi: behodler3TokenlaunchAbi,
    functionName: 'quoteAddLiquidity',
    args: [inputAmountWei],
    query: {
      enabled: !!addresses?.bondingCurve && inputAmountWei > 0n,
    },
  });

  // Calculate estimated phUSD and price impact using real contract data
  let estPhUSD: number;
  let priceImpact: number;

  if (expectedOutputWei && inputAmountWei > 0n && constants.dolaToPhUSDRate > 0) {
    // Convert contract output from wei to decimal
    estPhUSD = parseFloat(formatUnits(expectedOutputWei, 18));

    // Calculate price impact:
    // 1. Calculate what we WOULD get at current marginal price (no slippage)
    const theoreticalOutput = parsedAmountForDisplay / constants.dolaToPhUSDRate;

    // 2. Compare actual output from bonding curve to theoretical output
    // Price impact = (theoretical - actual) / theoretical
    priceImpact = (theoreticalOutput - estPhUSD) / theoreticalOutput;

    // Ensure price impact is non-negative and capped at 100%
    priceImpact = Math.max(0, Math.min(priceImpact, 1.0));
  } else {
    // Fallback calculation when contract data not available
    estPhUSD = constants.dolaToPhUSDRate > 0
      ? parsedAmountForDisplay / constants.dolaToPhUSDRate
      : 0;
    priceImpact = 0; // No price impact data available
  }

  const minReceived = estPhUSD * (1 - formData.slippageBps / 10000);

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

  const handleAmountChange = (amount: string) => {
    // Trim whitespace
    const trimmedAmount = amount.trim();

    // Validate input
    const error = validateInput(trimmedAmount);
    setValidationError(error);

    // Always update the form to allow user to see what they're typing
    // But validation error will prevent submission
    onFormChange({ amount: trimmedAmount });
  };

  const handleSlippageChange = (slippageBps: number) => {
    onFormChange({ slippageBps });
  };

  const handleMaxClick = () => {
    // Use raw BigInt balance if available to maintain precision
    if (tokenInfo.balanceRaw !== undefined) {
      // Subtract 1 wei to ensure we never round up
      const truncatedBalanceWei = tokenInfo.balanceRaw - BigInt(1);
      // Use safe display truncation to prevent validation errors
      // This reduces precision just enough to ensure the displayed value
      // can safely round-trip through JavaScript Number conversions
      const displayValue = safeMaxForDisplay(truncatedBalanceWei, 18);
      log.debug('MAX CLICKED - safeMaxForDisplay returned:', displayValue);
      log.debug('MAX CLICKED - truncatedBalanceWei:', truncatedBalanceWei.toString());
      onFormChange({ amount: displayValue });
    } else {
      // Fallback to previous flooring logic if raw balance not available
      const flooredBalance = Math.floor(tokenInfo.balance * 1e18) / 1e18;
      log.debug('MAX CLICKED - fallback value:', flooredBalance.toString());
      onFormChange({ amount: flooredBalance.toString() });
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

  const handleConfirmDeposit = async (slippageBps: number) => {
    // Update the slippage in form data if it changed
    if (slippageBps !== formData.slippageBps) {
      onFormChange({ slippageBps });
    }
    setShowConfirmation(false);
    // Pass bonding curve output to parent for accurate minReceived calculation
    onDeposit(estPhUSD);
  };

  const handleCancelDeposit = () => {
    setShowConfirmation(false);
  };

  // Determine button state and properties
  // Validate against the maximum value that the max button would produce
  // This ensures max button values always pass validation
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
      buttonLabel = "Deposit";
      buttonAction = handleInitiateDeposit;
      buttonLoading = isTransacting;
    }
  }

  return (
    <>
      <div className="p-6">
        <AmountDisplay amount={parsedAmountForDisplay} showDollarEstimate={true} />

        <div className="h-px w-full bg-border mb-6" />

        <TokenRow token={tokenInfo} />

        <AmountInput
          amount={formData.amount}
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

        <RateInfo
          constants={constants}
          slippageBps={formData.slippageBps}
          onSlippageChange={handleSlippageChange}
          minReceived={minReceived}
        />

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

      <DepositConfirmationDialog
        isOpen={showConfirmation}
        onClose={handleCancelDeposit}
        onConfirm={handleConfirmDeposit}
        isLoading={isTransacting}
        data={{
          inputAmount: parsedAmountForDisplay,
          inputToken: 'DOLA',
          outputAmount: estPhUSD,
          outputToken: 'phUSD',
          priceImpact: priceImpact,
          slippage: formData.slippageBps,
          marginalPrice: constants.dolaToPhUSDRate, // Current marginal price from bonding curve
        }}
      />
    </>
  );
}