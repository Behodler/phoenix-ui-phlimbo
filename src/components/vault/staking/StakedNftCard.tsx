import { useEffect, useState } from 'react';
import type { NFTStaticConfig } from '../../../data/nftMockData';
import { LoadingSpinner } from '../../ui/ActionButton';
import ApyPill from './ApyPill';
import LiveYieldCounter from './LiveYieldCounter';
import PhUsdCoin from './PhUsdCoin';
import UnitSlider from './UnitSlider';

export interface StakedNftCardProps {
  nft: NFTStaticConfig;
  stakedUnits: number;
  ownedUnits: number;
  pendingYield: number;
  ratePerSec: number;
  /** Current min APY to display in the header pill */
  apy: number;
  /** Staked value in USD (stakedUnits * priceProxy) */
  unrealized: number;
  /**
   * Whether the NFTStaker contract has a non-zero address on the active
   * network. When false, all action buttons are disabled and a "not yet
   * deployed" badge is shown.
   */
  isStakerDeployed: boolean;
  /** ERC1155 setApprovalForAll(staker, true) flag for the user. */
  isApprovedForAll: boolean;
  approveAll: () => Promise<void>;
  isApproving: boolean;
  isStaking: boolean;
  isUnstaking: boolean;
  isClaiming: boolean;
  onStake: (n: number) => void;
  onUnstake: (n: number) => void;
  onClaim: () => void;
}

/**
 * Hero card for the Liquid Sky Phoenix NFT.
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │ [sky banner]                 │
 *   │ [thumb] Name + APY pill      │
 *   │         description          │
 *   │ ┌──────────┬──────────────┐  │
 *   │ │ pending  │ stake more   │  │
 *   │ │ yield    │              │  │
 *   │ │ stats    ├──────────────┤  │
 *   │ │ Claim    │ unstake …    │  │
 *   │ └──────────┴──────────────┘  │
 *   └──────────────────────────────┘
 */
export default function StakedNftCard({
  nft,
  stakedUnits,
  ownedUnits,
  pendingYield,
  ratePerSec,
  apy,
  unrealized,
  isStakerDeployed,
  isApprovedForAll,
  approveAll,
  isApproving,
  isStaking,
  isUnstaking,
  isClaiming,
  onStake,
  onUnstake,
  onClaim,
}: StakedNftCardProps) {
  const txInFlight = isApproving || isStaking || isUnstaking || isClaiming;

  return (
    <div className="phoenix-card mb-[18px] overflow-hidden p-0">
      <div className="px-[22px] py-5">
        {/* Header */}
        <div className="mb-4 flex items-end gap-3.5">
          <div className="overflow-hidden rounded-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
            <img
              src={nft.image}
              alt={nft.name}
              width={72}
              height={72}
              className="block h-[72px] w-[72px] select-none object-cover"
              draggable={false}
            />
          </div>
          <div className="flex-1 pb-1">
            <div className="mb-1 flex flex-wrap items-center gap-2.5">
              <h3 className="m-0 text-xl font-bold tracking-[-0.01em] text-pxusd-white">{nft.name}</h3>
              <ApyPill apy={apy} />
              {!isStakerDeployed && (
                <span className="rounded-full border border-pxusd-orange-500/40 bg-pxusd-orange-900/30 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-pxusd-orange-300">
                  Not yet deployed on this network
                </span>
              )}
            </div>
            <div className="max-w-[520px] text-xs leading-[1.5] text-muted-foreground">
              {nft.action}
            </div>
          </div>
        </div>

        {/* Body grid */}
        <div className="grid items-stretch gap-5 md:grid-cols-[1fr_1.15fr]">
          {/* Left — unit management */}
          <div className="flex flex-col gap-3.5">
            <div className="rounded-[14px] border border-border bg-white/[0.02] p-3.5">
              <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Stake more units
              </div>
              <StakeMoreInline
                max={ownedUnits}
                onStake={onStake}
                isStakerDeployed={isStakerDeployed}
                isApprovedForAll={isApprovedForAll}
                onApprove={approveAll}
                isApproving={isApproving}
                isStaking={isStaking}
                txInFlight={txInFlight}
              />
            </div>

            <UnstakeInline
              max={stakedUnits}
              onUnstake={onUnstake}
              isStakerDeployed={isStakerDeployed}
              isUnstaking={isUnstaking}
              txInFlight={txInFlight}
            />
          </div>

          {/* Right — pending yield + claim */}
          <div className="rounded-[14px] border border-border bg-white/[0.02] p-[18px]">
            <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Pending yield
            </div>
            <div className="mb-3.5 flex items-baseline gap-2">
              <PhUsdCoin size={22} />
              <LiveYieldCounter
                ratePerSecond={ratePerSec}
                initial={pendingYield}
                decimals={6}
                size={34}
              />
              <span className="ml-1 font-mono text-xs text-muted-foreground">phUSD</span>
            </div>
            <div className="mb-3 h-px w-full bg-border" />
            <StatLine label="Staked units" value={stakedUnits.toLocaleString()} />
            <StatLine
              label="Unrealised value"
              mono
              value={`$${unrealized.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            />

            <button
              className="phoenix-btn-primary mt-3.5 flex w-full items-center justify-center gap-2 px-3.5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onClaim}
              disabled={
                !isStakerDeployed ||
                txInFlight ||
                (pendingYield <= 0 && ratePerSec <= 0)
              }
              type="button"
            >
              {isClaiming && <LoadingSpinner />}
              Claim phUSD
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatLine({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span
        className={[
          'text-[13px] font-semibold text-pxusd-white',
          mono ? 'font-mono tabular-nums' : '',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}

function StakeMoreInline({
  max,
  onStake,
  isStakerDeployed,
  isApprovedForAll,
  onApprove,
  isApproving,
  isStaking,
  txInFlight,
}: {
  max: number;
  onStake: (n: number) => void;
  isStakerDeployed: boolean;
  isApprovedForAll: boolean;
  onApprove: () => Promise<void>;
  isApproving: boolean;
  isStaking: boolean;
  txInFlight: boolean;
}) {
  const [n, setN] = useState<number>(Math.min(1, max));

  // Keep n in bounds if max drops.
  useEffect(() => {
    setN((prev) => Math.min(prev, max));
  }, [max]);

  // Approval gate — when staker is deployed but not yet approved, the
  // primary CTA flips to "Approve" until the on-chain flag confirms.
  const showApprove = isStakerDeployed && !isApprovedForAll;

  if (showApprove) {
    return (
      <div className="flex flex-col gap-2.5">
        <UnitSlider value={n} max={max} onChange={setN} />
        <button
          type="button"
          className="phoenix-btn-primary flex items-center justify-center gap-2 px-3.5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            void onApprove();
          }}
          disabled={txInFlight}
        >
          {isApproving && <LoadingSpinner />}
          Approve for staking
        </button>
      </div>
    );
  }

  const stakeDisabled = !isStakerDeployed || txInFlight || n <= 0 || max <= 0;
  return (
    <div className="flex flex-col gap-2.5">
      <UnitSlider value={n} max={max} onChange={setN} />
      <button
        type="button"
        className="phoenix-btn-primary flex items-center justify-center gap-2 px-3.5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => {
          onStake(n);
          setN(0);
        }}
        disabled={stakeDisabled}
      >
        {isStaking && <LoadingSpinner />}
        {!isStakerDeployed
          ? 'Staking unavailable'
          : max <= 0
            ? 'No units in wallet'
            : `Stake ${n} unit${n === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}

function UnstakeInline({
  max,
  onUnstake,
  isStakerDeployed,
  isUnstaking,
  txInFlight,
}: {
  max: number;
  onUnstake: (n: number) => void;
  isStakerDeployed: boolean;
  isUnstaking: boolean;
  txInFlight: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState<number>(Math.min(1, max));

  useEffect(() => {
    setN((prev) => Math.min(prev, max));
  }, [max]);

  const baseDisabled = !isStakerDeployed || txInFlight || max <= 0;

  if (!open) {
    return (
      <div className="rounded-[14px] border border-border bg-white/[0.02] px-3.5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Unstake
            </div>
            <div className="text-xs text-muted-foreground">Instant · no cooldown</div>
          </div>
          <button
            type="button"
            className="phoenix-btn-ghost px-3.5 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setOpen(true)}
            disabled={baseDisabled}
          >
            Unstake…
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-border bg-white/[0.02] p-3.5">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Unstake units
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cursor-pointer border-none bg-transparent text-xs text-muted-foreground hover:text-pxusd-white"
          >
            cancel
          </button>
        </div>
        <UnitSlider value={n} max={max} onChange={setN} />
        <div className="text-[12px] text-muted-foreground">
          Pending yield is auto-claimed on unstake.
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="phoenix-btn-ghost flex-1 px-3.5 py-2.5 text-[13px]"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="phoenix-btn-primary flex flex-1 items-center justify-center gap-2 px-3.5 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #EF4444, #FF8C42)' }}
            disabled={baseDisabled || n <= 0}
            onClick={() => {
              onUnstake(n);
              setN(0);
              setOpen(false);
            }}
          >
            {isUnstaking && <LoadingSpinner />}
            Unstake {n}
          </button>
        </div>
      </div>
    </div>
  );
}
