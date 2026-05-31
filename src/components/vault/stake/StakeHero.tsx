import { useMemo } from 'react';
import { fmtUSD, fmtTVL } from '../../../data/mockStablePools';
import type { MockStablePool } from '../../../data/mockStablePools';
import type { PhUsdStakePool } from '../../../hooks/usePhUsdStakePool';

export interface StakeHeroProps {
  phUsdPool: PhUsdStakePool;
  /** phUSD pool TVL (USD). The real pool's TVL is not surfaced on-chain here;
   *  pass a value (defaults to 0 contribution) — display only. */
  phUsdTvl?: number;
  stablePools: MockStablePool[];
  /** phUSD APY (the inverse pool APY shown for the phUSD section). */
}

const STABLE_USD = 1.0;

/**
 * Hero summary above the Stake pool list: APY range, your total staked (USD),
 * and TVL across the real phUSD pool + mock stable pools. Mirrors the
 * prototype `StakeHero` (app.jsx:77-163), translated to Tailwind + pxusd
 * tokens.
 */
export default function StakeHero({ phUsdPool, phUsdTvl = 0, stablePools }: StakeHeroProps) {
  const phUsdPrice =
    phUsdPool.phUsdMarketPrice !== null && phUsdPool.phUsdMarketPrice > 0
      ? phUsdPool.phUsdMarketPrice
      : 1.0;

  const totals = useMemo(() => {
    let totalUserUSD = 0;
    let totalTVL = 0;

    // phUSD pool: staked is phUSD, valued at market price.
    totalUserUSD += phUsdPool.stakedBalance * phUsdPrice;
    totalTVL += phUsdTvl;

    // Stable pools: staked is a $1.00 stable.
    for (const p of stablePools) {
      totalUserUSD += p.stakedBalance * STABLE_USD;
      totalTVL += p.tvl;
    }

    const apys = [phUsdPool.apy, ...stablePools.map((p) => p.apy)].filter((a) => a > 0);
    const minApy = apys.length ? Math.min(...apys) : 0;
    const maxApy = apys.length ? Math.max(...apys) : 0;

    return { totalUserUSD, totalTVL, minApy, maxApy };
  }, [phUsdPool.stakedBalance, phUsdPool.apy, phUsdPrice, phUsdTvl, stablePools]);

  const isDepegged = phUsdPool.phUsdMarketPrice !== null && phUsdPool.phUsdMarketPrice < 0.99;

  return (
    <div
      className="mb-6 rounded-[20px] border border-border px-5 py-5"
      style={{
        background:
          'radial-gradient(800px 180px at 12% -20%, rgba(255,77,109,0.14), transparent 60%),' +
          'radial-gradient(700px 180px at 95% 0%, rgba(255,217,61,0.10), transparent 60%),' +
          'linear-gradient(180deg, var(--pxusd-teal-800) 0%, var(--pxusd-teal-900) 100%)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[240px]">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Stake · choose a pool
          </div>
          <div className="text-[26px] font-bold leading-[1.15] tracking-[-0.01em] text-pxusd-white">
            Earn yield with phUSD &amp; bluechip stables
          </div>
          <div className="mt-1.5 max-w-[540px] text-[13px] text-muted-foreground">
            Stake phUSD to skim the funnel as USDC, or stake a bluechip stable to earn a phUSD stream.
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">APY range</span>
            <span className="font-mono text-[22px] font-bold text-pxusd-orange-300">
              {totals.minApy.toFixed(2)}–{totals.maxApy.toFixed(2)}%
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Your total staked</span>
            <span className="font-mono text-[22px] font-bold text-pxusd-white">{fmtUSD(totals.totalUserUSD)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">TVL</span>
            <span className="font-mono text-[22px] font-bold text-pxusd-white">{fmtTVL(totals.totalTVL)}</span>
          </div>
        </div>
      </div>

      {isDepegged && (
        <div className="mt-3.5 rounded-xl border border-pxusd-pink-400/40 bg-pxusd-pink-400/10 px-4 py-2.5 text-[13px] text-muted-foreground">
          <strong className="font-bold text-pxusd-white">
            phUSD is trading at {fmtUSD(phUsdPool.phUsdMarketPrice as number)}
          </strong>{' '}
          — USD-equivalent values below are computed at the live market price.
        </div>
      )}

      <div
        className="mt-4 h-[3px] rounded-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, #1f5a73 30%, #FF8C42 65%, #FFD93D 100%)',
        }}
      />
    </div>
  );
}
