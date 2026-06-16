import { useEffect, useRef, useState } from 'react';
import LiveYieldCounter from '../staking/LiveYieldCounter';
import SegmentedControl from '../../ui/SegmentedControl';
import { fmtUSD, fmtAmount, fmtAPY } from './formatStake';

/**
 * Normalized, layout-agnostic view of a single stake pool row. Both the real
 * phUSD pool and the mock stable pools are projected onto this shape so one
 * accordion row component renders them all.
 */
export interface StakeRowModel {
  id: string;
  stakeToken: string;
  stakeIcon: string;
  earnToken: string;
  earnIcon: string;
  apy: number;
  /** Wallet balance of the stake token (human). */
  walletBalance: number;
  /** Staked balance of the stake token (human). */
  stakedBalance: number;
  /** Pending earn-token rewards (human). */
  pendingRewards: number;
  /** Earn-token per second for the live counter (human). */
  ratePerSecond: number;
  /**
   * Animate pending via client-side interpolation (mock pools). When false the
   * pending figure is rendered as the raw on-chain value and only changes when
   * fresh chain data arrives (real pool — block updates take precedence).
   */
  liveTicker: boolean;
  tagline: string;
  /** Decimal places for the live pending counter (USDC=6, phUSD=6 here). */
  pendingDecimals: number;
  /** Legacy inverse pool (stake phUSD → earn stable). */
  isLegacy: boolean;
  /** USD price of the stake token (stables = 1.00, phUSD = market). */
  stakePriceUSD: number;
  /** USD price of the earn token. */
  earnPriceUSD: number;
  /** Disable stake/withdraw controls (e.g. when paused). */
  disabled?: boolean;
  /**
   * Per-pool underwater flag (real stable pools only). When true the pool's
   * yield strategy is below par, so on-chain `withdraw` reverts. This gates
   * ONLY the Withdraw control — Stake and Claim stay enabled. Distinct from
   * the global `disabled` (paused) flag. Defaults to false so the phUSD panel
   * and any caller not passing it are unaffected.
   */
  withdrawDisabled?: boolean;
  /**
   * Set-aside buffer (human units) backing withdrawals while underwater.
   * While underwater, withdraw amounts that fit entirely within this buffer
   * still succeed on-chain, so only larger amounts are paused. Undefined → 0
   * (underwater fully pauses withdrawals).
   */
  withdrawBuffer?: number;
  /** Whether phUSD approval is needed for the entered stake amount (real pool only). */
  needsApproval?: (amount: string) => boolean;
  /**
   * Max slippage (bps) of the pool's AMM-routed yield strategy (USDe). When
   * set (> 0), deposits pay exactly this haircut and withdrawals pay between
   * zero and this. Undefined / 0 → the pool stakes and withdraws 1:1.
   */
  conversionBps?: number;
}

type SubAction = 'stake' | 'withdraw' | 'claim';

export interface StakeAccordionRowProps {
  pool: StakeRowModel;
  expanded: boolean;
  onToggle: () => void;
  /** True while this row's tx (any action) is confirming. */
  pendingAction: SubAction | 'approve' | null;
  onStake: (amount: string) => void | Promise<void>;
  onWithdraw: (amount: string) => void | Promise<void>;
  onClaim: () => void | Promise<void>;
  onApprove?: () => void | Promise<void>;
}

/**
 * Reassuring note for pools with no fixed conversion cost (USDC, Dola): their
 * deposits/withdrawals route through an underlying yield vault whose share
 * rounding leaves a tiny, expected variance, so the displayed figure is an
 * estimate rather than a guarantee. Worded as normal mechanics, not a fee.
 */
const vaultSlippageTip = (kind: 'stake' | 'withdraw') =>
  kind === 'stake'
    ? `Estimated. Your deposit is routed into an underlying yield vault, and the vault's share-price rounding can leave the amount actually staked a touch different from the figure shown. This is a normal part of the vault mechanics, not a fee.`
    : `Estimated. Your withdrawal is redeemed from an underlying yield vault, and the vault's share-price rounding can leave the amount you receive a touch different from the figure shown. This is a normal part of the vault mechanics, not a fee.`;

function AmountField({
  label,
  balanceLabel,
  balance,
  value,
  onChange,
  tokenSymbol,
  tokenIcon,
  tokenPriceUSD,
  estimateTip,
}: {
  label: string;
  balanceLabel: string;
  balance: number;
  value: string;
  onChange: (v: string) => void;
  tokenSymbol: string;
  tokenIcon: string;
  tokenPriceUSD: number;
  /** Optional note shown beside the ≈ USD line (e.g. vault-rounding slippage). */
  estimateTip?: string;
}) {
  const parsed = parseFloat(value) || 0;
  const usdValue = parsed * tokenPriceUSD;
  const overBalance = parsed > balance + 0.0000001;
  // Truncate (round DOWN) to 4 dp rather than passing the full-precision float.
  // The label only displays `fmtAmount(balance, 4)`, which rounds — so a raw
  // `String(balance)` could submit more precision (or a rounded-up value) than
  // the wallet actually holds, which `parseUnits` turns into an amount that
  // exceeds the on-chain balance and reverts the tx.
  const handleMax = () => onChange(String(Math.floor(balance * 1e4) / 1e4));

  return (
    <div className="mb-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{label}</span>
        <button
          type="button"
          className="text-[12px] text-muted-foreground hover:text-pxusd-white disabled:opacity-50"
          onClick={handleMax}
          disabled={balance <= 0}
        >
          {balanceLabel}: <span className="font-mono text-pxusd-white">{fmtAmount(balance, 4)}</span>
        </button>
      </div>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={[
            'w-full rounded-xl border bg-card px-4 py-3 pr-28 text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
            overBalance ? 'border-pxusd-pink-400/60' : 'border-input',
          ].join(' ')}
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
            onClick={handleMax}
            disabled={balance <= 0}
          >
            MAX
          </button>
          <img src={tokenIcon} alt={tokenSymbol} className="h-5 w-5 rounded-full" />
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          ≈ <span className={`font-mono ${parsed > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{fmtUSD(usdValue)}</span>
          {estimateTip && <InfoTip text={estimateTip} />}
        </span>
        {overBalance && <span className="text-pxusd-pink-400">Insufficient balance</span>}
      </div>
    </div>
  );
}

/**
 * Themed info tooltip. Native `title` bubbles are OS-rendered (unstyleable)
 * and never appear on touch devices, so this renders its own popover: hover
 * opens it on desktop, tap toggles it on touch, and tapping/clicking anywhere
 * else dismisses it.
 *
 * The trigger is a span[role=button], not a real <button>: the tip also
 * renders inside the accordion header (itself a <button>), where a nested
 * button would be invalid HTML. Clicks are stopped at the root so opening the
 * tip never toggles the surrounding accordion.
 */
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  // Tap-away dismissal for touch (where the trigger may never receive focus,
  // so onBlur alone isn't enough).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label="More info"
        aria-expanded={open}
        // Open-only: touch browsers fire a simulated mouseenter before click,
        // so a toggle would open-then-close on the same tap. Dismissal is
        // handled by tap-away / mouse-leave / blur / Escape instead.
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="-m-1 cursor-help p-1 text-[11px] leading-none text-current opacity-70 hover:opacity-100 focus:outline-none focus-visible:opacity-100"
      >
        ⓘ
      </span>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-lg border border-border bg-pxusd-teal-700 px-3 py-2.5 text-left text-[12px] font-normal normal-case leading-relaxed tracking-normal text-pxusd-white/90 shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  );
}

/**
 * Outcome summary rendered under the amount field once the user types an
 * amount (hidden while empty so the default surface stays minimal). Pools
 * with an AMM-routed strategy (conversionBps > 0, e.g. USDe) show the
 * guaranteed entry haircut on stake and the zero-to-max range on withdraw;
 * every other pool shows the exact 1:1 outcome so the row reads consistently
 * across pools.
 */
function OutcomeSummary({
  kind,
  amount,
  tokenSymbol,
  conversionBps,
}: {
  kind: 'stake' | 'withdraw';
  amount: number;
  tokenSymbol: string;
  conversionBps?: number;
}) {
  if (amount <= 0) return null;

  const bps = conversionBps ?? 0;
  const hasCost = bps > 0;
  const pctLabel = `${(bps / 100).toFixed(2)}%`;
  const minAmount = amount * (1 - bps / 10000);

  const headline = kind === 'stake' ? "You'll stake" : "You'll receive";
  const row = 'flex items-center justify-between';
  const label = 'text-muted-foreground';
  const value = 'font-mono font-medium text-foreground';

  if (!hasCost) {
    return (
      <div className={`mb-3.5 text-[12.5px] ${row}`}>
        <span className={label}>{headline}</span>
        <span className={value}>
          {fmtAmount(amount, 4)} {tokenSymbol}
        </span>
      </div>
    );
  }

  const tooltip =
    kind === 'stake'
      ? `A fixed ${pctLabel} conversion cost applies when entering this pool: deposits are routed through an AMM into the pool's yield strategy. The "You'll stake" amount is exactly what gets staked — guaranteed.`
      : `Withdrawals convert back from the pool's yield strategy. If the pool holds an idle buffer you pay nothing; otherwise live AMM pricing applies, capped at ${pctLabel}. You'll never receive less than the minimum shown.`;

  return (
    <div className="mb-3.5 space-y-1 text-[12.5px]">
      <div className={row}>
        <span className={label}>{headline}</span>
        <span className={value}>
          {kind === 'stake'
            ? `${fmtAmount(minAmount, 4)} ${tokenSymbol}`
            : `${fmtAmount(minAmount, 4)} – ${fmtAmount(amount, 4)} ${tokenSymbol}`}
        </span>
      </div>
      <div className={row}>
        <span className={`${label} flex items-center gap-1.5`}>
          {kind === 'stake' ? 'Conversion cost' : 'Exit cost'}
          <InfoTip text={tooltip} />
        </span>
        <span className="font-mono text-muted-foreground">
          {kind === 'stake'
            ? `−${fmtAmount(amount - minAmount, 4)} ${tokenSymbol} (${pctLabel})`
            : `0% – ${pctLabel}`}
        </span>
      </div>
    </div>
  );
}

export default function StakeAccordionRow({
  pool,
  expanded,
  onToggle,
  pendingAction,
  onStake,
  onWithdraw,
  onClaim,
  onApprove,
}: StakeAccordionRowProps) {
  const [subTab, setSubTab] = useState<SubAction>('stake');
  const [stakeAmount, setStakeAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const isBusy = pendingAction !== null;
  const stakeParsed = parseFloat(stakeAmount) || 0;
  const withdrawParsed = parseFloat(withdrawAmount) || 0;
  // The estimate note (vault-rounding slippage) applies only to the stable
  // pools. USDe already explains its slippage via OutcomeSummary's conversion-
  // cost tooltip, so it's excluded; USDC/Dola leak a hair to underlying-vault
  // share rounding and get the note instead. The flagship phUSD pool
  // (isLegacy) is fully controlled with no loss, so it never shows the note.
  const showEstimateTip = !pool.isLegacy && (pool.conversionBps ?? 0) === 0;
  const needsApprove = pool.needsApproval ? pool.needsApproval(stakeAmount) : false;

  // Per-pool underwater status. Only meaningful when the global pause is NOT
  // active (the global pause takes precedence in messaging).
  const isUnderwater = !pool.disabled && pool.withdrawDisabled === true;
  // While underwater the contract still pays withdrawals that fit entirely
  // within the set-aside buffer, so only amounts above it are paused. The
  // epsilon mirrors AmountField's over-balance tolerance.
  const withdrawBuffer = pool.withdrawBuffer ?? 0;
  const overBuffer = isUnderwater && withdrawParsed > withdrawBuffer + 0.0000001;
  // With no buffer at all, every positive amount would exceed it — surface the
  // paused state up front instead of waiting for the user to type.
  const withdrawPaused = isUnderwater && (withdrawBuffer <= 0 || overBuffer);

  const canStake = stakeParsed > 0 && stakeParsed <= pool.walletBalance && !isBusy && !pool.disabled;
  const canWithdraw =
    withdrawParsed > 0 &&
    withdrawParsed <= pool.stakedBalance &&
    !isBusy &&
    !pool.disabled &&
    !overBuffer;
  const canClaim = pool.pendingRewards > 0 && !isBusy;

  const handleStakeSubmit = async () => {
    if (needsApprove && onApprove) {
      await onApprove();
      return;
    }
    if (!canStake) return;
    await onStake(stakeAmount);
    setStakeAmount('');
  };

  const handleWithdrawSubmit = async () => {
    if (!canWithdraw) return;
    await onWithdraw(withdrawAmount);
    setWithdrawAmount('');
  };

  return (
    <div
      className={[
        'mb-2.5 rounded-2xl border bg-white/[0.02] transition-colors',
        expanded ? 'border-primary/40' : 'border-border',
        pool.isLegacy ? 'border-pxusd-teal-400/30' : '',
      ].join(' ')}
    >
      {/* Collapsed header row */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${pool.stakeToken} pool`}
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 text-left sm:grid-cols-[auto_1.1fr_0.9fr_1fr_auto]"
      >
        {/* Token + name. min-w-0 lets this cell shrink instead of forcing the
            grid wider than the viewport, so the subtitle wraps rather than
            colliding with the Pending column on narrow screens. */}
        <div className="flex min-w-0 items-center gap-3.5">
          <img src={pool.stakeIcon} alt={pool.stakeToken} className="h-9 w-9 rounded-full" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[16px] font-bold text-pxusd-white">{pool.stakeToken}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                Earn
                <img src={pool.earnIcon} alt={pool.earnToken} className="h-3.5 w-3.5 rounded-full" />
                <span className={`font-semibold ${pool.isLegacy ? 'text-pxusd-teal-400' : 'text-pxusd-orange-300'}`}>
                  {pool.earnToken}
                </span>
              </span>
              {/* APY lives in its own header column from sm up; below that the
                  column is hidden, so surface it inline here instead. Grouped
                  so the dot and value wrap to a new line as one unit. */}
              <span className="flex items-center gap-1.5 whitespace-nowrap sm:hidden">
                ·
                <span className={`font-mono font-semibold ${pool.isLegacy ? 'text-pxusd-teal-400' : 'text-pxusd-orange-300'}`}>
                  {fmtAPY(pool.apy)} APY
                </span>
              </span>
            </span>
            {isUnderwater && (
              <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-pxusd-yellow-400/35 bg-pxusd-yellow-400/10 px-2 py-0.5 text-[10.5px] font-semibold text-pxusd-yellow-400">
                {withdrawBuffer > 0 ? 'Withdrawals limited' : 'Withdrawals paused'}
                <InfoTip
                  text={
                    withdrawBuffer > 0
                      ? `This pool's yield strategy is rebalancing. Withdrawals up to the set-aside buffer of ${fmtAmount(withdrawBuffer, 2)} ${pool.stakeToken} still go through; larger amounts pause until it settles. Staking and claiming are unaffected.`
                      : "This pool's yield strategy is rebalancing, so withdrawals pause for now. Staking and claiming are unaffected — withdrawals re-enable once it settles."
                  }
                />
              </span>
            )}
          </div>
        </div>

        {/* APY */}
        <div className="hidden flex-col gap-0.5 sm:flex">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">APY</span>
          <span className={`font-mono text-[18px] font-bold ${pool.isLegacy ? 'text-pxusd-teal-400' : 'text-pxusd-orange-300'}`}>
            {fmtAPY(pool.apy)}
          </span>
        </div>

        {/* Your staked */}
        <div className="hidden flex-col gap-0.5 sm:flex">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Your stake</span>
          {pool.stakedBalance > 0 ? (
            <span className="font-mono text-[14px] font-semibold text-pxusd-white">
              {fmtAmount(pool.stakedBalance, 2)}{' '}
              <span className="text-[12px] font-normal text-muted-foreground">{pool.stakeToken}</span>
            </span>
          ) : (
            <span className="font-mono text-[14px] text-muted-foreground">—</span>
          )}
        </div>

        {/* Pending. Mock pools interpolate; the real pool shows the raw
            on-chain value so block refetches (not interpolation) drive it. */}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Pending</span>
          {pool.pendingRewards > 0 || (pool.liveTicker && pool.ratePerSecond > 0) ? (
            <div className="flex flex-wrap items-center gap-x-1.5">
              {pool.liveTicker ? (
                <LiveYieldCounter
                  ratePerSecond={pool.ratePerSecond}
                  initial={pool.pendingRewards}
                  decimals={pool.pendingDecimals}
                  size={14}
                  weight={600}
                />
              ) : (
                <span className="font-mono text-[14px] font-semibold text-pxusd-white">
                  {fmtAmount(pool.pendingRewards, pool.pendingDecimals)}
                </span>
              )}
              <span className="text-[12px] text-muted-foreground">{pool.earnToken}</span>
            </div>
          ) : (
            <span className="font-mono text-[14px] text-muted-foreground">—</span>
          )}
        </div>

        {/* Chevron */}
        <span className={`justify-self-end text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {/* Expanded action panel */}
      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl<SubAction>
              ariaLabel={`${pool.stakeToken} actions`}
              value={subTab}
              onChange={setSubTab}
              options={[
                { value: 'stake', label: 'Stake' },
                { value: 'withdraw', label: 'Withdraw' },
                { value: 'claim', label: 'Claim' },
              ]}
            />
            <span className="text-[12px] text-muted-foreground">{pool.tagline}</span>
          </div>

          {subTab === 'stake' && (
            <div>
              <AmountField
                label="Stake amount"
                balanceLabel="Wallet"
                balance={pool.walletBalance}
                value={stakeAmount}
                onChange={setStakeAmount}
                tokenSymbol={pool.stakeToken}
                tokenIcon={pool.stakeIcon}
                tokenPriceUSD={pool.stakePriceUSD}
                estimateTip={showEstimateTip ? vaultSlippageTip('stake') : undefined}
              />
              <OutcomeSummary
                kind="stake"
                amount={stakeParsed}
                tokenSymbol={pool.stakeToken}
                conversionBps={pool.conversionBps}
              />
              <button
                type="button"
                className={`w-full ${pool.isLegacy ? 'phoenix-btn-secondary' : 'phoenix-btn-primary'} ${(!canStake && !needsApprove) || isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={(!canStake && !(needsApprove && stakeParsed > 0)) || isBusy}
                onClick={handleStakeSubmit}
              >
                {pendingAction === 'approve'
                  ? 'Approving…'
                  : pendingAction === 'stake'
                    ? 'Confirming…'
                    : needsApprove && stakeParsed > 0
                      ? `Approve ${pool.stakeToken}`
                      : `Stake ${pool.stakeToken} → Earn ${pool.earnToken}`}
              </button>
            </div>
          )}

          {subTab === 'withdraw' && (
            <div>
              {isUnderwater && (
                <div className="mb-3.5 rounded-xl border border-pxusd-yellow-400/30 bg-pxusd-yellow-400/[0.06] p-3.5 text-[12.5px] text-muted-foreground">
                  {withdrawBuffer > 0 ? (
                    <>
                      <span className="font-semibold text-pxusd-yellow-400">Withdrawals limited.</span>{' '}
                      This pool's yield strategy is rebalancing. Withdrawals up
                      to the set-aside buffer of{' '}
                      <span className="font-mono text-pxusd-white">
                        {fmtAmount(withdrawBuffer, 2)} {pool.stakeToken}
                      </span>{' '}
                      still go through; larger amounts pause until it settles.
                      Staking and claiming are unaffected.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-pxusd-yellow-400">Withdrawals temporarily paused.</span>{' '}
                      This pool's yield strategy is rebalancing, so withdrawals
                      pause for now. Staking and claiming are
                      unaffected — withdrawals re-enable once it settles.
                    </>
                  )}
                </div>
              )}
              {/* Over the buffer (or underwater with no buffer at all) the
                  form stays interactive as a what-if preview, but is dimmed so
                  it reads as inert. */}
              <div className={withdrawPaused ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                <AmountField
                  label="Withdraw amount"
                  balanceLabel="Staked"
                  balance={pool.stakedBalance}
                  value={withdrawAmount}
                  onChange={setWithdrawAmount}
                  tokenSymbol={pool.stakeToken}
                  tokenIcon={pool.stakeIcon}
                  tokenPriceUSD={pool.stakePriceUSD}
                  estimateTip={showEstimateTip ? vaultSlippageTip('withdraw') : undefined}
                />
                <OutcomeSummary
                  kind="withdraw"
                  amount={withdrawParsed}
                  tokenSymbol={pool.stakeToken}
                  conversionBps={pool.conversionBps}
                />
              </div>
              {overBuffer && (
                <div className="mb-3.5 text-[12px] italic text-muted-foreground">
                  Preview only — this amount exceeds the buffer, so it can only be
                  withdrawn once the strategy recovers.
                </div>
              )}
              <button
                type="button"
                className={`phoenix-btn-ghost w-full ${!canWithdraw ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!canWithdraw}
                onClick={handleWithdrawSubmit}
              >
                {withdrawPaused
                  ? withdrawBuffer > 0
                    ? 'Amount exceeds buffer'
                    : 'Withdrawals paused'
                  : pendingAction === 'withdraw'
                    ? 'Confirming…'
                    : `Withdraw ${pool.stakeToken}`}
              </button>
            </div>
          )}

          {subTab === 'claim' && (
            <div>
              <div className="mb-3.5 rounded-xl border border-border bg-white/[0.03] p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Claimable now</div>
                <div className="flex items-baseline gap-2.5">
                  <img src={pool.earnIcon} alt={pool.earnToken} className="h-5 w-5 self-center rounded-full" />
                  {pool.liveTicker ? (
                    <LiveYieldCounter
                      ratePerSecond={pool.ratePerSecond}
                      initial={pool.pendingRewards}
                      decimals={pool.pendingDecimals}
                      size={18}
                      weight={600}
                    />
                  ) : (
                    <span className="font-mono tabular-nums text-[18px] font-semibold text-pxusd-white">
                      {fmtAmount(pool.pendingRewards, pool.pendingDecimals)}
                    </span>
                  )}
                  <span className="font-mono text-[13px] text-muted-foreground">{pool.earnToken}</span>
                </div>
                <div className="mt-1.5 text-[12px] text-muted-foreground">
                  ≈ <span className="font-mono">{fmtUSD(pool.pendingRewards * pool.earnPriceUSD)}</span>
                </div>
              </div>
              <button
                type="button"
                className={`w-full ${pool.isLegacy ? 'phoenix-btn-secondary' : 'phoenix-btn-primary'} ${!canClaim ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!canClaim}
                onClick={() => onClaim()}
              >
                {pendingAction === 'claim' ? 'Confirming…' : `Claim ${pool.earnToken}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
