import { useState } from 'react';
import { formatUnits, erc20Abi } from 'viem';
import { useReadContract } from 'wagmi';
import AntimatterAccordionRow from './AntimatterAccordionRow';
import StakeAccordionRow from '../stake/StakeAccordionRow';
import type { RewardLeg, StakeRowModel } from '../stake/StakeAccordionRow';
import { fmtAmount } from '../stake/formatStake';
import { usePhlimboV3Pool } from '../../../hooks/usePhlimboV3Pool';
import { useStableStakerPools } from '../../../hooks/useStableStakerPools';
import { useKenduPrice } from '../../../hooks/useKenduPrice';
import { nudgeTokenMeta } from '../../../data/nudgeTokenMeta';
import { PromoPhase } from '../../../hooks/useDepositPageView';
import { ANTIMATTER_ACCENT } from '../../../data/antimatterData';
import type { AntimatterSubTab } from '../../../data/antimatterData';
import antimatterIcon from '../../../assets/antimatter.png';
import phUSDIcon from '../../../assets/phUSD.png';
import usdcIcon from '../../../assets/usdc-logo.svg';

const STABLE_USD = 1.0;
const STABLE_DECIMALS = 6;
const SECONDS_PER_YEAR = 31_536_000;

/**
 * Accent colours identifying each reward stream in the phUSD farm row. The
 * stable leg keeps the teal this surface already uses for the farm; the promo
 * leg takes pink so the two are never confused at a glance. Written as literals
 * because Tailwind only emits classes it can find in the source.
 */
const STABLE_ACCENT = 'text-pxusd-teal-400';
const PROMO_ACCENT = 'text-pxusd-pink-400';

/**
 * **The public `Stake` tab.** Contract-backed throughout, routed at `/stake`,
 * `/staking` and `/stake-v3`.
 *
 * Two legs:
 *
 * 1. **The phUSD farm** — `usePhlimboV3Pool` rendered through
 *    `StakeAccordionRow`, behaviour unchanged from the tab this replaced
 *    (story 082 ported it out of the deleted `StakeV3Tab`). It reads
 *    `PhlimboV3`, which is deployed on every network, so it is unaffected by
 *    the Antimatter pools' zero-address guard.
 * 2. **The three stablecoin pools** — USDC / USDe / DOLA on `StableStakerV2`,
 *    which accrues **Antimatter** rather than phUSD. Antimatter is not normally
 *    claimed: it is annihilated against the user's own staked principal,
 *    destroying one unit of each and emitting phUSD worth both sides together.
 *
 * Story 082 promoted this surface from the design preview stories 079 and 080
 * built. Nothing here is simulated any more — no `setInterval` advancing
 * literals, no demo-speed multiplier. Every figure is a chain read on the 12 s
 * heartbeat that `useStableStakerPools` owns.
 *
 * APY for the stablecoin pools is the Antimatter **net-yield** figure story 083
 * added: annihilation destroys a unit of principal per unit of Antimatter, so
 * the ordinary yield ratio carries a `(2 x phUSDprice - 1)` factor and goes
 * negative below $0.50 — shown honestly, with the annihilate action disabled in
 * exactly that regime. An unknown price or emission rate renders as an em dash,
 * this repo's convention, and deliberately never as `0`.
 *
 * The tab id stays the literal `"Stake"` so `/staking` — DeFi Llama's outbound
 * deep-link target — keeps resolving here. See `src/lib/tabRoutes.ts`.
 */

/** Per-pool form state. Lives here so the row component stays hook-free. */
interface PoolFormState {
  tab: AntimatterSubTab;
  stakeAmt: string;
  wdAmt: string;
}

const INITIAL_FORM: PoolFormState = { tab: 'annihilate', stakeAmt: '', wdAmt: '' };

export default function AntimatterStakeTab() {
  const pool = usePhlimboV3Pool(true);
  const view = pool.view;
  const stable = useStableStakerPools(true);

  // Single open row keeps the surface calm. Default to the phUSD farm.
  const [expandedId, setExpandedId] = useState<string | null>('phusd-v3');
  const toggle = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  const [forms, setForms] = useState<Record<string, PoolFormState>>({});
  const formFor = (id: string): PoolFormState => forms[id] ?? INITIAL_FORM;
  /**
   * Always the `setState` updater form, never a read off the render closure —
   * a closure read here is what gave story 080 its stale-value window.
   */
  const patchForm = (id: string, patch: Partial<PoolFormState>) =>
    setForms((cur) => ({ ...cur, [id]: { ...(cur[id] ?? INITIAL_FORM), ...patch } }));

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

  const farmRow: StakeRowModel = {
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

  const farmPendingAction =
    pool.txPending === 'stake' ||
    pool.txPending === 'withdraw' ||
    pool.txPending === 'claim' ||
    pool.txPending === 'approve'
      ? pool.txPending
      : null;

  const totalPending = stable.pools.reduce((sum, p) => sum + p.pendingAntimatter, 0);

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

      {/* ---- Leg 1: the phUSD farm, unchanged from the tab this replaced --- */}
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
          pool={farmRow}
          expanded={expandedId === 'phusd-v3'}
          onToggle={() => toggle('phusd-v3')}
          pendingAction={farmPendingAction}
          onStake={pool.stake}
          onWithdraw={pool.withdraw}
          onClaim={pool.claim}
          onApprove={pool.approve}
        />
      </div>

      {/* ---- Leg 2: the Antimatter stablecoin pools ------------------------ */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5 px-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Stake stables · earn
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border py-[3px] pl-1 pr-2.5"
          style={{ borderColor: 'rgba(196,174,234,.35)', background: 'rgba(196,174,234,0.08)' }}
        >
          <img src={antimatterIcon} alt="" aria-hidden="true" className="h-4 w-4 rounded-full" />
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-pxusd-purple-300">
            {stable.antimatterSymbol}
          </span>
        </span>
        <span className="text-[11.5px] text-muted-foreground">
          annihilate it against your stake to receive phUSD
        </span>
      </div>

      {/* The header balance strip is hidden below lg, so the Antimatter figures
          are surfaced inside the panel too. */}
      <div
        className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border px-3.5 py-3"
        style={{ borderColor: 'rgba(196,174,234,.28)', background: 'rgba(196,174,234,0.05)' }}
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {stable.antimatterSymbol} in wallet
          </span>
          <span className="font-mono text-[14px] font-semibold text-pxusd-white">
            {fmtAmount(stable.walletAntimatter, 4)}
          </span>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {stable.antimatterSymbol} accruing
          </span>
          <span className="font-mono text-[14px] font-semibold" style={{ color: ANTIMATTER_ACCENT }}>
            {fmtAmount(totalPending, 6)}
          </span>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">phUSD</span>
          <span className="font-mono text-[14px] font-semibold text-pxusd-white">
            {fmtAmount(stable.walletPhUSD, 2)}
          </span>
        </span>
      </div>

      {stable.pools.map((p) => {
        const form = formFor(p.id);
        const pendingAction = stable.pendingAction?.id === p.id ? stable.pendingAction.action : null;
        return (
          <AntimatterAccordionRow
            key={p.id}
            symbol={p.symbol}
            icon={p.stakeIcon}
            apy={p.apy}
            staked={p.stakedBalance}
            // `pendingBase` is the last chain read: LiveYieldCounter resets
            // whenever `initial` changes, so it must be the 12 s figure and not
            // a per-tick recomputation, which would restart the RAF clock.
            pendingBase={p.pendingAntimatter}
            ratePerSecond={p.ratePerSecond}
            pending={p.pendingAntimatter}
            matchedStable={p.matchedStable}
            surplusAntimatter={p.surplusAntimatter}
            antimatterSymbol={stable.antimatterSymbol}
            expanded={expandedId === p.id}
            onToggle={() => toggle(p.id)}
            tagline={p.tagline}
            tab={form.tab}
            onTabChange={(tab) => patchForm(p.id, { tab })}
            walletBalance={p.walletBalance}
            walletPhusd={stable.walletPhUSD}
            walletAntimatter={stable.walletAntimatter}
            phUsdDisplayPrice={stable.phUsdDisplayPrice}
            disabled={p.disabled}
            inactive={p.inactive}
            withdrawDisabled={p.withdrawDisabled}
            withdrawBuffer={p.withdrawBuffer}
            claimEnabled={p.claimEnabled}
            annihilateDisabledReason={p.annihilateDisabledReason}
            conversionBps={p.conversionBps}
            pendingAction={pendingAction}
            needsApproval={p.needsApproval}
            stakeAmt={form.stakeAmt}
            wdAmt={form.wdAmt}
            onStakeAmtChange={(value) => patchForm(p.id, { stakeAmt: value })}
            onWdAmtChange={(value) => patchForm(p.id, { wdAmt: value })}
            onStake={() => void stable.stake(p.id, form.stakeAmt)}
            onWithdraw={() => void stable.withdraw(p.id, form.wdAmt)}
            onAnnihilate={() => void stable.annihilate(p.id)}
            onClaim={() => void stable.claim(p.id)}
            onApprove={() => void stable.approve(p.id)}
          />
        );
      })}
    </div>
  );
}
