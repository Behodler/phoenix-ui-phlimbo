import type { UniMarket } from '../../../hooks/useUniMarket';
import TokenAmountBox from './TokenAmountBox';
import TokenIcon from './TokenIcon';
import { PhUSDChip, TokenPickerButton } from './TokenChips';
import { FOCUS_RING } from './styles';

/**
 * Add-liquidity mode: chosen deposit token (USDS default, or sUSDS) + phUSD,
 * linked at the pool ratio. USDS is wrapped to sUSDS by UniswapHelper.addLiquidityUSDS.
 */
export default function AddLiquidityPanel({ m }: { m: UniMarket }) {
  const depositSelector = (
    <div className="relative flex-shrink-0">
      <TokenPickerButton
        sym={m.addSym}
        ariaLabel={`Select deposit token, currently ${m.addSym}`}
        onClick={m.toggleAddPicker}
        expanded={m.addPickerOpen}
      />
      {m.addPickerOpen && (
        <div
          role="group"
          aria-label="Deposit token"
          className="absolute right-0 top-[calc(100%+6px)] z-[7] w-44 rounded-xl border border-pxusd-teal-400 bg-pxusd-teal-700 p-1.5 flex flex-col gap-1 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
        >
          {m.addTokens.map((sym) => {
            const on = sym === m.addSym;
            return (
              <button
                key={sym}
                type="button"
                aria-pressed={on}
                onClick={() => m.selectAddToken(sym)}
                className={`flex items-center gap-2.5 w-full min-h-[44px] px-2.5 rounded-lg text-left text-foreground text-[15px] font-semibold hover:bg-pxusd-teal-600 ${FOCUS_RING}`}
                style={on ? { background: 'rgba(255,140,66,0.10)', border: '1px solid rgba(255,140,66,0.45)' } : { border: '1px solid transparent' }}
              >
                <TokenIcon sym={sym} size={24} />
                <span className="flex-1">{sym}</span>
                {sym === 'USDS' && <span className="text-[11px] font-medium text-muted-foreground">wraps</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col">
      <TokenAmountBox
        id="mku-atok"
        label="Deposit"
        value={m.aTokStr}
        onChange={m.setAddTok}
        balanceText={m.addTokBalText}
        usdText={m.aTokUsd}
        onMax={m.addTokMax}
        token={depositSelector}
      />

      <div className="flex justify-center -my-3.5 relative z-[2]">
        <span
          title="Amounts always follow the pool ratio"
          className="h-11 px-3.5 rounded-xl border-4 border-pxusd-teal-800 bg-pxusd-teal-600 text-pxusd-orange-300 inline-flex items-center gap-1.5 text-[13px] font-semibold"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>Pool ratio</span>
        </span>
      </div>

      <TokenAmountBox
        id="mku-aph"
        label="Deposit"
        value={m.aPhStr}
        onChange={m.setAddPh}
        balanceText={m.phBalText}
        usdText={m.aPhUsd}
        onMax={m.addPhMax}
        token={<PhUSDChip />}
      />
    </div>
  );
}
