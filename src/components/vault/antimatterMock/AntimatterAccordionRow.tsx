import type { ReactNode } from 'react';
import LiveYieldCounter from '../staking/LiveYieldCounter';
import { fmtAPY, fmtAmount } from '../stake/formatStake';
import { ANTIMATTER_ACCENT } from '../../../data/antimatterMockData';
import antimatterIcon from '../../../assets/antimatter.png';

/**
 * Collapsed header row for a stable pool on the **mock** Antimatter tab.
 *
 * Every figure passed in is simulated — see `src/data/antimatterMockData.ts`.
 * The expanded body is supplied by the caller as `children` and is a
 * placeholder until story 080 lands the stake / withdraw / annihilate panel.
 */
export interface AntimatterAccordionRowProps {
  symbol: string;
  icon: string;
  apy: number;
  staked: number;
  /** Antimatter accrued as of the last rebase — the counter's baseline. */
  pendingBase: number;
  /** Antimatter accrued per second, demo multiplier already applied. */
  ratePerSecond: number;
  antimatterSymbol: string;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

/** Chevron matching the live Stake tab's, rotated when the row is open. */
function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="justify-self-end text-muted-foreground transition-transform"
      style={{ transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-flex' }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function AntimatterAccordionRow({
  symbol,
  icon,
  apy,
  staked,
  pendingBase,
  ratePerSecond,
  antimatterSymbol,
  expanded,
  onToggle,
  children,
}: AntimatterAccordionRowProps) {
  return (
    <div
      className="mb-2.5 rounded-2xl border bg-white/[0.02] transition-colors"
      // Tinted lavender borders must be literal rgba: a Tailwind opacity
      // modifier on a full-hex token (`border-pxusd-purple-300/45`) compiles to
      // the invalid `rgb(#C4AEEA / 0.45)` and silently drops the border.
      style={{ borderColor: expanded ? 'rgba(196,174,234,.45)' : 'rgba(255,255,255,.12)' }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${symbol} pool`}
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 text-left sm:grid-cols-[auto_1.1fr_0.9fr_1fr_auto]"
      >
        {/* min-w-0 lets this cell shrink instead of forcing the grid wider than
            the viewport — the same requirement StakeAccordionRow documents. */}
        <div className="flex min-w-0 items-center gap-3.5">
          <img src={icon} alt={symbol} className="h-9 w-9 rounded-full" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[16px] font-bold text-pxusd-white">{symbol}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                Earn
                <img src={antimatterIcon} alt="" aria-hidden="true" className="h-3.5 w-3.5 rounded-full" />
                <span className="font-semibold text-pxusd-purple-300">{antimatterSymbol}</span>
              </span>
              {/* The APY column is dropped below sm, so re-surface it inline. */}
              <span className="flex items-center gap-1.5 whitespace-nowrap sm:hidden">
                ·
                <span className="font-mono font-semibold text-pxusd-purple-300">{fmtAPY(apy)} APY</span>
              </span>
            </span>
          </div>
        </div>

        <div className="hidden flex-col gap-0.5 sm:flex">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">APY</span>
          <span className="font-mono text-[18px] font-bold text-pxusd-purple-300">{fmtAPY(apy)}</span>
        </div>

        <div className="hidden flex-col gap-0.5 sm:flex">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Your stake</span>
          <span className="font-mono text-[14px] font-semibold text-pxusd-white">
            {fmtAmount(staked, 4)}{' '}
            <span className="text-[12px] font-normal text-muted-foreground">{symbol}</span>
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Pending</span>
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <LiveYieldCounter
              ratePerSecond={ratePerSecond}
              initial={pendingBase}
              decimals={6}
              size={14}
              weight={600}
              accentColor={ANTIMATTER_ACCENT}
            />
            <span className="text-[12px] font-normal text-muted-foreground">{antimatterSymbol}</span>
          </span>
        </div>

        <Chevron expanded={expanded} />
      </button>

      {expanded && <div className="border-t border-border px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}
