import type { AmountInputProps } from '../../types/vault';

export default function AmountInput({ amount, onAmountChange, onMaxClick }: AmountInputProps) {
  return (
    <div className="flex gap-3 mb-5">
      <input
        type="number"
        inputMode="decimal"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        placeholder="ENTER AN AMOUNT"
        className="w-full rounded-xl border border-input bg-card px-4 py-3 text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        onClick={onMaxClick}
        className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground hover:bg-secondary/80 transition-colors"
      >
        MAX
      </button>
    </div>
  );
}