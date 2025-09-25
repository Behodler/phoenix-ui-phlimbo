import type { PositionCardProps } from '../../types/vault';

export default function PositionCard({
  position,
  onClaim,
  onUnstake,
  onViewPortfolio
}: PositionCardProps) {
  return (
    <div className="phoenix-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-card-foreground">Your Position</h2>
        <button
          onClick={onViewPortfolio}
          className="text-primary text-sm hover:underline transition-colors"
        >
          View Portfolio
        </button>
      </div>

      <div className="space-y-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Position
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          <div className="font-medium text-card-foreground">autoDOLA</div>
          {position.isStaked && (
            <span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
              Staked
            </span>
          )}
        </div>

        <div className="h-px w-full bg-border" />

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="text-muted-foreground">Value</div>
          <div className="text-right">
            <div className="font-semibold text-card-foreground">{position.value.toFixed(4)} DOLA</div>
            <div className="text-muted-foreground">${position.valueUsd.toFixed(2)}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={onClaim}
            className="phoenix-btn-ghost text-sm"
          >
            Claim
          </button>
          <button
            onClick={onUnstake}
            className="phoenix-btn-ghost text-sm"
          >
            Unstake
          </button>
        </div>
      </div>
    </div>
  );
}