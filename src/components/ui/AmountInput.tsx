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
        className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-lime-400/30"
      />
      <button
        onClick={onMaxClick}
        className="rounded-xl bg-neutral-800 px-4 py-3 text-sm text-neutral-200 hover:bg-neutral-700"
      >
        MAX
      </button>
    </div>
  );
}