import type { AmountInputProps } from '../../types/vault';

export default function AmountInput({ amount, onAmountChange, onMaxClick, isInvalid = false }: AmountInputProps) {
  return (
    <div className="flex gap-3 mb-5">
      <input
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        placeholder="ENTER AN AMOUNT"
        aria-invalid={isInvalid || undefined}
        style={isInvalid ? { borderColor: 'rgba(255,77,109,.6)' } : undefined}
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