import type { MarketSymbol } from '../../../data/uniMarketMockData';
import TokenIcon from './TokenIcon';
import { INSET } from './styles';

interface RouteViewProps {
  syms: MarketSymbol[];
  venues: string[];
  summary: string;
}

/** Token chips joined by venue-labelled arrows. Endpoints solid, intermediates dashed. */
export default function RouteView({ syms, venues, summary }: RouteViewProps) {
  const first = syms[0];
  const last = syms[syms.length - 1];
  return (
    <div className={`${INSET} px-3.5 py-3 flex flex-col gap-2.5`}>
      <div className="flex justify-between text-[13px] text-muted-foreground">
        <span>Route</span>
        <span>{summary}</span>
      </div>
      <ol aria-label="Swap route" className="m-0 p-0 list-none flex flex-wrap items-start gap-y-2.5">
        {syms.map((sym, i) => {
          const end = sym === first || sym === last;
          return (
            <li key={`${sym}-${i}`} className="flex items-start">
              <span
                className={[
                  'inline-flex items-center gap-1.5 h-7 pl-[5px] pr-2.5 rounded-full text-xs font-semibold whitespace-nowrap',
                  end
                    ? 'bg-pxusd-teal-600 border border-pxusd-teal-400 text-foreground'
                    : 'bg-transparent border border-dashed border-pxusd-teal-400 text-[rgba(240,245,248,0.8)]',
                ].join(' ')}
              >
                <TokenIcon sym={sym} size={18} />
                {sym}
              </span>
              {i < syms.length - 1 && (
                <span className="flex flex-col items-center gap-0.5 w-[74px] pt-0.5">
                  <svg width="40" height="10" viewBox="0 0 40 10" fill="none" stroke="var(--pxusd-teal-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 5h34" />
                    <path d="m32 1 4 4-4 4" />
                  </svg>
                  <span className="text-[10px] leading-tight text-center text-muted-foreground">{venues[i]}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
