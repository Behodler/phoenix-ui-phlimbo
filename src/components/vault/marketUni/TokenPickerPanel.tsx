import type { SwapTokenSymbol } from '../../../data/uniMarketMockData';
import type { TokenRowView } from '../../../hooks/useUniMarketMock';
import TokenIcon from './TokenIcon';
import { FOCUS_RING, GHOST_ICON_BTN } from './styles';

interface TokenPickerPanelProps {
  rows: TokenRowView[];
  onSelect: (sym: SwapTokenSymbol) => void;
  onClose: () => void;
}

/** Inline token picker covering the trade panel. */
export default function TokenPickerPanel({ rows, onSelect, onClose }: TokenPickerPanelProps) {
  return (
    <div
      role="dialog"
      aria-label="Select a token"
      className="absolute inset-0 z-[6] bg-pxusd-teal-800 rounded-[18px] p-4 flex flex-col gap-3 overflow-y-auto"
    >
      <div className="flex justify-between items-center">
        <span className="text-base font-semibold text-foreground">Select a token</span>
        <button type="button" onClick={onClose} aria-label="Close" className={`${GHOST_ICON_BTN} text-foreground`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <span className="text-[13px] text-muted-foreground">
        phUSD has one pool, phUSD/sUSDS on Uniswap V2. Other tokens are routed through sUSDS in the same transaction.
      </span>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <button
            key={r.sym}
            type="button"
            aria-pressed={r.selected}
            onClick={() => onSelect(r.sym)}
            className={`flex items-center gap-3 w-full min-h-[60px] px-3 py-2 rounded-xl text-left text-foreground transition-colors hover:bg-pxusd-teal-600 ${FOCUS_RING}`}
            style={r.selected
              ? { background: 'rgba(255,140,66,0.10)', border: '1px solid rgba(255,140,66,0.45)' }
              : { border: '1px solid transparent' }}
          >
            <TokenIcon sym={r.sym} size={34} />
            <span className="flex flex-col items-start gap-0.5 flex-1 min-w-0">
              <span className="text-[15px] font-semibold">{r.sym}</span>
              <span className="text-xs text-muted-foreground">{r.name} · {r.hint}</span>
            </span>
            <span className="text-sm text-[rgba(240,245,248,0.8)]">{r.balText}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
