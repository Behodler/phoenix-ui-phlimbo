import type { PositionCardProps } from '../../types/vault';

export default function PositionCard({
  position,
  onClaim,
  onUnstake,
  onViewPortfolio
}: PositionCardProps) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 ring-1 ring-white/5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Your Position</h2>
        <button
          onClick={onViewPortfolio}
          className="text-lime-400 text-sm hover:underline"
        >
          View Portfolio
        </button>
      </div>

      <div className="space-y-4">
        <div className="text-xs uppercase tracking-wide text-neutral-400">
          Position
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-lime-400" />
          <div className="font-medium">autoDOLA</div>
          {position.isStaked && (
            <span className="ml-auto rounded-full bg-lime-400/10 px-2 py-0.5 text-[11px] text-lime-300">
              Staked
            </span>
          )}
        </div>

        <div className="h-px w-full bg-neutral-800" />

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="text-neutral-400">Value</div>
          <div className="text-right">
            <div className="font-semibold">{position.value.toFixed(4)} DOLA</div>
            <div className="text-neutral-400">${position.valueUsd.toFixed(2)}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={onClaim}
            className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
          >
            Claim
          </button>
          <button
            onClick={onUnstake}
            className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
          >
            Unstake
          </button>
        </div>
      </div>
    </div>
  );
}