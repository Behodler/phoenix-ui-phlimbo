import { useState } from 'react';
import { formatUnits } from 'viem';
import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import StakeAccordionRow from '../stake/StakeAccordionRow';
import type { RewardLeg, StakeRowModel } from '../stake/StakeAccordionRow';
import { fmtAmount, fmtUSD } from '../stake/formatStake';
import { usePhlimboV3Pool } from '../../../hooks/usePhlimboV3Pool';
import { useRetiredPromoBanks } from '../../../hooks/useRetiredPromoBanks';
import { useKenduPrice } from '../../../hooks/useKenduPrice';
import { nudgeTokenMeta } from '../../../data/nudgeTokenMeta';
import { PromoPhase } from '../../../hooks/useDepositPageView';
import type { DepositPageViewData } from '../../../hooks/useDepositPageView';
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

const PHASE_LABEL: Record<number, string> = {
  [PromoPhase.None]: 'None',
  [PromoPhase.Active]: 'Active',
  [PromoPhase.Flushing]: 'Flushing',
};

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-[18px] border border-border p-3.5">
      <div className="mb-2.5 px-1.5">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
        {subtitle && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-white/[0.02] px-3.5 py-3">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="font-mono text-[15px] font-semibold text-pxusd-white">{value}</span>
      {hint && <span className="text-[11.5px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

/**
 * One entitlement bucket.
 *
 * The headline is claimable-now **plus** banked, because `pendingX` alone is
 * not the user's entitlement: V3 banks a reward whenever paying it out fails,
 * and `pendingX` then reads zero by design. Showing only `pendingX` tells a
 * banked user they have nothing.
 */
function EntitlementRow({
  label,
  symbol,
  decimals,
  pending,
  banked,
  onClaimBanked,
  claiming,
  note,
}: {
  label: string;
  symbol: string;
  decimals: number;
  pending: bigint;
  banked: bigint;
  onClaimBanked?: () => void;
  claiming: boolean;
  note?: string;
}) {
  const total = pending + banked;
  const fmt = (v: bigint) => fmtAmount(Number(formatUnits(v, decimals)), Math.min(decimals, 6));

  return (
    <div className="mb-2.5 rounded-xl border border-border bg-white/[0.02] px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{label}</span>
        <span className="font-mono text-[16px] font-semibold text-pxusd-white">
          {fmt(total)} <span className="text-[12px] font-normal text-muted-foreground">{symbol}</span>
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
        <span>
          Claimable now <span className="font-mono text-foreground">{fmt(pending)}</span>
          {' · '}
          Banked <span className={`font-mono ${banked > 0n ? 'text-pxusd-yellow-400' : 'text-foreground'}`}>{fmt(banked)}</span>
        </span>
        {banked > 0n && onClaimBanked && (
          <button
            type="button"
            className="phoenix-btn-ghost px-3 py-1 text-[12px]"
            disabled={claiming}
            onClick={onClaimBanked}
          >
            {claiming ? 'Confirming…' : 'Claim banked'}
          </button>
        )}
      </div>
      {banked > 0n && (
        <div className="mt-1.5 text-[11.5px] text-muted-foreground">
          Banked rewards are amounts a previous payout could not deliver — a reverting
          transfer, or a revoked mint. They are held for you and released by the button above.
        </div>
      )}
      {note && <div className="mt-1.5 text-[11.5px] text-muted-foreground">{note}</div>}
    </div>
  );
}

function PromoSection({
  view,
  promoSymbol,
  banked,
  onClaimBanked,
  claiming,
}: {
  view: DepositPageViewData;
  promoSymbol: string;
  banked: bigint;
  onClaimBanked: () => void;
  claiming: boolean;
}) {
  const decimals = view.promoTokenDecimals || 18;
  const fmt = (v: bigint) => fmtAmount(Number(formatUnits(v, decimals)), Math.min(decimals, 6));

  if (!view.hasPromo) {
    return (
      <Section title="Promotion" subtitle="No promo token is configured on this farm.">
        <Stat label="Phase" value={PHASE_LABEL[view.promoPhase] ?? String(view.promoPhase)} />
      </Section>
    );
  }

  const isFlushing = view.promoPhase === PromoPhase.Flushing;
  const isDepleted = view.promoPhase === PromoPhase.Active && view.promoRewardBalance === 0n;

  return (
    <Section title="Promotion" subtitle={`${promoSymbol} rewards streamed alongside the stable yield.`}>
      {isFlushing && (
        <div className="mb-3 rounded-xl border border-pxusd-yellow-400/30 bg-pxusd-yellow-400/[0.06] p-3.5 text-[12.5px] text-muted-foreground">
          <span className="font-semibold text-pxusd-yellow-400">Promotion is flushing.</span>{' '}
          The farm is paused while it walks the staker set paying out final promo
          balances, so staking and withdrawals are unavailable and the pending
          figure below is frozen — it is not stalled. Progress:{' '}
          <span className="font-mono text-pxusd-white">
            {view.flushCursor.toString()} / {view.stakerCount.toString()}
          </span>{' '}
          stakers.
        </div>
      )}
      {isDepleted && (
        <div className="mb-3 rounded-xl border border-border bg-white/[0.03] p-3.5 text-[12.5px] text-muted-foreground">
          This promotion is still <span className="font-semibold text-foreground">Active</span> but its
          reward balance has drained to zero, so nothing further accrues until it is topped up
          or finalized. A drained promo has no separate phase of its own.
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Stat label="Phase" value={PHASE_LABEL[view.promoPhase] ?? String(view.promoPhase)} />
        <Stat label="Token" value={promoSymbol} hint={`${view.promoToken.slice(0, 6)}…${view.promoToken.slice(-4)}`} />
        <Stat label="Decimals" value={String(view.promoTokenDecimals)} />
        <Stat
          label="Rate"
          value={`${fmtAmount(view.promoRewardPerSecond, 6)} /s`}
          hint="Pool-wide, descaled by PRECISION"
        />
        <Stat label="Reward balance" value={fmt(view.promoRewardBalance)} />
        <Stat
          label="Depletion"
          value={`${(Number(view.promoDepletionDuration) / 86400).toFixed(2)} d`}
          hint={`${view.promoDepletionDuration.toString()} s`}
        />
      </div>

      <EntitlementRow
        label="Promo rewards"
        symbol={promoSymbol}
        decimals={decimals}
        pending={view.pendingPromoRewards}
        banked={banked}
        onClaimBanked={onClaimBanked}
        claiming={claiming}
        note={isFlushing ? 'Frozen while the promotion is flushing.' : undefined}
      />
    </Section>
  );
}

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
  const [expanded, setExpanded] = useState(true);

  const { banks: retiredBanks, isUnavailable: retiredUnavailable } = useRetiredPromoBanks(
    pool.depositPageViewAddress,
    view?.promoToken,
  );

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
            // stable leg and the entitlement rows below.
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
      ? `PhlimboV3 — stake phUSD, earn USDC streamed from the yield funnel, plus ${promoLabel} emissions.`
      : 'PhlimboV3 — stake phUSD, earn USDC streamed from the yield funnel.',
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
          ? 'Loading the deposit page from ViewRouter…'
          : 'The deposit page could not be resolved. Check that ViewRouter has a "deposit" page registered and that PhlimboV3 is deployed on this network.'}
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
            Stake phUSD · earn {rewards ? `USDC + ${promoLabel}` : 'USDC'} — PhlimboV3
          </div>
          <div className="mt-0.5 text-[12.5px] text-muted-foreground">
            The successor farm. The Stake tab still points at the incumbent V2 pool.
          </div>
        </div>

        <StakeAccordionRow
          pool={row}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
          pendingAction={rowPendingAction}
          onStake={pool.stake}
          onWithdraw={pool.withdraw}
          onClaim={pool.claim}
          onApprove={pool.approve}
        />
      </div>

      {/* Entitlement */}
      <Section
        title="Your entitlement"
        subtitle="Claimable now plus anything banked from a payout that could not be delivered."
      >
        <EntitlementRow
          label="USDC rewards"
          symbol="USDC"
          decimals={STABLE_DECIMALS}
          pending={view.pendingStableRewards}
          banked={view.unclaimableStable}
          onClaimBanked={pool.claimUnclaimableStable}
          claiming={pool.txPending === 'claimStable'}
        />
        <EntitlementRow
          label="phUSD rewards"
          symbol="phUSD"
          decimals={18}
          pending={view.pendingPhUSDRewards}
          banked={view.unclaimablePhUSD}
          onClaimBanked={pool.claimUnclaimablePhUSD}
          claiming={pool.txPending === 'claimPhUSD'}
        />

        {retiredUnavailable && (
          <div className="mt-2.5 text-[11.5px] text-muted-foreground">
            Could not scan for retired promo banks on this network — historical promo
            tokens have no on-chain enumeration, so they are recovered from the event
            log, which this RPC declined to serve.
          </div>
        )}
        {retiredBanks.map((bank) => (
          <EntitlementRow
            key={bank.token}
            label={`Retired promo · ${bank.symbol}`}
            symbol={bank.symbol}
            decimals={bank.decimals}
            pending={0n}
            banked={bank.amountRaw}
            onClaimBanked={() => pool.claimUnclaimablePromo(bank.token)}
            claiming={pool.txPending === 'claimPromo'}
            note="This promotion has ended, but your banked balance survives and stays claimable."
          />
        ))}
      </Section>

      {/* Promo */}
      <PromoSection
        view={view}
        promoSymbol={promoSymbol}
        banked={view.unclaimablePromo}
        onClaimBanked={() => pool.claimUnclaimablePromo(view.promoToken)}
        claiming={pool.txPending === 'claimPromo'}
      />

      {/* Farm */}
      <Section title="Farm" subtitle="Pool-wide configuration, straight off the page view.">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Stat
            label="Total staked"
            value={fmtAmount(Number(formatUnits(view.totalStaked, 18)), 2)}
            hint={fmtUSD(Number(formatUnits(view.totalStaked, 18)) * phUsdPrice)}
          />
          <Stat label="Stakers" value={view.stakerCount.toString()} />
          <Stat label="Minimum stake" value={fmtAmount(Number(formatUnits(view.minimumStake, 18)), 4)} hint="phUSD" />
          <Stat
            label="USDC rate"
            value={`${fmtAmount(view.stableRewardsPerSecond, 6)} /s`}
            hint="PRECISION-scaled on-chain"
          />
          <Stat
            label="phUSD rate"
            value={`${fmtAmount(Number(formatUnits(view.phUSDRewardsPerSecondRaw, 18)), 6)} /s`}
            hint="Raw wei/sec — not PRECISION-scaled"
          />
          <Stat label="Paused" value={view.paused ? 'Yes' : 'No'} />
        </div>
      </Section>
    </div>
  );
}
