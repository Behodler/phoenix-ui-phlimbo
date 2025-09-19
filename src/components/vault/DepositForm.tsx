import type { DepositFormProps } from '../../types/vault';
import AmountDisplay from '../ui/AmountDisplay';
import TokenRow from '../ui/TokenRow';
import AmountInput from '../ui/AmountInput';
import AutoStakeToggle from '../ui/AutoStakeToggle';
import RateInfo from '../ui/RateInfo';
import ActionButton from '../ui/ActionButton';

export default function DepositForm({
  formData,
  onFormChange,
  constants,
  tokenInfo,
  onDeposit
}: DepositFormProps) {
  const parsedAmount = Number(formData.amount) || 0;
  const estAutoDola = parsedAmount * constants.dolaToAutoDolaRate;
  const minReceived = estAutoDola * (1 - formData.slippageBps / 10000);

  const handleAmountChange = (amount: string) => {
    onFormChange({ amount });
  };

  const handleAutoStakeToggle = (autoStake: boolean) => {
    onFormChange({ autoStake });
  };

  const handleSlippageChange = (slippageBps: number) => {
    onFormChange({ slippageBps });
  };

  const handleMaxClick = () => {
    onFormChange({ amount: tokenInfo.balance.toString() });
  };

  return (
    <div className="p-6">
      <AmountDisplay amount={parsedAmount} />

      <div className="h-px w-full bg-neutral-800 mb-6" />

      <TokenRow token={tokenInfo} onMaxClick={handleMaxClick} />

      <AmountInput
        amount={formData.amount}
        onAmountChange={handleAmountChange}
        onMaxClick={handleMaxClick}
      />

      <AutoStakeToggle
        autoStake={formData.autoStake}
        onToggle={handleAutoStakeToggle}
      />

      <RateInfo
        constants={constants}
        slippageBps={formData.slippageBps}
        onSlippageChange={handleSlippageChange}
        minReceived={minReceived}
      />

      <ActionButton
        disabled={!parsedAmount}
        onAction={onDeposit}
        label="Deposit"
      />
    </div>
  );
}