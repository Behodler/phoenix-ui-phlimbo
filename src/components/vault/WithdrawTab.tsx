import { useState } from 'react';
import type { WithdrawFormProps } from '../../types/vault';
import AmountDisplay from '../ui/AmountDisplay';
import TokenRow from '../ui/TokenRow';
import AmountInput from '../ui/AmountInput';
import RateInfo from '../ui/RateInfo';
import ActionButton from '../ui/ActionButton';
import WithdrawConfirmationDialog from './WithdrawConfirmationDialog';

export default function WithdrawTab({
  formData,
  onFormChange,
  constants,
  positionInfo,
  onWithdraw,
  isTransacting = false,
}: WithdrawFormProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);

  const parsedAmount = Number(formData.amount) || 0;

  // For withdraw, we burn pxUSD to get DOLA
  // The rate should be inverse of deposit (pxUSD to DOLA)
  const pxUSDToDolaRate = 1 / constants.dolaToPxUSDRate;
  const estDOLA = parsedAmount * pxUSDToDolaRate;
  const minReceived = estDOLA * (1 - formData.slippageBps / 10000);

  // Calculate price impact (mock calculation for demonstration)
  const priceImpact = Math.min(parsedAmount / 10000, 0.1); // Simple price impact based on amount

  const handleAmountChange = (amount: string) => {
    onFormChange({ amount });
  };

  const handleSlippageChange = (slippageBps: number) => {
    onFormChange({ slippageBps });
  };

  const handleMaxClick = () => {
    onFormChange({ amount: positionInfo.value.toString() });
  };

  const handleInitiateWithdraw = () => {
    setShowConfirmation(true);
  };

  const handleConfirmWithdraw = async () => {
    setShowConfirmation(false);
    onWithdraw();
  };

  const handleCancelWithdraw = () => {
    setShowConfirmation(false);
  };

  // Determine button state and properties
  const isAmountValid = parsedAmount > 0 && parsedAmount <= positionInfo.value;
  const buttonDisabled = !isAmountValid || isTransacting;

  let buttonLabel = "Enter Amount";
  let buttonVariant: 'primary' | 'approve' = 'primary';
  let buttonAction = handleInitiateWithdraw;
  let buttonLoading = false;

  if (!isAmountValid && parsedAmount > 0) {
    buttonLabel = "Insufficient pxUSD Balance";
  } else if (isAmountValid) {
    buttonLabel = "Withdraw";
    buttonAction = handleInitiateWithdraw;
    buttonLoading = isTransacting;
  }

  // Create token info for pxUSD (the token being withdrawn)
  const pxUSDTokenInfo = {
    name: "pxUSD",
    balance: positionInfo.value,
    balanceUsd: positionInfo.valueUsd,
  };

  return (
    <>
      <div className="p-6">
        <AmountDisplay amount={parsedAmount} />

        <div className="h-px w-full bg-border mb-6" />

        <TokenRow token={pxUSDTokenInfo} onMaxClick={handleMaxClick} />

        <AmountInput
          amount={formData.amount}
          onAmountChange={handleAmountChange}
          onMaxClick={handleMaxClick}
        />

        <RateInfo
          constants={{
            dolaToPxUSDRate: pxUSDToDolaRate, // Use inverse rate for withdraw
          }}
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

      <WithdrawConfirmationDialog
        isOpen={showConfirmation}
        onClose={handleCancelWithdraw}
        onConfirm={handleConfirmWithdraw}
        isLoading={isTransacting}
        data={{
          inputAmount: parsedAmount,
          inputToken: 'pxUSD',
          outputAmount: estDOLA,
          outputToken: 'DOLA',
          priceImpact: priceImpact,
          slippage: formData.slippageBps,
        }}
      />
    </>
  );
}