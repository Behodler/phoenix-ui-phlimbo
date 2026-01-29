import { useState, useEffect, useRef } from 'react';
import { parseUnits } from 'viem';
import type { TokenInfo } from '../../types/vault';
import { safeMaxForDisplay } from '../../utils/bigIntDisplay';
import AmountDisplay from '../ui/AmountDisplay';
import AmountInput from '../ui/AmountInput';
import ActionButton from '../ui/ActionButton';
import MintConfirmationDialog from './MintConfirmationDialog';
import { log } from '../../utils/logger';

// Mint token type
type MintTokenType = 'DOLA' | 'USDC';

// Props interface for MintForm - simplified from DepositFormProps
export interface MintFormProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  tokenInfo: TokenInfo;
  onMint: () => void;
  isTransacting?: boolean;
  needsApproval?: boolean;
  onApprove?: () => void;
  isAllowanceLoading?: boolean;
  isPaused?: boolean;
  // New props for token switching
  mintTokenType?: MintTokenType;
  onToggleMintToken?: () => void;
  tokenDecimals?: number;
}

export default function MintForm({
  amount,
  onAmountChange,
  tokenInfo,
  onMint,
  isTransacting = false,
  needsApproval = false,
  onApprove,
  isAllowanceLoading = false,
  isPaused = false,
  mintTokenType = 'DOLA',
  onToggleMintToken,
  tokenDecimals = 18
}: MintFormProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState(false);
  const swapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (swapTimeoutRef.current) {
        clearTimeout(swapTimeoutRef.current);
      }
    };
  }, []);

  // Handle token logo click with animation
  const handleTokenSwap = () => {
    // Prevent rapid clicking during animation
    if (isSwapping || !onToggleMintToken) return;

    setIsSwapping(true);

    // Swap the token at the midpoint of the animation (150ms = half of 300ms)
    swapTimeoutRef.current = setTimeout(() => {
      onToggleMintToken();
    }, 150);

    // Reset swapping state after animation completes
    swapTimeoutRef.current = setTimeout(() => {
      setIsSwapping(false);
    }, 300);
  };

  // Validate input and parse to BigInt with error handling
  let inputAmountWei = 0n;
  let parseError = false;

  if (amount && amount !== '0' && amount !== '') {
    try {
      inputAmountWei = parseUnits(amount, tokenDecimals);
    } catch (error) {
      // Handle parsing errors gracefully without crashing
      parseError = true;
      log.warn('Failed to parse amount:', amount, error);
    }
  }

  // For display purposes only - use parseFloat sparingly
  const parsedAmountForDisplay = parseFloat(amount) || 0;

  // Fixed 1:1 rate - output equals input
  const estPhUSD = parsedAmountForDisplay;

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
      // Use safe display truncation to prevent validation errors (use appropriate decimals)
      const displayValue = safeMaxForDisplay(truncatedBalanceWei, tokenDecimals);
      log.debug('MAX CLICKED - safeMaxForDisplay returned:', displayValue);
      log.debug('MAX CLICKED - truncatedBalanceWei:', truncatedBalanceWei.toString());
      onAmountChange(displayValue);
    } else {
      // Fallback to previous flooring logic if raw balance not available
      const multiplier = Math.pow(10, tokenDecimals);
      const flooredBalance = Math.floor(tokenInfo.balance * multiplier) / multiplier;
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

  const handleInitiateMint = () => {
    setShowConfirmation(true);
  };

  const handleConfirmMint = async () => {
    setShowConfirmation(false);
    onMint();
  };

  const handleCancelMint = () => {
    setShowConfirmation(false);
  };

  // Determine button state and properties
  // Validate against the maximum value that the max button would produce
  const maxAllowedWei = tokenInfo.balanceRaw !== undefined
    ? parseUnits(safeMaxForDisplay(tokenInfo.balanceRaw - 1n, tokenDecimals), tokenDecimals)
    : parseUnits(String(tokenInfo.balance), tokenDecimals);

  const isAmountValid = inputAmountWei > 0n && inputAmountWei <= maxAllowedWei;
  const hasValidationError = validationError !== '' || parseError;
  const buttonDisabled = !isAmountValid || hasValidationError || isTransacting || isApproving || isAllowanceLoading;

  let buttonLabel = "Enter Amount";
  let buttonVariant: 'primary' | 'approve' = 'primary';
  let buttonAction = handleInitiateMint;
  let buttonLoading = false;

  if (!isAmountValid && inputAmountWei > 0n) {
    buttonLabel = "Insufficient Balance";
  } else if (isAmountValid) {
    if (needsApproval) {
      buttonLabel = `Approve ${mintTokenType}`;
      buttonVariant = 'approve';
      buttonAction = handleApprove;
      buttonLoading = isApproving;
    } else {
      buttonLabel = "Mint";
      buttonAction = handleInitiateMint;
      buttonLoading = isTransacting;
    }
  }

  // Format balance for display
  const formatBalance = (balance: number): string => {
    if (balance === 0) return '0.00';
    if (balance < 0.01) return balance.toFixed(4);
    if (balance < 1) return balance.toFixed(3);
    if (balance < 1000) return balance.toFixed(2);
    return balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <>
      <div className="p-6">
        <AmountDisplay amount={parsedAmountForDisplay} showDollarEstimate={true} />

        <div className="h-px w-full bg-border mb-6" />

        {/* Custom token row with clickable logo */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Clickable token logo with animation */}
            <button
              onClick={handleTokenSwap}
              disabled={!onToggleMintToken || isSwapping}
              className="relative focus:outline-none focus:ring-2 focus:ring-primary rounded-full disabled:cursor-default"
              title={onToggleMintToken ? `Click to switch to ${mintTokenType === 'DOLA' ? 'USDC' : 'DOLA'}` : undefined}
            >
              <img
                src={tokenInfo.icon}
                alt={`${tokenInfo.name} icon`}
                className={`h-10 w-10 rounded-full flex-shrink-0 object-cover ${
                  onToggleMintToken ? 'token-logo-clickable' : ''
                } ${isSwapping ? 'animate-token-swap' : ''}`}
              />
              {/* Visual indicator that token is clickable */}
              {onToggleMintToken && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-pxusd-teal-700 rounded-full flex items-center justify-center border border-border">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted-foreground"
                  >
                    <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
                  </svg>
                </div>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-foreground">{tokenInfo.name}</div>
              <div className="text-xs sm:text-sm text-muted-foreground break-words">
                Balance {formatBalance(tokenInfo.balance)} (${formatBalance(tokenInfo.balanceUsd)})
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

        {/* Fixed 1:1 Rate Info - no slippage controls */}
        <div className="space-y-3 text-sm mb-6">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">1 {mintTokenType}</span>
            <span className="font-medium text-foreground">= 1 phUSD</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Receive</span>
            <span className="font-medium text-foreground">
              {estPhUSD > 0 ? estPhUSD.toFixed(4) : "-"} phUSD
            </span>
          </div>
        </div>

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

      <MintConfirmationDialog
        isOpen={showConfirmation}
        onClose={handleCancelMint}
        onConfirm={handleConfirmMint}
        isLoading={isTransacting}
        data={{
          inputAmount: parsedAmountForDisplay,
          inputToken: mintTokenType,
          outputAmount: estPhUSD,
          outputToken: 'phUSD',
        }}
      />
    </>
  );
}
