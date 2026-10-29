import type { UniMarket } from '../../../hooks/useUniMarket';
import { metaOf } from '../../../data/uniMarketConfig';
import TokenAmountBox from './TokenAmountBox';
import TokenDropdown from './TokenDropdown';
import { TargetChip } from './TokenChips';

/**
 * Add-liquidity mode: chosen deposit token (USDS default, or sUSDS) + the pair's
 * target (phUSD, or AM where the AM/sUSDS pair is live), linked at the pool ratio.
 * USDS is wrapped to sUSDS by UniswapHelper.addLiquidityUSDS / addLiquidityAMUSDS.
 */
export default function AddLiquidityPanel({ m }: { m: UniMarket }) {
  const depositSelector = (
    <TokenDropdown
      value={m.addSym}
      options={m.addTokens.map((sym) => ({ sym, name: metaOf(sym).name, tag: sym === 'USDS' ? 'wraps' : undefined }))}
      open={m.addPickerOpen}
      onToggle={m.toggleAddPicker}
      onClose={m.closeAddPicker}
      onSelect={m.selectAddToken}
      ariaLabel="Select deposit token"
      groupLabel="Deposit token"
    />
  );
  const targetSelector = m.canPickTarget ? (
    <TokenDropdown
      value={m.liqTarget}
      options={m.targetOptions}
      open={m.liqTargetPickerOpen}
      onToggle={m.toggleLiqTargetPicker}
      onClose={m.closeLiqTargetPicker}
      onSelect={m.selectLiqTarget}
      ariaLabel="Select pool token"
      groupLabel="Pool token"
    />
  ) : <TargetChip sym={m.liqTarget} />;

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
        token={targetSelector}
      />
    </div>
  );
}
