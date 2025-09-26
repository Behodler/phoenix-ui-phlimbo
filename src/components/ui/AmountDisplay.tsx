import type { AmountDisplayProps } from '../../types/vault';

export default function AmountDisplay({ amount }: AmountDisplayProps) {
  return (
    <div className="mb-6">
      <div className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-foreground">
        {amount.toFixed(2)}
      </div>
      <div className="text-muted-foreground">
        ${amount.toFixed(2)}
      </div>
    </div>
  );
}