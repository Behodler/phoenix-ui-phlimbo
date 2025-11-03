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

  // Parse amount directly from string to BigInt, avoiding Number precision loss
  const inputAmountWei = formData.amount && formData.amount !== '0' && formData.amount !== ''
    ? parseUnits(formData.amount, 18)
    : 0n;

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

  const handleAmountChange = (amount: string) => {
    onFormChange({ amount });
  };

  const handleSlippageChange = (slippageBps: number) => {
    onFormChange({ slippageBps });
  };

  const handleMaxClick = () => {
    // Use raw BigInt balance if available to maintain precision
    if (tokenInfo.balanceRaw !== undefined) {
      // Simple truncation: subtract 1 wei to ensure we never round up
      const truncatedBalanceWei = tokenInfo.balanceRaw - BigInt(1);
      // Convert to decimal string with full precision
      const balanceStr = truncatedBalanceWei.toString();
      // Format as decimal (18 decimal places)
      const wholePart = balanceStr.length > 18 ? balanceStr.slice(0, -18) : '0';
      const fractionalPart = balanceStr.length > 18
        ? balanceStr.slice(-18).padStart(18, '0')
        : balanceStr.padStart(18, '0');
      // Combine and remove trailing zeros
      const fullDecimal = `${wholePart}.${fractionalPart}`.replace(/\.?0+$/, '');
      onFormChange({ amount: fullDecimal || '0' });
    } else {
      // Fallback to previous flooring logic if raw balance not available
      const flooredBalance = Math.floor(tokenInfo.balance * 1e18) / 1e18;
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
  // Use BigInt comparison for precision-sensitive validation
  const isAmountValid = inputAmountWei > 0n && (tokenInfo.balanceRaw !== undefined
    ? inputAmountWei <= tokenInfo.balanceRaw
    : parsedAmountForDisplay <= tokenInfo.balance);
  const buttonDisabled = !isAmountValid || isTransacting || isApproving || isAllowanceLoading;

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
        <AmountDisplay amount={parsedAmountForDisplay} />

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