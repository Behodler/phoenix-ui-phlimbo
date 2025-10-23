import { useState } from 'react';
import { useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import type { WithdrawFormProps } from '../../types/vault';
import { behodler3TokenlaunchAbi } from '@behodler/wagmi-hooks';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
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
  withdrawalFeeRate = 0.02, // Default to 2% if not provided
}: WithdrawFormProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Get contract addresses for bonding curve
  const { addresses } = useContractAddresses();

  const parsedAmount = Number(formData.amount) || 0;

  // Calculate withdrawal fee (using dynamic rate from contract)
  const feeAmount = parsedAmount * withdrawalFeeRate;
  const amountAfterFee = parsedAmount - feeAmount;

  // Convert phUSD amount after fee to wei for contract call
  const inputAmountWei = amountAfterFee > 0 ? parseUnits(amountAfterFee.toString(), 18) : 0n;

  // Fetch expected DOLA output from bonding curve contract
  const { data: expectedOutputWei, isLoading: isQuoteLoading } = useReadContract({
    address: addresses?.bondingCurve as `0x${string}` | undefined,
    abi: behodler3TokenlaunchAbi,
    functionName: 'quoteRemoveLiquidity',
    args: [inputAmountWei],
    query: {
      enabled: !!addresses?.bondingCurve && amountAfterFee > 0,
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
    // Set max amount to the full available balance
    // User will see the fee deduction in the confirmation
    onFormChange({ amount: positionInfo.value.toString() });
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
  // Validate that user has sufficient balance for the withdrawal amount (fee is deducted from output)
  const isAmountValid = parsedAmount > 0 && parsedAmount <= positionInfo.value;
  const buttonDisabled = !isAmountValid || isTransacting || isQuoteLoading;

  let buttonLabel = "Enter Amount";
  let buttonVariant: 'primary' | 'approve' = 'primary';
  let buttonAction = handleInitiateWithdraw;
  let buttonLoading = false;

  if (parsedAmount > 0) {
    if (parsedAmount > positionInfo.value) {
      buttonLabel = "Insufficient phUSD Balance";
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
        <AmountDisplay amount={parsedAmount} />

        <div className="h-px w-full bg-border mb-6" />

        <TokenRow token={phUSDTokenInfo} />

        <AmountInput
          amount={formData.amount}
          onAmountChange={handleAmountChange}
          onMaxClick={handleMaxClick}
        />

        {/* Fee Information Display - Only show when fee is non-zero */}
        {parsedAmount > 0 && withdrawalFeeRate !== 0 && (
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
          inputAmount: parsedAmount,
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