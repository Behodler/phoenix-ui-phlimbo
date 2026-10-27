import LiveYieldCounter from '../staking/LiveYieldCounter';
import { BalanceRow } from './AnnihilatePanel';
import { fmtAmount } from '../stake/formatStake';
import { ANTIMATTER_ACCENT } from '../../../data/antimatterData';
import antimatterIcon from '../../../assets/antimatter.png';

/**
 * The **claim** sub-tab of a stablecoin pool row: pays the accrued Antimatter
 * to the wallet as an ordinary ERC20, leaving the staked principal untouched.
 *
 * Only mounted while `claimEnabled()` is true — the row drops the sub-tab
 * entirely while the gate is shut, matching the rule that the closed gate is
 * normal operating state and gets no banner.
 *
 * The headline figure ticks through `LiveYieldCounter`, which owns its own
 * hooks, so this component stays hook-free like the row that renders it. The
 * tick is **display only**: the button's enabled state and the Now/After table
 * use `pending`, the block-attested `claimableReward`.
 */
export interface ClaimPanelProps {
  /** Stake-token symbol, e.g. `USDC`. */
  symbol: string;
  antimatterSymbol: string;
  staked: number;
  /** `claimableReward` at the last chain read — what `claim` pays out. */
  pending: number;
  /** Antimatter accruing to this user per second, for the live counter. */
  ratePerSecond: number;
  walletAntimatter: number;
  disabled: boolean;
  inactive: boolean;
  pendingAction: 'stake' | 'withdraw' | 'claim' | 'approve' | 'annihilate' | null;
  onClaim: () => void;
}

export default function ClaimPanel({
  symbol,
  antimatterSymbol,
  staked,
  pending,
  ratePerSecond,
  walletAntimatter,
  disabled,
  inactive,
  pendingAction,
  onClaim,
}: ClaimPanelProps) {
  const busy = pendingAction !== null;
  const canClaim = !disabled && !inactive && !busy && pending > 0;

  const label =
    pendingAction === 'claim'
      ? 'Claiming…'
      : inactive
        ? 'Not live on this network'
        : pending > 0
          ? `Claim ${fmtAmount(pending, 4)} ${antimatterSymbol} to wallet`
          : `Nothing to claim yet`;

  return (
    <div>
      <div
        className="mb-3.5 rounded-[14px] border p-4"
        style={{
          borderColor: 'rgba(196,174,234,.28)',
          background: 'linear-gradient(180deg, rgba(196,174,234,.09), rgba(10,28,40,0) 85%)',
        }}
      >
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-pxusd-purple-300">
          Claimable {antimatterSymbol}
        </div>

        <div className="flex items-center gap-3">
          <img src={antimatterIcon} alt={antimatterSymbol} className="h-9 w-9 rounded-full" />
          <span className="flex flex-wrap items-baseline gap-x-2" data-testid={`claimable-${symbol}`}>
            <LiveYieldCounter
              ratePerSecond={ratePerSecond}
              initial={pending}
              decimals={6}
              size={24}
              weight={700}
              accentColor={ANTIMATTER_ACCENT}
            />
            <span className="text-[13px] text-muted-foreground">{antimatterSymbol}</span>
          </span>
        </div>

        <p className="mt-3.5 text-[12.5px] leading-[1.55] text-muted-foreground">
          Claiming sends your accrued {antimatterSymbol} to your wallet and leaves your {symbol} stake
          untouched. You can annihilate it against any supported stablecoin later in the Forge.
        </p>

        {/* Same Now / After table as the annihilate preview. The stake row is
            there to show it does NOT move, which is the whole difference
            between claiming and annihilating here. */}
        <div className="mt-3.5 border-t" style={{ borderColor: 'rgba(255,255,255,.1)' }}>
          <table className="text-[12.5px]">
            <thead>
              <tr className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                <th scope="col" className="pb-1 pr-6 pt-3 text-left font-bold">
                  <span className="sr-only">Balance</span>
                </th>
                <th scope="col" className="pb-1 pr-6 pt-3 text-left font-bold">
                  Now
                </th>
                <th scope="col" className="pb-1 pt-3 text-left font-bold">
                  After
                </th>
              </tr>
            </thead>
            <tbody>
              <BalanceRow
                label={`${antimatterSymbol} in wallet`}
                now={walletAntimatter}
                after={walletAntimatter + pending}
                delta={pending}
                decimals={4}
                afterColor="#C4AEEA"
              />
              <BalanceRow
                label={`${symbol} staked`}
                now={staked}
                after={staked}
                delta={0}
                decimals={4}
                afterColor="rgba(240,245,248,.92)"
              />
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        onClick={onClaim}
        disabled={!canClaim}
        className={`phoenix-btn-primary w-full ${canClaim ? '' : 'opacity-40 cursor-not-allowed'}`}
      >
        {label}
      </button>
    </div>
  );
}
