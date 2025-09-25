import { useState } from 'react';
import type { DepositFormProps } from '../../types/vault';
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
  onApprove
}: DepositFormProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const parsedAmount = Number(formData.amount) || 0;
  const estPxUSD = parsedAmount * constants.dolaToPxUSDRate;
  const minReceived = estPxUSD * (1 - formData.slippageBps / 10000);

  // Calculate price impact (mock calculation for demonstration)
  const priceImpact = Math.min(parsedAmount / 10000, 0.1); // Simple price impact based on amount

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

  const handleConfirmDeposit = async () => {
    setShowConfirmation(false);
    onDeposit();
  };

  const handleCancelDeposit = () => {
    setShowConfirmation(false);
  };

  // Determine button state and properties
  const isAmountValid = parsedAmount > 0 && parsedAmount <= tokenInfo.balance;
  const buttonDisabled = !isAmountValid || isTransacting || isApproving;

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

        <TokenRow token={tokenInfo} onMaxClick={handleMaxClick} />

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
          outputAmount: estPxUSD,
          outputToken: 'pxUSD',
          priceImpact: priceImpact,

          slippage: formData.slippageBps,
        }}
      />
    </>
  );
}