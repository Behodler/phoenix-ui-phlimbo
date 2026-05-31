import { useState } from 'react';
import LiveYieldCounter from '../staking/LiveYieldCounter';
import SegmentedControl from '../../ui/SegmentedControl';
import { fmtUSD, fmtAmount, fmtAPY } from '../../../data/mockStablePools';

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
  /** Whether phUSD approval is needed for the entered stake amount (real pool only). */
  needsApproval?: (amount: string) => boolean;
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

function AmountField({
  label,
  balanceLabel,
  balance,
  value,
  onChange,
  tokenSymbol,
  tokenIcon,
  tokenPriceUSD,
}: {
  label: string;
  balanceLabel: string;
  balance: number;
  value: string;
  onChange: (v: string) => void;
  tokenSymbol: string;
  tokenIcon: string;
  tokenPriceUSD: number;
}) {
  const parsed = parseFloat(value) || 0;
  const usdValue = parsed * tokenPriceUSD;
  const overBalance = parsed > balance + 0.0000001;
  const handleMax = () => onChange(String(balance));

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
        <span>
          ≈ <span className={`font-mono ${parsed > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{fmtUSD(usdValue)}</span>
        </span>
        {overBalance && <span className="text-pxusd-pink-400">Insufficient balance</span>}
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
  const needsApprove = pool.needsApproval ? pool.needsApproval(stakeAmount) : false;

  const canStake = stakeParsed > 0 && stakeParsed <= pool.walletBalance && !isBusy && !pool.disabled;
  const canWithdraw = withdrawParsed > 0 && withdrawParsed <= pool.stakedBalance && !isBusy && !pool.disabled;
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
        {/* Token + name */}
        <div className="flex items-center gap-3.5">
          <img src={pool.stakeIcon} alt={pool.stakeToken} className="h-9 w-9 rounded-full" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[16px] font-bold text-pxusd-white">{pool.stakeToken}</span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              Earn
              <img src={pool.earnIcon} alt={pool.earnToken} className="h-3.5 w-3.5 rounded-full" />
              <span className={`font-semibold ${pool.isLegacy ? 'text-pxusd-teal-400' : 'text-pxusd-orange-300'}`}>
                {pool.earnToken}
              </span>
            </span>
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

        {/* Pending (live counter) */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Pending</span>
          {pool.pendingRewards > 0 || pool.ratePerSecond > 0 ? (
            <div className="flex items-center gap-1.5">
              <LiveYieldCounter
                ratePerSecond={pool.ratePerSecond}
                initial={pool.pendingRewards}
                decimals={pool.pendingDecimals}
                size={14}
                weight={600}
              />
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
              <AmountField
                label="Withdraw amount"
                balanceLabel="Staked"
                balance={pool.stakedBalance}
                value={withdrawAmount}
                onChange={setWithdrawAmount}
                tokenSymbol={pool.stakeToken}
                tokenIcon={pool.stakeIcon}
                tokenPriceUSD={pool.stakePriceUSD}
              />
              <button
                type="button"
                className={`phoenix-btn-ghost w-full ${!canWithdraw ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!canWithdraw}
                onClick={handleWithdrawSubmit}
              >
                {pendingAction === 'withdraw' ? 'Confirming…' : `Withdraw ${pool.stakeToken}`}
              </button>
            </div>
          )}

          {subTab === 'claim' && (
            <div>
              <div className="mb-3.5 rounded-xl border border-border bg-white/[0.03] p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Claimable now</div>
                <div className="flex items-baseline gap-2.5">
                  <img src={pool.earnIcon} alt={pool.earnToken} className="h-5 w-5 self-center rounded-full" />
                  <LiveYieldCounter
                    ratePerSecond={pool.ratePerSecond}
                    initial={pool.pendingRewards}
                    decimals={pool.pendingDecimals}
                    size={18}
                    weight={600}
                  />
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
