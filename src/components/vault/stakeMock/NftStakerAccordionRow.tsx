import { useEffect, useState } from 'react';
import type { StakerKind } from '../../../data/nftStakeMockData';
import SegmentedControl from '../../ui/SegmentedControl';
import ActionButton, { LoadingSpinner } from '../../ui/ActionButton';
import LiveYieldCounter from '../staking/LiveYieldCounter';
import PhUsdCoin from '../staking/PhUsdCoin';
import { fmtAPY } from '../stake/formatStake';

/** Which in-row action panel is active. */
type RowAction = 'stake' | 'unstake' | 'claim';

export interface NftStakerAccordionRowProps {
  name: string;
  /** Rendered as `Earn phUSD · {sub}`. */
  sub: string;
  image: string;
  kind: StakerKind;
  /** The connected wallet's personal APY (%); `null` renders "—", never 0. */
  apy: number | null;
  /**
   * USD price the APY divides by: the wallet's average mint price per held
   * unit, or the current (next-mint) price when it holds none.
   */
  basisPriceUsd: number;
  /** Whether the wallet holds any units (wallet + staked) of this NFT. */
  holdsUnits: boolean;
  stakedUnits: number;
  /** Wallet units available to stake. */
  ownedUnits: number;
  /** phUSD baseline for the live pending counter. */
  pendingYield: number;
  /** phUSD/sec accrual (0 ⇒ pending flat / shows "—"). */
  ratePerSec: number;
  /** Accordion open state (one row open at a time — controlled by parent). */
  isOpen: boolean;
  onToggle: () => void;
  /**
   * Whether this NFT's staker is deployed (non-zero address) on the active
   * network. When false the row's actions are disabled with a "not live yet"
   * affordance (defensive — on mainnet the Uniboost stakers are zero-address).
   */
  isStakerDeployed: boolean;
  /** ERC-1155 `setApprovalForAll(staker, true)` flag for the connected wallet. */
  isApprovedForAll: boolean;
  /** Approve the staker to move the wallet's NFT units (ERC-1155). */
  onApprove: () => void;
  /** Per-action in-flight flags — disable + spin the relevant button. */
  isApproving: boolean;
  isStaking: boolean;
  isUnstaking: boolean;
  isClaiming: boolean;
  /** Live action callbacks (real chain writes via the staker hook). */
  onStake: (units: number) => void;
  onUnstake: (units: number) => void;
  onClaim: () => void;
}

function unitLabel(n: number): string {
  return `${n} unit${n === 1 ? '' : 's'}`;
}

/**
 * APY accent per staker kind: teal for fixed, orange for MasterChef.
 *
 * Applied as an inline literal colour rather than a `pxusd-*` opacity class:
 * those tokens are defined as full hex (`var(--pxusd-teal-400)` -> `#1f5a73`),
 * so a Tailwind opacity modifier compiles to the invalid `rgb(#1f5a73 / 0.24)`
 * and the declaration silently drops. (Carried over from the deleted
 * `ApyRangePill`.)
 */
function apyAccent(kind: StakerKind): { color: string } {
  return { color: kind === 'mc' ? 'rgba(255,181,102,1)' : 'rgba(166,219,239,1)' };
}

function fmtUsd(n: number): string {
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : '—';
}

/**
 * A single NFT staker accordion row.
 *
 * Presentational — plain props only, no mock-data import. Header shows the
 * thumbnail, name + `Earn phUSD · {sub}`, the wallet's personal APY (its own
 * column from `sm` up, inline under the name below that, like
 * `StakeAccordionRow`), staked units, a live-ticking pending value, and a
 * chevron. When open, the expanded panel shows the APY with its cost basis
 * (average mint price), a Stake/Unstake/Claim segmented control, a
 * clamped unit slider + action button (stake / red unstake), and a Claim box
 * with the live claimable amount.
 */
export default function NftStakerAccordionRow({
  name,
  sub,
  image,
  kind,
  apy,
  basisPriceUsd,
  holdsUnits,
  stakedUnits,
  ownedUnits,
  pendingYield,
  ratePerSec,
  isOpen,
  onToggle,
  isStakerDeployed,
  isApprovedForAll,
  onApprove,
  isApproving,
  isStaking,
  isUnstaking,
  isClaiming,
  onStake,
  onUnstake,
  onClaim,
}: NftStakerAccordionRowProps) {
  const [action, setAction] = useState<RowAction>('stake');
  const [sliderVal, setSliderVal] = useState<number>(1);

  const moveMax = action === 'stake' ? ownedUnits : stakedUnits;
  const clampedVal = Math.min(Math.max(0, sliderVal), moveMax);

  // Any live tx disables sibling actions to avoid overlapping writes.
  const txInFlight = isApproving || isStaking || isUnstaking || isClaiming;
  // Stake CTA flips to "Approve" until the ERC-1155 flag confirms.
  const needsApproval = isStakerDeployed && !isApprovedForAll;

  // Reset to Stake + a sensible slider default whenever the row (re)opens,
  // mirroring the redesign HTML (toggle resets sub→'stake', stake→1).
  useEffect(() => {
    if (isOpen) {
      setAction('stake');
      setSliderVal(1);
    }
  }, [isOpen]);

  // Reset the slider to a sensible default when switching Stake/Unstake.
  const selectAction = (next: RowAction) => {
    setAction(next);
    if (next !== 'claim') setSliderVal(1);
  };

  // Pending "—" when there is nothing accruing and nothing pending.
  const hasPending = pendingYield > 0.0000001 || ratePerSec > 0;
  const hasStaked = stakedUnits > 0;
  const apyLabel = apy === null ? '—' : fmtAPY(apy);
  const accent = apyAccent(kind);

  return (
    <div
      className="mb-2.5 overflow-hidden rounded-[14px] border border-border bg-white/[0.02] transition-colors"
      style={isOpen ? { borderColor: 'rgba(255,140,66,0.42)' } : undefined}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="grid w-full cursor-pointer grid-cols-[1.7fr_0.92fr_auto] items-center gap-3 border-none bg-transparent px-3.5 py-3 text-left text-inherit sm:grid-cols-[1.7fr_0.92fr_0.62fr_0.92fr_auto]"
      >
        {/* Name + sub */}
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={image}
            alt={name}
            width={46}
            height={46}
            loading="lazy"
            decoding="async"
            className="block h-[46px] w-[46px] flex-none select-none rounded-[11px] bg-black object-cover"
            draggable={false}
          />
          <div className="min-w-0">
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold text-pxusd-white">
              {name}
            </div>
            <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted-foreground">
              Earn phUSD · {sub}
            </div>
            {/* APY lives in its own header column from sm up; below that the
                column is hidden, so surface it inline here instead. */}
            <div className="mt-0.5 whitespace-nowrap text-[11px] sm:hidden">
              <span className="font-mono font-semibold" style={accent}>
                {apyLabel} APY
              </span>
            </div>
            {!isStakerDeployed && (
              <span className="mt-1 inline-block rounded-full border border-pxusd-orange-500/40 bg-pxusd-orange-900/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-pxusd-orange-300">
                Not live yet
              </span>
            )}
          </div>
        </div>

        {/* APY (desktop column) */}
        <div className="hidden flex-col gap-0.5 sm:flex">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            APY
          </span>
          <span className="font-mono text-[18px] font-bold tabular-nums" style={accent}>
            {apyLabel}
          </span>
        </div>

        {/* Staked */}
        <div className="hidden sm:block">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Staked
          </div>
          <div
            className={[
              'mt-1 font-mono text-[13px] tabular-nums',
              hasStaked ? 'font-semibold text-pxusd-white' : 'font-medium text-muted-foreground',
            ].join(' ')}
          >
            {hasStaked ? unitLabel(stakedUnits) : '—'}
          </div>
        </div>

        {/* Pending (live) */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Pending
          </div>
          <div className="mt-1">
            {hasPending ? (
              <LiveYieldCounter
                ratePerSecond={ratePerSec}
                initial={pendingYield}
                decimals={4}
                size={14}
                weight={700}
              />
            ) : (
              <span className="font-mono text-[13px] font-medium tabular-nums text-muted-foreground">
                —
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <span
          className={[
            'flex justify-self-end text-muted-foreground transition-transform duration-200',
            isOpen ? 'rotate-180' : '',
          ].join(' ')}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path
              d="M5 7.5l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-border px-4 pb-4 pt-3.5">
          {/* Your APY + its cost basis */}
          <div className="mb-3.5 rounded-[12px] border border-border bg-white/[0.02] px-4 py-3">
            <div className="flex items-start justify-center gap-8">
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Your APY
                </div>
                <div
                  className="mt-1.5 font-mono text-[26px] font-bold leading-none tabular-nums"
                  style={accent}
                >
                  {apyLabel}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {holdsUnits ? 'Your avg. mint price' : 'Current mint price'}
                </div>
                <div className="mt-1.5 font-mono text-[26px] font-bold leading-none tabular-nums text-pxusd-white">
                  {fmtUsd(basisPriceUsd)}
                </div>
              </div>
            </div>
            <p className="m-0 mt-2.5 text-center text-[11px] leading-relaxed text-muted-foreground">
              {holdsUnits
                ? "Based on what you paid per NFT. Units you didn't mint yourself count at the current price."
                : 'What a newly minted NFT earns at the current mint price.'}
            </p>
          </div>

          {/* Stake / Unstake / Claim selector */}
          <div className="mb-3.5">
            <SegmentedControl<RowAction>
              ariaLabel="Stake action"
              value={action}
              onChange={selectAction}
              options={[
                { value: 'stake', label: 'Stake' },
                { value: 'unstake', label: 'Unstake' },
                { value: 'claim', label: 'Claim' },
              ]}
            />
          </div>

          {action === 'claim' ? (
            <>
              <div className="mb-3 rounded-[12px] border border-border bg-white/[0.03] px-3.5 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Claimable now
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <PhUsdCoin size={22} />
                  {hasPending ? (
                    <LiveYieldCounter
                      ratePerSecond={ratePerSec}
                      initial={pendingYield}
                      decimals={6}
                      size={20}
                      weight={700}
                    />
                  ) : (
                    <span className="font-mono text-[20px] font-bold tabular-nums text-muted-foreground">
                      0.000000
                    </span>
                  )}
                  <span className="ml-1 font-mono text-xs text-muted-foreground">phUSD</span>
                </div>
              </div>
              <ActionButton
                variant="primary"
                label={isStakerDeployed ? 'Claim phUSD' : 'Not live yet'}
                disabled={!isStakerDeployed || !hasPending || txInFlight}
                isLoading={isClaiming}
                onAction={onClaim}
              />
            </>
          ) : (
            <>
              <div className="mb-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[20px] font-bold tabular-nums text-pxusd-white">
                    {clampedVal}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    of {unitLabel(moveMax)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={moveMax}
                  value={clampedVal}
                  onChange={(e) => setSliderVal(parseInt(e.target.value, 10))}
                  className="my-2.5 h-1.5 w-full cursor-pointer accent-pxusd-orange-400"
                />
                <div className="flex justify-between font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                  <span>0</span>
                  <span>{moveMax}</span>
                </div>
              </div>
              {action === 'stake' ? (
                needsApproval ? (
                  <ActionButton
                    variant="approve"
                    label="Approve for staking"
                    disabled={txInFlight}
                    isLoading={isApproving}
                    onAction={onApprove}
                  />
                ) : (
                  <ActionButton
                    variant="primary"
                    label={
                      isStakerDeployed
                        ? `Stake ${unitLabel(clampedVal)}`
                        : 'Not live yet'
                    }
                    disabled={!isStakerDeployed || clampedVal === 0 || txInFlight}
                    isLoading={isStaking}
                    onAction={() => onStake(clampedVal)}
                  />
                )
              ) : (
                <div className="mt-6">
                  <button
                    type="button"
                    disabled={!isStakerDeployed || clampedVal === 0 || txInFlight}
                    onClick={() => onUnstake(clampedVal)}
                    className={[
                      'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-red-500 to-pxusd-orange-400 px-4 py-2.5 text-[13px] font-bold text-pxusd-white transition-[filter,transform] duration-150',
                      !isStakerDeployed || clampedVal === 0 || txInFlight
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:-translate-y-px hover:brightness-110',
                    ].join(' ')}
                  >
                    {isUnstaking && <LoadingSpinner />}
                    {isStakerDeployed
                      ? `Unstake ${unitLabel(clampedVal)}`
                      : 'Not live yet'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
