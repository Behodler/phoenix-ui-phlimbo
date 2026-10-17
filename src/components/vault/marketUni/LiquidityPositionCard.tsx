import type { UniMarket } from '../../../hooks/useUniMarket';
import LpPairIcon from './LpPairIcon';
import TokenIcon from './TokenIcon';
import { SHARE_PILL_STYLE } from './styles';

const CARD = 'bg-pxusd-teal-700 rounded-[14px] px-4 py-3.5 flex flex-col';

/**
 * The connected wallet's UNI-V2 position (share, LP amount, USD value and the
 * underlying sUSDS / phUSD), or a dashed empty card when it holds none.
 */
export default function LiquidityPositionCard({ m }: { m: UniMarket }) {
  if (!m.hasPosition) {
    return (
      <div className={`${CARD} gap-1 border border-dashed border-pxusd-teal-400`}>
        <span className="text-sm font-semibold text-foreground">No liquidity in this pool yet</span>
        <span className="text-[13px] text-muted-foreground">
          Add sUSDS and phUSD at the pool ratio to earn 0.30% of every trade. Your position will show here.
        </span>
      </div>
    );
  }

  return (
    <section aria-labelledby="mku-pos-title" className={`${CARD} gap-2.5 border border-pxusd-teal-600`}>
      <div className="flex justify-between items-center gap-3">
        <h4 id="mku-pos-title" className="m-0 text-[13px] font-normal text-muted-foreground">Your position</h4>
        <span className="text-xs font-semibold text-pxusd-orange-300 rounded-full px-2.5 py-[3px]" style={SHARE_PILL_STYLE}>
          {m.positionShare} of pool
        </span>
      </div>
      <div className="flex justify-between items-baseline gap-3 flex-wrap">
        <span className="inline-flex items-center gap-2.5 min-w-0">
          <LpPairIcon size={24} ringClass="border-pxusd-teal-700" />
          <span data-testid="mku-pos-lp" className="text-[22px] font-bold text-foreground">{m.positionLp}</span>
          <span className="text-sm font-semibold text-muted-foreground">{m.lpSymbol}</span>
        </span>
        <span className="text-sm text-muted-foreground">{m.positionValue}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {([['sUSDS', m.positionS], ['phUSD', m.positionPh]] as const).map(([sym, amount]) => (
          <div key={sym} className="flex items-center gap-2 px-2.5 py-2 rounded-[10px] bg-pxusd-teal-800 text-sm min-w-0">
            <TokenIcon sym={sym} size={18} />
            <span className="font-semibold text-foreground truncate">{amount}</span>
            <span className="text-muted-foreground">{sym}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
