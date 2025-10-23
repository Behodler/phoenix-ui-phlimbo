import { useState } from 'react';
import { useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import type { DepositFormProps } from '../../types/vault';
import { behodler3TokenlaunchAbi } from '@behodler/wagmi-hooks';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import AmountDisplay from '../ui/AmountDisplay';
import TokenRow from '../ui/TokenRow';
import AmountInput from '../ui/AmountInput';
import RateInfo from '../ui/RateInfo';
import ActionButton from '../ui/ActionButton';
import DepositConfirmationDialog from './DepositConfirmationDialog';

export default function DepositForm({
  formData,
  onFormChange,
  constants,
  tokenInfo,
  onDeposit,
  isTransacting = false,
  needsApproval = false,
  onApprove,
  isAllowanceLoading = false
}: DepositFormProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Get contract addresses for bonding curve
  const { addresses } = useContractAddresses();

  const parsedAmount = Number(formData.amount) || 0;

  // Convert input amount to wei for contract call
  const inputAmountWei = parsedAmount > 0 ? parseUnits(parsedAmount.toString(), 18) : 0n;

  // Fetch expected bonding tokens output from bonding curve contract
  const { data: expectedOutputWei, isLoading: isQuoteLoading } = useReadContract({
    address: addresses?.bondingCurve as `0x${string}` | undefined,
    abi: behodler3TokenlaunchAbi,
    functionName: 'quoteAddLiquidity',
    args: [inputAmountWei],
    query: {
      enabled: !!addresses?.bondingCurve && parsedAmount > 0,
    },
  });

  // Calculate estimated phUSD and price impact using real contract data
  let estPhUSD: number;
  let priceImpact: number;

  if (expectedOutputWei && parsedAmount > 0 && constants.dolaToPhUSDRate > 0) {
    // Convert contract output from wei to decimal
    estPhUSD = parseFloat(formatUnits(expectedOutputWei, 18));

    // Calculate price impact:
    // 1. Calculate what we WOULD get at current marginal price (no slippage)
    const theoreticalOutput = parsedAmount / constants.dolaToPhUSDRate;

    // 2. Compare actual output from bonding curve to theoretical output
    // Price impact = (theoretical - actual) / theoretical
    priceImpact = (theoreticalOutput - estPhUSD) / theoreticalOutput;

    // Ensure price impact is non-negative and capped at 100%
    priceImpact = Math.max(0, Math.min(priceImpact, 1.0));
  } else {
    // Fallback calculation when contract data not available
    estPhUSD = constants.dolaToPhUSDRate > 0
      ? parsedAmount / constants.dolaToPhUSDRate
      : 0;
    priceImpact = 0; // No price impact data available
  }

  const minReceived = estPhUSD * (1 - formData.slippageBps / 10000);

  const handleAmountChange = (amount: string) => {
    onFormChange({ amount });
  };

  const handleSlippageChange = (slippageBps: number) => {
    onFormChange({ slippageBps });
  };

  const handleMaxClick = () => {
    onFormChange({ amount: tokenInfo.balance.toString() });
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
    onDeposit();
  };

  const handleCancelDeposit = () => {
    setShowConfirmation(false);
  };

  // Determine button state and properties
  const isAmountValid = parsedAmount > 0 && parsedAmount <= tokenInfo.balance;
  const buttonDisabled = !isAmountValid || isTransacting || isApproving || isAllowanceLoading;

  let buttonLabel = "Enter Amount";
  let buttonVariant: 'primary' | 'approve' = 'primary';
  let buttonAction = handleInitiateDeposit;
  let buttonLoading = false;

  if (!isAmountValid && parsedAmount > 0) {
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
        <AmountDisplay amount={parsedAmount} />

        <div className="h-px w-full bg-border mb-6" />

        <TokenRow token={tokenInfo} />

        <AmountInput
          amount={formData.amount}
          onAmountChange={handleAmountChange}
          onMaxClick={handleMaxClick}
        />

        <RateInfo
          constants={constants}
          slippageBps={formData.slippageBps}
          onSlippageChange={handleSlippageChange}
          minReceived={minReceived}
        />

        <ActionButton
          disabled={buttonDisabled}
          onAction={buttonAction}
          label={buttonLabel}
          variant={buttonVariant}
          isLoading={buttonLoading}
        />
      </div>

      <DepositConfirmationDialog
        isOpen={showConfirmation}
        onClose={handleCancelDeposit}
        onConfirm={handleConfirmDeposit}
        isLoading={isTransacting}
        data={{
          inputAmount: parsedAmount,
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