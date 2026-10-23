import type { UniMarket } from '../../../hooks/useUniMarket';
import type { RemoveOutSymbol } from '../../../data/uniMarketConfig';
import LpPairIcon from './LpPairIcon';
import PressedToggle from './PressedToggle';
import TokenIcon from './TokenIcon';
import { BOX, FOCUS_RING, PCT_CHIP_ON_STYLE } from './styles';

/**
 * Remove-liquidity mode: burn UNI-V2 (typed or 25/50/75/Max of the position)
 * and receive phUSD plus the sUSDS side, either as sUSDS (UniswapHelper.removeLiquiditySUSDS) or redeemed
 * to USDS (UniswapHelper.removeLiquidityUSDS).
 */
export default function RemoveLiquidityPanel({ m }: { m: UniMarket }) {
  return (
    <div className="flex flex-col">
      <div className={BOX}>
        <div className="flex justify-between gap-3 text-[13px] text-muted-foreground">
          <label htmlFor="mku-rlp">Burn LP tokens</label>
          <span>Balance: {m.lpBalText} {m.lpSymbol}</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="mku-rlp"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.0"
            value={m.rLpStr}
            onChange={(e) => m.setRemoveLp(e.target.value)}
            className={`flex-1 min-w-0 bg-transparent border-none text-foreground text-[30px] font-semibold p-0 placeholder:text-[rgba(240,245,248,0.35)] rounded-md ${FOCUS_RING} focus:outline-none`}
          />
          <span className="inline-flex items-center gap-2 h-11 pl-2 pr-3.5 rounded-full border border-pxusd-teal-400 bg-pxusd-teal-600 text-foreground text-base font-semibold flex-shrink-0">
            <LpPairIcon size={24} ringClass="border-pxusd-teal-600" />
            <span>{m.lpSymbol}</span>
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {m.pctOptions.map((o) => (
            <button
              key={o.p}
              type="button"
              aria-pressed={o.selected}
              onClick={() => m.pickRemovePct(o.p)}
              className={`h-10 min-w-0 rounded-[10px] border text-sm font-semibold ${FOCUS_RING} ${
                o.selected
                  ? 'border-pxusd-orange-400 text-pxusd-orange-300'
                  : 'bg-pxusd-teal-800 border-pxusd-teal-600 text-foreground hover:bg-pxusd-teal-600'
              }`}
              style={o.selected ? PCT_CHIP_ON_STYLE : undefined}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center -my-3.5 relative z-[2]">
        <span
          aria-hidden="true"
          className="w-11 h-11 rounded-xl border-4 border-pxusd-teal-800 bg-pxusd-teal-600 text-pxusd-orange-300 inline-flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="m19 12-7 7-7-7" />
          </svg>
        </span>
      </div>

      <div className={BOX}>
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <span id="mku-rcv" className="text-[13px] text-muted-foreground">You receive</span>
          <PressedToggle<RemoveOutSymbol>
            ariaLabel="Receive the sUSDS side as"
            options={m.outOptions.map((o) => ({
              value: o.sym,
              selected: o.selected,
              content: (
                <>
                  <TokenIcon sym={o.sym} size={18} />
                  <span>{o.sym}</span>
                </>
              ),
            }))}
            onSelect={m.setRemoveOut}
            groupClassName="flex gap-1 rounded-[10px] border border-pxusd-teal-600 bg-pxusd-teal-950 p-[3px]"
            buttonClassName="inline-flex items-center gap-1.5 h-9 pl-1.5 pr-2.5 rounded-lg border text-[13px] font-semibold"
            onClassName="bg-pxusd-teal-600 border-pxusd-teal-400 text-pxusd-orange-300"
            offClassName="bg-transparent border-transparent text-[rgba(240,245,248,0.65)] hover:text-foreground"
          />
        </div>
        <ul aria-labelledby="mku-rcv" className="m-0 p-0 list-none flex flex-col gap-2.5">
          {m.receiveRows.map((r) => (
            <li key={r.sym} className="flex justify-between items-center gap-3 min-h-9">
              <span className="text-2xl font-semibold text-foreground break-all">{r.amount}</span>
              <span className="inline-flex items-center gap-2 text-base font-semibold text-foreground flex-shrink-0">
                <TokenIcon sym={r.sym} size={24} />
                {r.sym}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between gap-3 text-[13px] text-[rgba(240,245,248,0.55)]">
          <span>{m.removeNote}</span>
          <span>{m.removeUsd}</span>
        </div>
      </div>
    </div>
  );
}
