import { useEffect, useState } from 'react';
import type { StakerKind } from '../../../data/nftStakeMockData';
import SegmentedControl from '../../ui/SegmentedControl';
import ActionButton from '../../ui/ActionButton';
import LiveYieldCounter from '../staking/LiveYieldCounter';
import PhUsdCoin from '../staking/PhUsdCoin';
import ApyRangePill from './ApyRangePill';

/** Which in-row action panel is active. */
type RowAction = 'stake' | 'unstake' | 'claim';

export interface NftStakerAccordionRowProps {
  name: string;
  /** Rendered as `Earn phUSD · {sub}`. */
  sub: string;
  image: string;
  kind: StakerKind;
  floorApy: number;
  ceilApy: number;
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
  /** Stubbed action callbacks (no-op in the mock orchestrator). */
  onStake: (units: number) => void;
  onUnstake: (units: number) => void;
  onClaim: () => void;
}

function unitLabel(n: number): string {
  return `${n} unit${n === 1 ? '' : 's'}`;
}

/**
 * A single NFT staker accordion row.
 *
 * Presentational — plain props only, no mock-data import. Header shows the
 * thumbnail, name + `Earn phUSD · {sub}`, an APY-range pill, staked units, a
 * live-ticking pending value, and a chevron. When open, the expanded panel
 * renders the APY-range explainer, a Stake/Unstake/Claim segmented control, a
 * clamped unit slider + action button (stake / red unstake), and a Claim box
 * with the live claimable amount.
 */
export default function NftStakerAccordionRow({
  name,
  sub,
  image,
  kind,
  floorApy,
  ceilApy,
  stakedUnits,
  ownedUnits,
  pendingYield,
  ratePerSec,
  isOpen,
  onToggle,
  onStake,
  onUnstake,
  onClaim,
}: NftStakerAccordionRowProps) {
  const [action, setAction] = useState<RowAction>('stake');
  const [sliderVal, setSliderVal] = useState<number>(1);

  const moveMax = action === 'stake' ? ownedUnits : stakedUnits;
  const clampedVal = Math.min(Math.max(0, sliderVal), moveMax);

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

  return (
    <div
      className="mb-2.5 overflow-hidden rounded-[14px] border border-border bg-white/[0.02] transition-colors"
      style={isOpen ? { borderColor: 'rgba(255,140,66,0.42)' } : undefined}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="grid w-full cursor-pointer grid-cols-[1.7fr_0.92fr_0.92fr_auto] items-center gap-3 border-none bg-transparent px-3.5 py-3 text-left text-inherit sm:grid-cols-[1.7fr_0.92fr_0.62fr_0.92fr_auto]"
      >
        {/* Name + sub */}
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={image}
            alt={name}
            width={46}
            height={46}
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
          </div>
        </div>

        {/* APY range pill + caption */}
        <div>
          <ApyRangePill floor={floorApy} ceil={ceilApy} variant={kind} />
          <div className="mt-1 hidden text-[8.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground sm:block">
            APY range
          </div>
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
          {/* APY range explainer */}
          <div className="mb-3.5 rounded-[12px] border border-border bg-white/[0.02] px-4 py-3">
            <div className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              APY range
            </div>
            <div className="mt-2.5 flex items-center justify-center gap-5">
              <div className="text-center">
                <div
                  className="font-mono text-[26px] font-bold leading-none tabular-nums"
                  style={{ color: '#a6dbef' }}
                >
                  {floorApy.toFixed(1)}%
                </div>
                <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                  Latest mint
                </div>
              </div>
              <span className="-mt-3 text-xl text-muted-foreground">→</span>
              <div className="text-center">
                <div className="font-mono text-[26px] font-bold leading-none tabular-nums text-pxusd-orange-300">
                  {ceilApy.toFixed(1)}%
                </div>
                <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                  Earliest mint
                </div>
              </div>
            </div>
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
                label="Claim phUSD"
                disabled={!hasPending}
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
                <ActionButton
                  variant="primary"
                  label={`Stake ${unitLabel(clampedVal)}`}
                  disabled={clampedVal === 0}
                  onAction={() => onStake(clampedVal)}
                />
              ) : (
                <div className="mt-6">
                  <button
                    type="button"
                    disabled={clampedVal === 0}
                    onClick={() => onUnstake(clampedVal)}
                    className={[
                      'w-full rounded-xl bg-gradient-to-br from-red-500 to-pxusd-orange-400 px-4 py-2.5 text-[13px] font-bold text-pxusd-white transition-[filter,transform] duration-150',
                      clampedVal === 0
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:-translate-y-px hover:brightness-110',
                    ].join(' ')}
                  >
                    Unstake {unitLabel(clampedVal)}
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
