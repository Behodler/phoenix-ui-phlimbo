import type { MarketSymbol, TargetSymbol } from '../../../data/uniMarketConfig';
import TokenIcon from './TokenIcon';
import { FOCUS_RING, PHUSD_CHIP_STYLE } from './styles';

/** The non-selectable target side of a swap or deposit (phUSD wherever AM is not deployed). */
export function TargetChip({ sym = 'phUSD' }: { sym?: TargetSymbol }) {
  return (
    <span
      className="inline-flex items-center gap-2 h-11 pl-2 pr-3.5 rounded-full text-base font-semibold flex-shrink-0 text-foreground"
      style={PHUSD_CHIP_STYLE}
    >
      <TokenIcon sym={sym} size={26} />
      <span>{sym}</span>
    </span>
  );
}

interface TokenPickerButtonProps {
  sym: MarketSymbol;
  ariaLabel: string;
  onClick: () => void;
  expanded?: boolean;
}

/** Token selector pill: icon, symbol, chevron. */
export function TokenPickerButton({ sym, ariaLabel, onClick, expanded }: TokenPickerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      className={`inline-flex items-center gap-2 h-11 pl-2 pr-3 rounded-full border border-pxusd-teal-400 bg-pxusd-teal-600 text-foreground text-base font-semibold flex-shrink-0 hover:brightness-110 transition ${FOCUS_RING}`}
    >
      <TokenIcon sym={sym} size={26} />
      <span>{sym}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}
