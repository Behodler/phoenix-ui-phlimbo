import type { AmountDisplayProps } from '../../types/vault';

export default function AmountDisplay({ amount }: AmountDisplayProps) {
  return (
    <div className="mb-6">
      <div className="text-6xl font-light tracking-tight">
        {amount.toFixed(2)}
      </div>
      <div className="text-neutral-400">
        ${amount.toFixed(2)}
      </div>
    </div>
  );
}