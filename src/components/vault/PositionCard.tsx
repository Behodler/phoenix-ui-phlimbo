import type { PositionCardProps } from '../../types/vault';

export default function PositionCard({
  position,
}: PositionCardProps) {
  return (
    <div className="phoenix-card p-6">


      <div className="space-y-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Position
        </div>
  
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          <div className="font-medium text-card-foreground">pxUSD</div>
        </div>

        <div className="h-px w-full bg-border" />

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="text-muted-foreground">Value</div>
          <div className="text-right">
            <div className="font-semibold text-card-foreground">{position.value.toFixed(4)} DOLA</div>
            <div className="text-muted-foreground">${position.valueUsd.toFixed(2)}</div>
          </div>
        </div>

   
      </div>
    </div>
  );
}