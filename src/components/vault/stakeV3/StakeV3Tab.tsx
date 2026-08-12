import { useState } from 'react';
import { formatUnits } from 'viem';
import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import StakeAccordionRow from '../stake/StakeAccordionRow';
import type { RewardLeg, StakeRowModel } from '../stake/StakeAccordionRow';
import { usePhlimboV3Pool } from '../../../hooks/usePhlimboV3Pool';
import { useStableStakerPools } from '../../../hooks/useStableStakerPools';
import { useKenduPrice } from '../../../hooks/useKenduPrice';
import { nudgeTokenMeta } from '../../../data/nudgeTokenMeta';
import { PromoPhase } from '../../../hooks/useDepositPageView';
import phUSDIcon from '../../../assets/phUSD.png';
import usdcIcon from '../../../assets/usdc-logo.svg';

const STABLE_USD = 1.0;
const STABLE_DECIMALS = 6;
const SECONDS_PER_YEAR = 31_536_000;

/**
 * Accent colours identifying each reward stream in the farm row. The stable
 * leg keeps the teal this surface already uses for the successor farm; the
 * promo leg takes pink so the two are never confused at a glance. Written as
 * literals because Tailwind only emits classes it can find in the source.
 */
const STABLE_ACCENT = 'text-pxusd-teal-400';
const PROMO_ACCENT = 'text-pxusd-pink-400';

/**
 * Successor deposit farm (PhlimboV3), rendered beside the incumbent Stake tab
 * so the cutover can be watched side by side.
 *
 * Everything here is read from one router-resolved `DepositPageViewV3.getData`
 * call — see `useDepositPageView`, which owns the field indices and the
 * raw-vs-PRECISION scaling.
 */
export default function StakeV3Tab() {
  const pool = usePhlimboV3Pool(true);
  const view = pool.view;
  const stable = useStableStakerPools(true);

  // Single open row keeps the surface calm. Default to the V3 phUSD pool.
  const [expandedId, setExpandedId] = useState<string | null>('phusd-v3');
  const toggle = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  const { data: promoSymbolRaw } = useReadContract({
    address: view?.hasPromo ? view.promoToken : undefined,
    abi: erc20Abi,
    functionName: 'symbol',
    query: { enabled: !!view?.hasPromo },
  });
  const promoSymbol = (promoSymbolRaw as string | undefined) ?? 'PROMO';

  const phUsdPrice =
    pool.phUsdMarketPrice !== null && pool.phUsdMarketPrice > 0 ? pool.phUsdMarketPrice : 1.0;

  const { price: kenduPrice } = useKenduPrice();

  /**
   * The farm's second reward stream is its **promo slot**, not a fixed token.
   * The symbol is read off the chain; art and price source are then looked up
   * by canonical symbol, so Anvil's `mKENDU` mock and mainnet KENDU resolve to
   * the same entry and a future rotation to a different token is followed
   * automatically instead of being hard-coded here.
   */
  const promoMeta = view?.hasPromo ? nudgeTokenMeta(promoSymbol) : undefined;
  const promoLabel = promoMeta?.display ?? promoSymbol;

  const promoPriceUSD: number | null = (() => {
    switch (promoMeta?.priceSource) {
      case 'stable':
        return STABLE_USD;
      case 'phusd':
        return phUsdPrice;
      case 'kendu':
        return kenduPrice;
      default:
        // A token we ship no price feed for. Null (not zero) so the row shows
        // an em dash rather than claiming the leg is worthless.
        return null;
    }
  })();

  // A promotion that is Flushing, or Active but drained to a zero balance,
  // pays nothing at this moment — its APY is genuinely 0, not merely unknown.
  const promoPaying =
    !!view && view.hasPromo && view.promoPhase === PromoPhase.Active && view.promoRewardBalance > 0n;
  const promoDecimals = view?.promoTokenDecimals || 18;
  const promoRatePoolWide = view?.promoRewardPerSecond ?? 0;

  const promoApy: number | null =
    promoPriceUSD === null
      ? null
      : promoPaying && pool.apyDenominatorUSD > 0
        ? ((promoRatePoolWide * SECONDS_PER_YEAR * promoPriceUSD) / pool.apyDenominatorUSD) * 100
        : 0;

  /**
   * Undefined whenever no promotion is configured, which drops the row back to
   * the single-reward layout it has always had.
   */
  const rewards: RewardLeg[] | undefined =
    view && view.hasPromo
      ? [
          {
            symbol: 'USDC',
            icon: usdcIcon,
            apy: pool.apy,
            pending: pool.pendingRewards,
            ratePerSecond: pool.ratePerSecond,
            decimals: STABLE_DECIMALS,
            priceUSD: STABLE_USD,
            accentClass: STABLE_ACCENT,
          },
          {
            symbol: promoLabel,
            icon: promoMeta?.logo,
            apy: promoApy,
            pending: Number(formatUnits(view.pendingPromoRewards, promoDecimals)),
            ratePerSecond: pool.promoRatePerSecond,
            // An 18-dp counter is far too wide for this column; 6 matches the
            // stable leg.
            decimals: Math.min(promoDecimals, 6),
            priceUSD: promoPriceUSD,
            accentClass: PROMO_ACCENT,
          },
        ]
      : undefined;

  const row: StakeRowModel = {
    id: 'phusd-v3',
    stakeToken: 'phUSD',
    stakeIcon: phUSDIcon,
    earnToken: 'USDC',
    earnIcon: usdcIcon,
    apy: pool.apy,
    walletBalance: pool.walletBalance,
    stakedBalance: pool.stakedBalance,
    pendingRewards: pool.pendingRewards,
    ratePerSecond: pool.ratePerSecond,
    liveTicker: true,
    tagline: rewards
      ? `Flagship pool — stake phUSD, earn USDC streamed from the yield funnel, plus ${promoLabel} emissions.`
      : 'Flagship pool — stake phUSD, earn USDC streamed from the yield funnel.',
    pendingDecimals: STABLE_DECIMALS,
    rewards,
    isLegacy: true,
    stakePriceUSD: phUsdPrice,
    earnPriceUSD: STABLE_USD,
    disabled: pool.isPaused,
    needsApproval: pool.needsApproval,
  };

  const rowPendingAction =
    pool.txPending === 'stake' ||
    pool.txPending === 'withdraw' ||
    pool.txPending === 'claim' ||
    pool.txPending === 'approve'
      ? pool.txPending
      : null;

  if (!view) {
    return (
      <div className="p-5 text-[13px] text-muted-foreground">
        {pool.isLoading
          ? 'Loading the staking pool…'
          : 'The staking pool could not be loaded on this network. Check that your wallet is on a supported network and try again.'}
      </div>
    );
  }

  return (
    <div className="p-5">
      {view.paused && (
        <div className="mb-4 rounded-xl border border-pxusd-yellow-400/30 bg-pxusd-yellow-400/[0.06] p-3.5 text-[12.5px] text-muted-foreground">
          <span className="font-semibold text-pxusd-yellow-400">The farm is paused.</span>{' '}
          Staking and withdrawals are unavailable
          {view.promoPhase === PromoPhase.Flushing ? ' while the promotion finishes flushing.' : '.'}
        </div>
      )}

      {/* Core pool */}
      <div
        className="mb-6 rounded-[18px] border border-pxusd-teal-400/30 p-3.5"
        style={{ background: 'linear-gradient(180deg, rgba(31,90,115,0.16), rgba(10,28,40,0.0) 80%)' }}
      >
        <div className="mb-2.5 px-1.5">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-pxusd-teal-400">
            Stake phUSD · earn {rewards ? `USDC + ${promoLabel}` : 'USDC'}
          </div>
        </div>

        <StakeAccordionRow
          pool={row}
          expanded={expandedId === 'phusd-v3'}
          onToggle={() => toggle('phusd-v3')}
          pendingAction={rowPendingAction}
          onStake={pool.stake}
          onWithdraw={pool.withdraw}
          onClaim={pool.claim}
          onApprove={pool.approve}
        />
      </div>

      {/* Stable pools group */}
      <div className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        Stake stables · earn phUSD
      </div>
      {stable.pools.map((p) => {
        const stableRow: StakeRowModel = {
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
          // Real pools: interpolate the live counter between 12s reads.
          liveTicker: p.liveTicker,
          tagline: p.tagline,
          // Stable pools earn phUSD (18 decimals), not USDC.
          pendingDecimals: p.pendingDecimals,
          isLegacy: false,
          stakePriceUSD: p.stakePriceUSD,
          earnPriceUSD: p.earnPriceUSD,
          disabled: p.disabled,
          withdrawDisabled: p.withdrawDisabled,
          withdrawBuffer: p.withdrawBuffer,
          needsApproval: p.needsApproval,
          // AMM-routed pools (USDe) surface their fixed entry haircut /
          // bounded exit cost in the action panels.
          conversionBps: p.conversionBps,
        };
        const pendingAction = stable.pendingAction?.id === p.id ? stable.pendingAction.action : null;
        return (
          <StakeAccordionRow
            key={p.id}
            pool={stableRow}
            expanded={expandedId === p.id}
            onToggle={() => toggle(p.id)}
            pendingAction={pendingAction}
            onStake={(amount) => stable.stake(p.id, amount)}
            onWithdraw={(amount) => stable.withdraw(p.id, amount)}
            onClaim={() => stable.claim(p.id)}
            onApprove={() => stable.approve(p.id)}
          />
        );
      })}
    </div>
  );
}
