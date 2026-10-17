import { useUniMarket, type LiquidityAction, type TopMode } from '../../../hooks/useUniMarket';
import SegmentedControl from '../../ui/SegmentedControl';
import UniswapLogo from '../../ui/UniswapLogo';
import AddLiquidityPanel from './AddLiquidityPanel';
import LiquidityPositionCard from './LiquidityPositionCard';
import PressedToggle from './PressedToggle';
import QuoteStats from './QuoteStats';
import RemoveLiquidityPanel from './RemoveLiquidityPanel';
import ReviewModal from './ReviewModal';
import RouteView from './RouteView';
import SettingsPopover from './SettingsPopover';
import SwapPanel from './SwapPanel';
import TokenPickerPanel from './TokenPickerPanel';
import { FOCUS_RING, GHOST_ICON_BTN, INSET } from './styles';

const MODE_OPTIONS: { value: TopMode; label: string }[] = [
  { value: 'swap', label: 'Swap' },
  { value: 'liquidity', label: 'Liquidity' },
];

/**
 * "Market (uni)" — MOCKED preview of the Uniswap V2 phUSD/sUSDS market
 * (stories 084, 085: swap, plus a Liquidity mode with the LP position and
 * Add / Remove). Every number, balance and transaction is simulated by
 * `useUniMarket`; nothing is read from or sent to a chain. Takes no props:
 * it deliberately does not consume the Balancer price that feeds the live
 * Market tab.
 */
export default function MarketUniTab() {
  const m = useUniMarket();
  const isSwap = m.mode === 'swap';
  const isRemove = m.mode === 'remove';
  const quote = isSwap ? m.swap : isRemove ? m.remove : m.add;
  const hasStats = quote.valid;
  const stats = quote.stats;

  return (
    <div className="p-6 flex flex-col gap-5 tabular-nums">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-bold text-foreground m-0">Market</h2>
        <p className="text-sm text-muted-foreground m-0">Trade phUSD or provide liquidity to earn fees.</p>
      </div>

      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span role="img" aria-label="Uniswap logo" className="inline-flex">
            <UniswapLogo />
          </span>
          <h3 className="text-lg font-semibold text-pxusd-orange-300 m-0">phUSD trades on Uniswap</h3>
        </div>
        <p className="text-sm text-muted-foreground m-0">
          phUSD trades against sUSDS in a classic 50/50 x·y=k Uniswap V2 pool. Other stablecoins and ETH are routed
          through sUSDS automatically.
        </p>
      </div>

      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg px-4 py-3.5 flex justify-between items-center gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm text-foreground">Current market price</span>
          <span className="text-xs text-[rgba(240,245,248,0.55)]">{m.tickerPair}</span>
        </div>
        <span
          data-testid="mku-ticker-price"
          className={`text-2xl font-bold ${m.priceAtOrAboveDollar ? 'text-green-400' : 'text-pxusd-pink-400'}`}
        >
          {m.tickerPrice}
        </span>
      </div>

      <section
        aria-label="Trade panel"
        className="relative w-full max-w-[560px] mx-auto bg-pxusd-teal-800 border border-pxusd-teal-600 rounded-[18px] p-4 flex flex-col gap-3.5"
      >
        <div className="flex items-center justify-between gap-3">
          <SegmentedControl<TopMode>
            options={MODE_OPTIONS}
            value={m.topMode}
            onChange={m.setTopMode}
            ariaLabel="Mode"
          />
          <button
            type="button"
            aria-label="Transaction settings"
            aria-expanded={m.settingsOpen}
            aria-controls={m.settingsOpen ? 'mku-settings' : undefined}
            onClick={m.toggleSettings}
            className={`${GHOST_ICON_BTN} border border-pxusd-teal-600 text-[rgba(240,245,248,0.8)]`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        {m.settingsOpen && (
          <SettingsPopover
            options={m.slippageOptions}
            slippage={m.slip}
            onSelect={m.setSlippage}
            deadlineMinutes={m.deadlineMinutes}
          />
        )}

        {isSwap ? (
          <SwapPanel m={m} />
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <LiquidityPositionCard m={m} />
              <PressedToggle<LiquidityAction>
                ariaLabel="Liquidity action"
                options={[
                  { value: 'add', content: 'Add', selected: !isRemove },
                  { value: 'remove', content: 'Remove', selected: isRemove },
                ]}
                onSelect={m.setLiqAction}
                groupClassName="grid grid-cols-2 gap-1 rounded-xl border border-pxusd-teal-600 bg-pxusd-teal-950 p-1"
                buttonClassName="h-10 rounded-[9px] border-none text-sm"
                onClassName="bg-pxusd-teal-600 text-pxusd-orange-300 font-bold"
                offClassName="bg-transparent text-[rgba(240,245,248,0.65)] font-semibold hover:text-foreground"
              />
            </div>
            {isRemove ? <RemoveLiquidityPanel m={m} /> : <AddLiquidityPanel m={m} />}
          </>
        )}

        {hasStats && <QuoteStats stats={stats} className={`${INSET} px-3.5 py-3`} />}

        {isSwap && m.swap.valid && (
          <RouteView syms={m.swap.syms} venues={m.swap.venues} summary={m.routeSummary} />
        )}

        <button
          type="button"
          disabled={!m.cta.enabled}
          onClick={m.startReview}
          className={`w-full h-[54px] rounded-[14px] text-base font-bold tracking-[0.3px] ${FOCUS_RING} ${
            m.cta.enabled
              ? 'phoenix-btn-primary !p-0'
              : 'bg-pxusd-teal-600 text-[rgba(240,245,248,0.55)] cursor-not-allowed'
          }`}
        >
          {m.cta.label}
        </button>

        {m.pickerOpen && (
          <TokenPickerPanel rows={m.tokenRows} onSelect={m.selectToken} onClose={m.closePicker} />
        )}
      </section>

      <a
        href={m.uniswapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`self-center inline-flex items-center gap-2 min-h-[44px] text-sm font-medium no-underline text-pxusd-orange-300 hover:brightness-110 rounded ${FOCUS_RING}`}
      >
        <UniswapLogo className="w-4 h-4" />
        <span>Or trade directly on Uniswap</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </svg>
      </a>

      {m.modal && <ReviewModal m={m} />}
    </div>
  );
}
