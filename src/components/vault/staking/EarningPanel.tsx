import LiveYieldCounter from './LiveYieldCounter';
import PhUsdCoin from './PhUsdCoin';

export interface EarningPanelProps {
  totalUnits: number;
  minApy: number;
  ratePerSecond: number;
  /** Lifetime phUSD earned (counter baseline) */
  lifetimeEarned: number;
}

/**
 * Global "Your phUSD earning · live" hero panel.
 *
 * Layout: big live counter on the left, summary stats (units staked, min APY)
 * on the right, flavor stripe at the bottom.
 */
export default function EarningPanel({
  totalUnits,
  minApy,
  ratePerSecond,
  lifetimeEarned,
}: EarningPanelProps) {
  return (
    <div
      className="mb-[18px] rounded-[20px] border border-border px-[22px] py-5"
      style={{
        background:
          'radial-gradient(800px 180px at 12% -20%, rgba(255,77,109,.14), transparent 60%), radial-gradient(700px 180px at 95% 0%, rgba(255,217,61,.10), transparent 60%), linear-gradient(180deg, var(--pxusd-teal-800) 0%, var(--pxusd-teal-900) 100%)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-[280px] flex-[1_1_320px]">
          <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Your phUSD earning
          </div>
          <div className="flex items-baseline gap-2.5">
            <PhUsdCoin size={28} />
            <LiveYieldCounter
              ratePerSecond={ratePerSecond}
              initial={lifetimeEarned}
              decimals={6}
              size={44}
            />
            <span className="ml-1 font-mono text-sm text-muted-foreground">phUSD</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-[22px]">
          <div>
            <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Units staked
            </div>
            <div className="font-mono text-[22px] font-bold tabular-nums text-pxusd-white">{totalUnits}</div>
          </div>
          <div>
            <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Min APY
            </div>
            <div className="font-mono text-[22px] font-bold tabular-nums text-pxusd-orange-300">
              {minApy.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      <div
        className="mt-4 h-[3px] rounded-[2px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, #1f5a73 30%, #FF8C42 65%, #FFD93D 100%)',
        }}
      />
    </div>
  );
}
