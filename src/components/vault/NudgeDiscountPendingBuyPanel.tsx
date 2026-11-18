import { useNudgeDiscountPendingBuy } from '../../hooks/useNudgeDiscountPendingBuy';
import { formatTokenAmount2dp } from '../../lib/formatTokenAmount2dp';

/** Fixed by the contract: `pendingBuyUSDC` is USDC (6 dp), `pendingStakerPhUSD` is phUSD (18 dp). */
const USDC_DECIMALS = 6;
const PHUSD_DECIMALS = 18;

const VALUE = 'text-sm font-mono text-foreground';
const MUTED = 'text-sm font-mono text-muted-foreground';

/**
 * Admin-only, read-only view of the nudge-discount minter's deferred buy
 * reserve. Hidden entirely while the minter address is zero.
 */
export default function NudgeDiscountPendingBuyPanel() {
  const { active, isLoading, isError, pendingBuyUsdc, pendingStakerPhusd, burnPercent, refetch } =
    useNudgeDiscountPendingBuy();

  if (!active) return null;

  const placeholder = isError ? 'Unavailable' : isLoading ? 'Loading…' : '—';

  let reserve;
  if (pendingBuyUsdc === undefined) {
    reserve = <span className={MUTED}>{placeholder}</span>;
  } else if (pendingBuyUsdc === 0n) {
    reserve = <span className={MUTED}>Nothing to buy</span>;
  } else {
    reserve = (
      <span className="text-base font-mono font-semibold text-accent">
        {formatTokenAmount2dp(pendingBuyUsdc, USDC_DECIMALS)} USDC
      </span>
    );
  }

  const staker =
    pendingStakerPhusd === undefined ? (
      <span className={MUTED}>{placeholder}</span>
    ) : (
      <span className={VALUE}>{formatTokenAmount2dp(pendingStakerPhusd, PHUSD_DECIMALS)} phUSD</span>
    );

  const burn =
    burnPercent === undefined ? (
      <span className={MUTED}>{placeholder}</span>
    ) : (
      <span className={VALUE}>{burnPercent}%</span>
    );

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <h3 className="text-sm font-semibold text-foreground mb-3">Nudge Discount — Pending Buyback</h3>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Reserved USDC awaiting buyback</span>
          {reserve}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">phUSD owed to NFT stakers</span>
          {staker}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Burn share of the excess</span>
          {burn}
        </div>
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={refetch}
          className="text-xs text-accent hover:text-accent/80 underline"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
