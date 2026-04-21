import { useCallback, useMemo, useState } from 'react';
import { STAKING_MOCK, SECONDS_PER_YEAR } from '../data/stakeMockData';

/**
 * Shape returned by the staking data hook.
 *
 * Kept contract-agnostic so that swapping this mock for a real hook
 * (backed by the reward contract + useMinterPageView + useBalancerPrice)
 * is a one-file change.
 */
export interface StakingData {
  /** Units currently staked by the user */
  stakedUnits: number;
  /** Units owned (in wallet, not staked) by the user */
  ownedUnits: number;
  /** Pending (claimable) phUSD yield at the snapshot baseline */
  pendingYield: number;
  /** phUSD disbursed per second to THIS user (derived from share of global rate) */
  ratePerSec: number;
  /** Lifetime phUSD earned, used as the EarningPanel counter baseline */
  lifetimeEarned: number;
  /** Minimum APY (assumes every staked NFT was bought at the most recent highest price) */
  minApy: number;
  /** Highest USDS price any real minter could have paid (currentMintPrice - growthRate) */
  highestPrice: number;
  /** Annual reward stream in USD (rewardRatePerSec * secondsPerYear * phUsdUsdPrice) */
  annualRewardDollars: number;
  /** Stake n of the user's owned units. Fires a toast. */
  stake: (n: number) => void;
  /** Unstake n units; auto-claims pending yield. Fires a toast. */
  unstake: (n: number) => void;
  /** Claim pending yield. Fires a toast. */
  claim: () => void;
}

/** Callback fired when a staking action completes (used for toasts). */
export type StakingToast = (message: string) => void;

/**
 * Mock staking data source.
 *
 * All derived values (minApy, annualRewardDollars, highestPrice, ratePerSec)
 * are memoized. State mutators synchronously update local state and fire a
 * caller-provided toast message — no async work, no loading states.
 */
export function useStakingMockData(onToast?: StakingToast): StakingData {
  const [ownedUnits, setOwnedUnits] = useState<number>(STAKING_MOCK.startOwned);
  const [stakedUnits, setStakedUnits] = useState<number>(STAKING_MOCK.startStaked);
  const [pendingYield, setPendingYield] = useState<number>(STAKING_MOCK.startPendingYield);
  const [lifetimeEarned] = useState<number>(STAKING_MOCK.startLifetimeEarned);

  const highestPrice = useMemo(
    () => Math.max(0, STAKING_MOCK.currentMintPrice - STAKING_MOCK.growthRate),
    []
  );

  const annualRewardDollars = useMemo(
    () => STAKING_MOCK.rewardRatePerSec * SECONDS_PER_YEAR * STAKING_MOCK.phUsdUsdPrice,
    []
  );

  const minApy = useMemo(() => {
    // When nothing is staked, the denominator is a single NFT at highestPrice — the
    // first staker's APY ceiling. As n units stake, the denominator grows, so
    // minApy falls (same reward pool spread across more stake).
    const stakeDenominator = Math.max(1, stakedUnits) * highestPrice;
    if (stakeDenominator <= 0) return 0;
    return (annualRewardDollars / stakeDenominator) * 100;
  }, [stakedUnits, highestPrice, annualRewardDollars]);

  const ratePerSec = useMemo(() => {
    // User's share of the global reward stream, in phUSD/sec.
    // Global rate × (userStake / totalStake). Here totalStake is approximated
    // by the user's own stake (single-user mock); a real hook would divide by
    // total staked from the contract.
    if (stakedUnits <= 0) return 0;
    return STAKING_MOCK.rewardRatePerSec;
  }, [stakedUnits]);

  const stake = useCallback(
    (n: number) => {
      if (n <= 0) return;
      const clamped = Math.min(n, ownedUnits);
      if (clamped <= 0) return;
      setOwnedUnits((o) => o - clamped);
      setStakedUnits((s) => s + clamped);
      onToast?.(`Staked ${clamped} unit${clamped === 1 ? '' : 's'} of Liquid Sky Phoenix`);
    },
    [ownedUnits, onToast]
  );

  const unstake = useCallback(
    (n: number) => {
      if (n <= 0) return;
      const clamped = Math.min(n, stakedUnits);
      if (clamped <= 0) return;
      setStakedUnits((s) => s - clamped);
      setOwnedUnits((o) => o + clamped);
      setPendingYield(0);
      onToast?.(`Unstaked ${clamped} unit${clamped === 1 ? '' : 's'} · pending yield claimed`);
    },
    [stakedUnits, onToast]
  );

  const claim = useCallback(() => {
    setPendingYield(0);
    onToast?.('Claimed phUSD rewards');
  }, [onToast]);

  return {
    stakedUnits,
    ownedUnits,
    pendingYield,
    ratePerSec,
    lifetimeEarned,
    minApy,
    highestPrice,
    annualRewardDollars,
    stake,
    unstake,
    claim,
  };
}
