import { useState } from 'react';
import StakeHero from './StakeHero';
import StakeAccordionRow from './StakeAccordionRow';
import type { StakeRowModel } from './StakeAccordionRow';
import { usePhUsdStakePool } from '../../../hooks/usePhUsdStakePool';
import { useMockStablePools } from '../../../data/mockStablePools';
import phUSDIcon from '../../../assets/phUSD.png';
import usdcIcon from '../../../assets/usdc-logo.svg';

const STABLE_USD = 1.0;

/**
 * Consolidated Stake surface (story 068).
 *
 * - phUSD pool: real PhlimboEA wiring (stake phUSD → earn USDC). Own framed
 *   section at the top, with an sphUSD "coming later" placeholder inside it.
 * - USDC / USDe / DOLA pools: mock data + simulated transactions, in a
 *   "Stake stables · earn phUSD" group below.
 *
 * Layout reproduces the prototype's default: accordion + phusd-own-section +
 * subtle inversion emphasis. Active prototype tweaks (layout switcher, depeg
 * simulator, etc.) are intentionally not ported.
 */
export default function StakeTab() {
  const phUsdPool = usePhUsdStakePool(true);
  const stable = useMockStablePools();

  // Single open row keeps the surface calm. Default to the phUSD pool.
  const [expandedId, setExpandedId] = useState<string | null>('phusd');
  const toggle = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  const phUsdPrice =
    phUsdPool.phUsdMarketPrice !== null && phUsdPool.phUsdMarketPrice > 0
      ? phUsdPool.phUsdMarketPrice
      : 1.0;

  // Project the real phUSD pool onto the shared row model.
  const phUsdRow: StakeRowModel = {
    id: 'phusd',
    stakeToken: 'phUSD',
    stakeIcon: phUSDIcon,
    earnToken: 'USDC',
    earnIcon: usdcIcon,
    apy: phUsdPool.apy,
    walletBalance: phUsdPool.walletBalance,
    stakedBalance: phUsdPool.stakedBalance,
    pendingRewards: phUsdPool.pendingRewards,
    ratePerSecond: phUsdPool.ratePerSecond,
    tagline: 'Flagship pool — stake phUSD, earn USDC streamed from the yield funnel.',
    pendingDecimals: 6,
    isLegacy: true,
    stakePriceUSD: phUsdPrice,
    earnPriceUSD: STABLE_USD,
    disabled: phUsdPool.isPaused,
    needsApproval: phUsdPool.needsApproval,
  };

  const phUsdPendingAction =
    phUsdPool.txPending === 'stake' ||
    phUsdPool.txPending === 'withdraw' ||
    phUsdPool.txPending === 'claim' ||
    phUsdPool.txPending === 'approve'
      ? phUsdPool.txPending
      : null;

  return (
    <div className="p-5">
      <StakeHero phUsdPool={phUsdPool} stablePools={stable.pools} />

      {/* phUSD framed section ("phusd-own-section") */}
      <div
        className="mb-6 rounded-[18px] border border-pxusd-teal-400/30 p-3.5"
        style={{
          background: 'linear-gradient(180deg, rgba(31,90,115,0.16), rgba(10,28,40,0.0) 80%)',
        }}
      >
        <div className="mb-2.5 flex items-center justify-between px-1.5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-pxusd-teal-400">
              Stake phUSD · earn USDC
            </div>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              Hold phUSD and skim the yield funnel as USDC.
            </div>
          </div>
          <span className="rounded-full border border-pxusd-teal-400/40 bg-pxusd-teal-400/10 px-2.5 py-1 text-[11px] font-semibold text-pxusd-teal-400">
            Inverse direction
          </span>
        </div>

        <StakeAccordionRow
          pool={phUsdRow}
          expanded={expandedId === 'phusd'}
          onToggle={() => toggle('phusd')}
          pendingAction={phUsdPendingAction}
          onStake={phUsdPool.stake}
          onWithdraw={phUsdPool.withdraw}
          onClaim={phUsdPool.claim}
          onApprove={phUsdPool.approve}
        />

        {/* sphUSD coming-soon placeholder — no contract, no handlers */}
        <div className="mb-1 mt-1 flex items-center gap-3.5 rounded-2xl border border-dashed border-border px-4 py-3 opacity-90">
          <img src={phUSDIcon} alt="sphUSD" className="h-9 w-9 rounded-full opacity-50" />
          <div className="flex flex-col gap-0.5">
            <div className="text-[14px] font-semibold text-pxusd-white">sphUSD · auto-compounding</div>
            <div className="text-[12px] text-muted-foreground">
              sphUSD · auto-compounding phUSD-on-phUSD vault. Coming later.
            </div>
          </div>
          <span className="ml-auto rounded-full border border-border bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            Coming later
          </span>
        </div>
      </div>

      {/* Stable pools group */}
      <div className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        Stake stables · earn phUSD
      </div>
      {stable.pools.map((p) => {
        const row: StakeRowModel = {
          id: p.id,
          stakeToken: p.stakeToken,
          stakeIcon: p.stakeIcon,
          earnToken: p.earnToken,
          earnIcon: p.earnIcon,
          apy: p.apy,
          walletBalance: p.walletBalance,
          stakedBalance: p.stakedBalance,
          pendingRewards: p.pendingRewards,
          ratePerSecond: p.ratePerSecond,
          tagline: p.tagline,
          pendingDecimals: 6,
          isLegacy: false,
          stakePriceUSD: STABLE_USD,
          earnPriceUSD: phUsdPrice,
        };
        const pendingAction = stable.txPending?.poolId === p.id ? stable.txPending.action : null;
        return (
          <StakeAccordionRow
            key={p.id}
            pool={row}
            expanded={expandedId === p.id}
            onToggle={() => toggle(p.id)}
            pendingAction={pendingAction}
            onStake={(amount) => stable.stake(p.id, amount)}
            onWithdraw={(amount) => stable.withdraw(p.id, amount)}
            onClaim={() => stable.claim(p.id)}
          />
        );
      })}
    </div>
  );
}
