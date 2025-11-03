import { useState } from 'react';
import { useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import type { WithdrawFormProps } from '../../types/vault';
import { behodler3TokenlaunchAbi } from '@behodler/wagmi-hooks';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import { safeMaxForDisplay } from '../../utils/bigIntDisplay';
import AmountDisplay from '../ui/AmountDisplay';
import TokenRow from '../ui/TokenRow';
import AmountInput from '../ui/AmountInput';
import RateInfo from '../ui/RateInfo';
import ActionButton from '../ui/ActionButton';
import WithdrawConfirmationDialog from './WithdrawConfirmationDialog';
import phUSD from "../../assets/phUSD.png"

export default function WithdrawTab({
  formData,
  onFormChange,
  constants,
  positionInfo,
  onWithdraw,
  isTransacting = false,
  withdrawalFeeRate = 0, // Default to 2% if not provided
  needsApproval = false, // Whether bonding token approval is needed
  onApprove, // Callback for bonding token approval
  isAllowanceLoading = false, // Whether allowance is still loading
}: WithdrawFormProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Get contract addresses for bonding curve
  const { addresses } = useContractAddresses();

  // Parse amount directly from string to BigInt, avoiding Number precision loss
  const inputAmountWei = formData.amount && formData.amount !== '0' && formData.amount !== ''
    ? parseUnits(formData.amount, 18)
    : 0n;

  // For display purposes only - use parseFloat sparingly
  const parsedAmountForDisplay = parseFloat(formData.amount) || 0;

  // Calculate withdrawal fee using BigInt arithmetic to maintain precision
  const feeAmountWei = (inputAmountWei * BigInt(Math.floor(withdrawalFeeRate * 1e18))) / BigInt(1e18);
  const amountAfterFeeWei = inputAmountWei - feeAmountWei;

  // Convert to decimal for display (fee amount and amount after fee)
  const feeAmount = parseFloat(formatUnits(feeAmountWei, 18));
  const amountAfterFee = parseFloat(formatUnits(amountAfterFeeWei, 18));

  // Fetch expected DOLA output from bonding curve contract
  const { data: expectedOutputWei, isLoading: isQuoteLoading } = useReadContract({
    address: addresses?.bondingCurve as `0x${string}` | undefined,
    abi: behodler3TokenlaunchAbi,
    functionName: 'quoteRemoveLiquidity',
    args: [amountAfterFeeWei],
    query: {
      enabled: !!addresses?.bondingCurve && amountAfterFeeWei > 0n,
    },
  });

  // Calculate estimated DOLA and price impact using real contract data
  let estDOLA: number;
  let priceImpact: number;

  if (expectedOutputWei && amountAfterFee > 0 && constants.dolaToPhUSDRate > 0) {
    // Convert contract output from wei to decimal
    estDOLA = parseFloat(formatUnits(expectedOutputWei, 18));

    // Calculate price impact:
    // 1. Calculate what we WOULD get at current marginal price (no slippage)
    // For withdraw: phUSD amount × marginal price = theoretical DOLA output
    const theoreticalOutput = amountAfterFee * constants.dolaToPhUSDRate;

    // 2. Compare actual output from bonding curve to theoretical output
    // Price impact = (theoretical - actual) / theoretical
    priceImpact = (theoreticalOutput - estDOLA) / theoreticalOutput;

    // Ensure price impact is non-negative and capped at 100%
    priceImpact = Math.max(0, Math.min(priceImpact, 1.0));
  } else {
    // Fallback calculation when contract data not available
    estDOLA = constants.dolaToPhUSDRate > 0
      ? amountAfterFee * constants.dolaToPhUSDRate
      : 0;
    priceImpact = 0; // No price impact data available
  }

  const minReceived = estDOLA * (1 - formData.slippageBps / 10000);

  const handleAmountChange = (amount: string) => {
    onFormChange({ amount });
  };

  const handleSlippageChange = (slippageBps: number) => {
    onFormChange({ slippageBps });
  };

  const handleMaxClick = () => {
    // Use raw BigInt value if available to maintain precision
    if (positionInfo.valueRaw !== undefined) {
      // Subtract 1 wei to ensure we never round up
      const truncatedValueWei = positionInfo.valueRaw - BigInt(1);
      // Use safe display truncation to prevent validation errors
      // This reduces precision just enough to ensure the displayed value
      // can safely round-trip through JavaScript Number conversions
      const displayValue = safeMaxForDisplay(truncatedValueWei, 18);
      onFormChange({ amount: displayValue });
    } else {
      // Fallback to previous flooring logic if raw value not available
      const flooredValue = Math.floor(positionInfo.value * 1e18) / 1e18;
      onFormChange({ amount: flooredValue.toString() });
    }
  };

  const handleInitiateWithdraw = () => {
    setShowConfirmation(true);
  };

  const handleConfirmWithdraw = async (slippageBps: number) => {
    // Update the slippage in form data if it changed
    if (slippageBps !== formData.slippageBps) {
      onFormChange({ slippageBps });
    }
    setShowConfirmation(false);
    // Pass bonding curve output to parent for accurate minReceived calculation
    onWithdraw(estDOLA);
  };

  const handleCancelWithdraw = () => {
    setShowConfirmation(false);
  };

  // Determine button state and properties
  // Validate that user has sufficient balance for the withdrawal amount
  // Validate against the maximum value that the max button would produce
  // This ensures max button values always pass validation
  const maxAllowedWei = positionInfo.valueRaw !== undefined
    ? parseUnits(safeMaxForDisplay(positionInfo.valueRaw - 1n, 18), 18)
    : parseUnits(String(positionInfo.value), 18);

  const isAmountValid = inputAmountWei > 0n && inputAmountWei <= maxAllowedWei;
  const buttonDisabled = !isAmountValid || isTransacting || isQuoteLoading || isAllowanceLoading;

  let buttonLabel = "Enter Amount";
  let buttonVariant: 'primary' | 'approve' = 'primary';
  let buttonAction = handleInitiateWithdraw;
  let buttonLoading = false;

  if (inputAmountWei > 0n) {
    if (!isAmountValid) {
      buttonLabel = "Insufficient phUSD Balance";
    } else if (isAllowanceLoading) {
      buttonLabel = "Loading...";
      buttonLoading = true;
    } else if (needsApproval && onApprove) {
      // Show approve button when bonding token allowance is insufficient
      buttonLabel = "Approve phUSD";
      buttonVariant = 'approve';
      buttonAction = onApprove;
      buttonLoading = isTransacting;
    } else if (isAmountValid) {
      buttonLabel = "Withdraw";
      buttonAction = handleInitiateWithdraw;
      buttonLoading = isTransacting;
    }
  }

  // Create token info for phUSD (the token being withdrawn)
  const phUSDTokenInfo = {
    name: "phUSD",
    balance: positionInfo.value,
    balanceUsd: positionInfo.valueUsd,
    icon:phUSD
  };

  return (
    <>
      <div className="p-6">
        <AmountDisplay amount={parsedAmountForDisplay} />

        <div className="h-px w-full bg-border mb-6" />

        <TokenRow token={phUSDTokenInfo} />

        <AmountInput
          amount={formData.amount}
          onAmountChange={handleAmountChange}
          onMaxClick={handleMaxClick}
        />

        {/* Fee Information Display - Only show when fee is non-zero */}
        {inputAmountWei > 0n && withdrawalFeeRate !== 0 && (
          <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-3 sm:p-4 mb-4">
            <div className="text-sm font-medium text-pxusd-orange-300 mb-2">Withdrawal Fee</div>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between items-start">
                <span className="text-foreground flex-shrink-0">Fee ({(withdrawalFeeRate * 100).toFixed(1)}%)</span>
                <span className="font-medium text-pxusd-pink-400 text-right ml-2">{feeAmount.toFixed(4)} {phUSDTokenInfo.name}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-foreground flex-shrink-0">You'll receive</span>
                <span className="font-medium text-pxusd-yellow-400 text-right ml-2">{estDOLA.toFixed(4)} DOLA</span>
              </div>
            </div>
          </div>
        )}

        <RateInfo
          constants={constants}
          slippageBps={formData.slippageBps}
          onSlippageChange={handleSlippageChange}
          minReceived={minReceived}
          invertRate={true}
          outputToken="DOLA"
        />

        <ActionButton
          disabled={buttonDisabled}
          onAction={buttonAction}
          label={buttonLabel}
          variant={buttonVariant}
          isLoading={buttonLoading}
        />
      </div>

      <WithdrawConfirmationDialog
        isOpen={showConfirmation}
        onClose={handleCancelWithdraw}
        onConfirm={handleConfirmWithdraw}
        isLoading={isTransacting}
        data={{
          inputAmount: parsedAmountForDisplay,
          inputToken: 'phUSD',
          outputAmount: estDOLA,
          outputToken: 'DOLA',
          priceImpact: priceImpact,
          slippage: formData.slippageBps,
          feeAmount: feeAmount,
          feeRate: withdrawalFeeRate,
          amountAfterFee: amountAfterFee,
          marginalPrice: constants.dolaToPhUSDRate, // Current marginal price from bonding curve
        }}
      />
    </>
  );
}