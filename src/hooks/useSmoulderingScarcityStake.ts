import { useCallback, useMemo, useState } from 'react';
import type { StakingPageData } from './useStakingPageData';
import type { Toast } from '../types/toast';

type AddToast = (toast: Omit<Toast, 'id'>) => string;

/** Display APY for Smouldering Scarcity (mock — staker not deployed). */
const SMOULDERING_APY = 6.8;
/** Mock owned units (in wallet, not staked). */
const SMOULDERING_OWNED = 5;
/** Mock staked units. */
const SMOULDERING_STAKED = 0;

/**
 * phUSD/sec drip used when units are staked, so the LiveYieldCounter ticks
 * for the mock card. Chosen to read as a plausible small live yield without
 * implying real on-chain rewards. Only applied when `stakedUnits > 0`.
 */
const SMOULDERING_RATE_PER_SEC = 0.0000025;

/**
 * Mock staking source for **Smouldering Scarcity** (id 3).
 *
 * Smouldering's NFTStaker contract is **not deployed yet**, so this hook
 * returns the same `StakingPageData` shape as the live `useStakingPageData`
 * but with fixed mock numbers and no-op actions that fire an info toast.
 * Modeled on the deprecated `useStakingMockData`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * PLUG-AND-PLAY SWAP POINT
 * ───────────────────────────────────────────────────────────────────────────
 * When the Smouldering Scarcity NFTStaker is deployed, replace the call to
 * this hook in `StakingSurface` with a real `useStakingPageData(...)` instance
 * pointed at the Smouldering staker address (parameterize that hook's
 * staker-address / owned-units token-prefix / NFT name), and flip
 * `STAKEABLE_NFTS[...].isLive` to `true`. The rail, detail card, and
 * EarningPanel aggregation are source-agnostic and need NO changes. This file
 * can then be deleted.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * `isStakerDeployed` is intentionally returned as `true` so the card's
 * stake/unstake/claim controls render and the sliders work against the mock
 * owned/staked counts; the underlying actions are no-ops that surface a
 * "coming soon" info toast.
 */
export function useSmoulderingScarcityStake(addToast?: AddToast): StakingPageData {
  // Mock balances held in local state so the slider has something to bound
  // against. Stake/unstake are no-ops (mock — no real contract), so these do
  // not change; kept as state to mirror the real hook's reactive shape.
  const [ownedUnits] = useState<number>(SMOULDERING_OWNED);
  const [stakedUnits] = useState<number>(SMOULDERING_STAKED);

  // Pending yield baseline is 0; the LiveYieldCounter ticks from here using
  // ratePerSec. Only drip when something is staked (mirrors the mock).
  const pendingYield = 0;
  const ratePerSec = useMemo(
    () => (stakedUnits > 0 ? SMOULDERING_RATE_PER_SEC : 0),
    [stakedUnits],
  );

  const comingSoonToast = useCallback(() => {
    addToast?.({
      type: 'info',
      title: 'Coming soon',
      description: 'Smouldering Scarcity staking goes live soon.',
    });
  }, [addToast]);

  // Args are ignored — these are no-op mock actions. The `StakingPageData`
  // contract types them as `(n: number) => Promise<void>`; TypeScript permits
  // an implementation that takes fewer parameters.
  const stake = useCallback(
    async (): Promise<void> => {
      comingSoonToast();
    },
    [comingSoonToast],
  );

  const unstake = useCallback(
    async (): Promise<void> => {
      comingSoonToast();
    },
    [comingSoonToast],
  );

  const claim = useCallback(
    async (): Promise<void> => {
      comingSoonToast();
    },
    [comingSoonToast],
  );

  const approveAll = useCallback(
    async (): Promise<void> => {
      comingSoonToast();
    },
    [comingSoonToast],
  );

  return {
    // Card controls render and slider works against mock counts.
    isStakerDeployed: true,
    stakedUnits,
    ownedUnits,
    pendingYield,
    ratePerSec,
    minApy: SMOULDERING_APY,
    highestPrice: 0,
    annualRewardDollars: 0,
    // Treat as approved so the primary CTA shows "Stake" (the no-op path)
    // rather than gating behind an approval that can never confirm.
    isApprovedForAll: true,
    approveAll,
    isApproving: false,
    stake,
    unstake,
    claim,
    isStaking: false,
    isUnstaking: false,
    isClaiming: false,
  };
}
