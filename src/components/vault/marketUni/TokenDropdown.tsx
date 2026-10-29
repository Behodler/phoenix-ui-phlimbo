import { useRef, type ReactNode } from 'react';
import type { MarketSymbol } from '../../../data/uniMarketConfig';
import TokenIcon from './TokenIcon';
import { TokenPickerButton } from './TokenChips';
import { useDismiss } from './useDismiss';
import { FOCUS_RING } from './styles';

export interface TokenDropdownOption<T extends MarketSymbol> {
  sym: T;
  /** Full token name under the symbol. */
  name?: string;
  /** Small tag on the right (e.g. "wraps"). */
  tag?: ReactNode;
}

interface TokenDropdownProps<T extends MarketSymbol> {
  value: T;
  options: readonly TokenDropdownOption<T>[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (sym: T) => void;
  /** Accessible name of the trigger, e.g. "Select deposit token". */
  ariaLabel: string;
  /** Accessible name of the option group. */
  groupLabel: string;
}

/** Token pill that drops a small option list; closes on click-away or Escape. */
export default function TokenDropdown<T extends MarketSymbol>({
  value, options, open, onToggle, onClose, onSelect, ariaLabel, groupLabel,
}: TokenDropdownProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose, open);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <TokenPickerButton sym={value} ariaLabel={`${ariaLabel}, currently ${value}`} onClick={onToggle} expanded={open} />
      {open && (
        <div
          role="group"
          aria-label={groupLabel}
          className="absolute right-0 top-[calc(100%+6px)] z-[7] w-52 rounded-xl border border-pxusd-teal-400 bg-pxusd-teal-700 p-1.5 flex flex-col gap-1 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
        >
          {options.map((o) => {
            const on = o.sym === value;
            return (
              <button
                key={o.sym}
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(o.sym)}
                className={`flex items-center gap-2.5 w-full min-h-[44px] px-2.5 py-1 rounded-lg text-left text-foreground hover:bg-pxusd-teal-600 ${FOCUS_RING}`}
                style={on ? { background: 'rgba(255,140,66,0.10)', border: '1px solid rgba(255,140,66,0.45)' } : { border: '1px solid transparent' }}
              >
                <TokenIcon sym={o.sym} size={24} />
                <span className="flex flex-col flex-1 min-w-0">
                  <span className="text-[15px] font-semibold">{o.sym}</span>
                  {o.name && <span className="text-[11px] text-muted-foreground truncate">{o.name}</span>}
                </span>
                {o.tag && <span className="text-[11px] font-medium text-muted-foreground">{o.tag}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
