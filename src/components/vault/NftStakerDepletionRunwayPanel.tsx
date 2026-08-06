import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { nftStakerDepletionAbi } from '@behodler/phase2-wagmi-hooks';
import StakerTopUpForm from './StakerTopUpForm';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** How often the "window ends in" countdown re-renders against the wall clock. */
const CLOCK_TICK_MS = 15_000;

interface NftStakerDepletionRunwayPanelProps {
  /** Display title for the panel header, e.g. "EYE NFT Staker — Runway". */
  title: string;
  /** The NFTStakerDepletion contract address (UniboostStakerEYE/SCX/FLX). */
  stakerAddress: `0x${string}` | undefined;
  /** The phUSD reward-token address. */
  phUsdAddress: `0x${string}` | undefined;
  /** Short contract label used in toast/warning copy, e.g. "UniboostStakerEYE". */
  stakerLabel: string;
  /** Prefix to keep input ids unique when multiple panels are rendered. */
  idPrefix: string;
}

/**
 * Admin Runway panel for the protocol-token (EYE / SCX / FLX) NFT stakers.
 *
 * These are `NFTStakerDepletion` contracts, which differ from the fixed-rate
 * stakers driven by {@link NftStakerRunwayPanel} in two ways that shape this
 * panel:
 *
 *  - **No `targetAPY()`.** The reward rate is not solved backwards from a
 *    target yield, so there is no Target APY stat and no Minimum Runway stat —
 *    the latter only means something when the rate scales with how much is
 *    staked. Here the budget drains over a fixed window regardless of stake,
 *    so the runway shown IS the worst case.
 *  - **A depletion window.** `rewardBudget` is emitted linearly to dust over
 *    `depletionWindowMonths`, ending at `windowEnd`. Those, plus the
 *    `balance == rewardBudget + committedDebt` split, are the stats an admin
 *    actually steers on, so they take the place of the APY rows.
 *
 * The phUSD top-up flow (approve + owner-only `topUp`) is shared with the
 * fixed-rate panel via {@link StakerTopUpForm}.
 */
export default function NftStakerDepletionRunwayPanel({
  title,
  stakerAddress,
  phUsdAddress,
  stakerLabel,
  idPrefix,
}: NftStakerDepletionRunwayPanelProps) {
  const { address: walletAddress } = useAccount();

  const isDeployed = !!stakerAddress && stakerAddress.toLowerCase() !== ZERO_ADDRESS;

  const statQuery = { enabled: isDeployed };

  const { data: runwaySeconds, refetch: refetchRunwaySeconds } = useReadContract({
    address: stakerAddress,
    abi: nftStakerDepletionAbi,
    functionName: 'runwaySeconds',
    query: statQuery,
  });

  const { data: rewardRate, refetch: refetchRewardRate } = useReadContract({
    address: stakerAddress,
    abi: nftStakerDepletionAbi,
    functionName: 'currentRewardRate',
    query: statQuery,
  });

  const { data: rewardBudget, refetch: refetchRewardBudget } = useReadContract({
    address: stakerAddress,
    abi: nftStakerDepletionAbi,
    functionName: 'rewardBudget',
    query: statQuery,
  });

  const { data: committedDebt, refetch: refetchCommittedDebt } = useReadContract({
    address: stakerAddress,
    abi: nftStakerDepletionAbi,
    functionName: 'committedDebt',
    query: statQuery,
  });

  const { data: totalBudget, refetch: refetchTotalBudget } = useReadContract({
    address: stakerAddress,
    abi: nftStakerDepletionAbi,
    functionName: 'totalBudget',
    query: statQuery,
  });

  const { data: totalDebt, refetch: refetchTotalDebt } = useReadContract({
    address: stakerAddress,
    abi: nftStakerDepletionAbi,
    functionName: 'totalDebt',
    query: statQuery,
  });

  const { data: totalStaked, refetch: refetchTotalStaked } = useReadContract({
    address: stakerAddress,
    abi: nftStakerDepletionAbi,
    functionName: 'totalStaked',
    query: statQuery,
  });

  const { data: windowMonths, refetch: refetchWindowMonths } = useReadContract({
    address: stakerAddress,
    abi: nftStakerDepletionAbi,
    functionName: 'depletionWindowMonths',
    query: statQuery,
  });

  const { data: windowEnd, refetch: refetchWindowEnd } = useReadContract({
    address: stakerAddress,
    abi: nftStakerDepletionAbi,
    functionName: 'windowEnd',
    query: statQuery,
  });

  const { data: poolState, refetch: refetchPoolState } = useReadContract({
    address: stakerAddress,
    abi: nftStakerDepletionAbi,
    functionName: 'poolState',
    query: statQuery,
  });

  const { data: owner } = useReadContract({
    address: stakerAddress,
    abi: nftStakerDepletionAbi,
    functionName: 'owner',
    query: statQuery,
  });

  const refetchStats = () => {
    refetchRunwaySeconds();
    refetchRewardRate();
    refetchRewardBudget();
    refetchCommittedDebt();
    refetchTotalBudget();
    refetchTotalDebt();
    refetchTotalStaked();
    refetchWindowMonths();
    refetchWindowEnd();
    refetchPoolState();
  };

  const isOwner = useMemo(() => {
    if (!walletAddress || !owner) return false;
    return (owner as string).toLowerCase() === walletAddress.toLowerCase();
  }, [walletAddress, owner]);

  // `windowEnd` is an absolute unix timestamp, so the remaining-time reading
  // goes stale on its own even when no contract read changes. Tick the clock
  // so the countdown stays honest between refetches.
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!isDeployed) return;
    const id = setInterval(() => setNowSeconds(Math.floor(Date.now() / 1000)), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [isDeployed]);

  const windowEndsIn = useMemo<string>(() => {
    if (typeof windowEnd !== 'bigint' || windowEnd === 0n) return '—';
    const remaining = Number(windowEnd) - nowSeconds;
    if (remaining <= 0) return 'Depleted';
    return `${(remaining / 86400).toFixed(2)} days`;
  }, [windowEnd, nowSeconds]);

  const windowEndDate = useMemo<string>(() => {
    if (typeof windowEnd !== 'bigint' || windowEnd === 0n) return '—';
    return new Date(Number(windowEnd) * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }, [windowEnd]);

  const phUsd = (v: unknown, dp = 2) =>
    typeof v === 'bigint' ? `${(Number(v) / 1e18).toFixed(dp)} phUSD` : `${(0).toFixed(dp)} phUSD`;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {isDeployed && owner && (
          <span className="text-xs font-mono text-muted-foreground">
            owner: {(owner as string).slice(0, 6)}…{(owner as string).slice(-4)}
          </span>
        )}
      </div>
      {!isDeployed ? (
        <p className="text-sm text-muted-foreground">
          {stakerLabel} not deployed on this chain.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Runway:</span>
              <span className="text-sm font-mono text-foreground">
                {typeof runwaySeconds === 'bigint' && runwaySeconds > 0n
                  ? `${(Number(runwaySeconds) / 86400).toFixed(2)} days`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Window Ends In:</span>
              <span className="text-sm font-mono text-foreground">{windowEndsIn}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Window End:</span>
              <span className="text-sm font-mono text-foreground">{windowEndDate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Depletion Window:</span>
              <span className="text-sm font-mono text-foreground">
                {typeof windowMonths === 'bigint' ? `${windowMonths.toString()} months` : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Reward Rate (per second):</span>
              <span className="text-sm font-mono text-foreground">
                {typeof rewardRate === 'bigint'
                  ? `${(Number(rewardRate) / 1e18).toFixed(8)} phUSD/sec`
                  : '0.00000000 phUSD/sec'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Reward Rate (per day):</span>
              <span className="text-sm font-mono text-foreground">
                {typeof rewardRate === 'bigint'
                  ? `${((Number(rewardRate) * 86400) / 1e18).toFixed(2)} phUSD/day`
                  : '0.00 phUSD/day'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Reward Budget (unemitted):</span>
              <span className="text-sm font-mono text-foreground">{phUsd(rewardBudget)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Committed Debt:</span>
              <span className="text-sm font-mono text-foreground">{phUsd(committedDebt)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Budget:</span>
              <span className="text-sm font-mono text-foreground">{phUsd(totalBudget)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Debt:</span>
              <span className="text-sm font-mono text-foreground">{phUsd(totalDebt)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Staked:</span>
              <span className="text-sm font-mono text-foreground">
                {typeof totalStaked === 'bigint' ? totalStaked.toString() : '0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pool State:</span>
              <span
                className={
                  'text-sm font-mono ' +
                  (poolState === 1 ? 'text-yellow-500' : 'text-foreground')
                }
              >
                {poolState === undefined ? '—' : poolState === 1 ? 'Migrating' : 'Active'}
              </span>
            </div>
          </div>

          <StakerTopUpForm
            stakerAddress={stakerAddress}
            stakerAbi={nftStakerDepletionAbi}
            rewardTokenAddress={phUsdAddress}
            stakerLabel={stakerLabel}
            idPrefix={idPrefix}
            isOwner={isOwner}
            onToppedUp={refetchStats}
          />

          <div className="mt-3 pt-3 border-t border-border">
            <button
              onClick={refetchStats}
              className="text-xs text-accent hover:text-accent/80 underline"
            >
              Refresh Runway Stats
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
            <strong>Note:</strong> This is a depletion staker — <code>rewardBudget</code> drains
            linearly to dust over <code>depletionWindowMonths</code>, ending at{' '}
            <code>windowEnd</code>, regardless of how much is staked. There is no target APY, and
            no separate minimum runway: because the rate does not scale with stake, the runway
            above already is the worst case. Runway is derived:{' '}
            <code>(rewardToken.balanceOf(this) + dispatcherHook.mintDebt()) / rewardRate</code>.
            Top Up requires phUSD approval for {stakerLabel}, then transfers phUSD from your wallet
            and recomputes the emission schedule, which pushes <code>windowEnd</code> out to a full
            fresh window. Approve uses the exact entered amount.
          </p>
        </>
      )}
    </div>
  );
}
