import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { formatUnits } from 'viem';
import type { Address, Hash } from 'viem';
import { nftStakerAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { useMinterPageView } from './useMinterPageView';
import { useBalancerPrice } from './useBalancerPrice';
import { useERC1155ApprovalForAll } from './useERC1155ApprovalForAll';
import { computeMinApy, computeUserRatePerSec, backOutGrowthStep } from '../utils/stakingMath';
import type { Toast } from '../types/toast';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Polling cadence for on-chain staking reads, matched to useBalancerPrice. */
const REFETCH_INTERVAL_MS = 12_000;

/**
 * Public shape of the staking surface data hook.
 *
 * Mirrors the original `useStakingMockData` return value, with three
 * intentional differences:
 *  - `lifetimeEarned` is removed; the EarningPanel counter now tracks
 *    `pendingYield` (the user's live claimable phUSD).
 *  - `isStakerDeployed` indicates whether the resolved NFTStaker
 *    address is non-zero on the current network.
 *  - ERC1155 approval flags + per-action transaction-in-flight flags
 *    are surfaced for the StakedNftCard's button-disable logic.
 */
export interface StakingPageData {
  /** False when NFTStaker address is `0x0…` on the current network. */
  isStakerDeployed: boolean;

  // Balances
  stakedUnits: number;
  /** Global units staked across all holders (denominator for pool-wide APY). */
  totalStaked: number;
  ownedUnits: number;
  /** User's live claimable phUSD (baseline for LiveYieldCounter). */
  pendingYield: number;
  /** User's share of the global rewardRate, in phUSD/sec. */
  ratePerSec: number;

  // APY display
  /** Percentage, e.g. 12.5. */
  minApy: number;
  /** Highest USD price any staked unit could have been minted at. */
  highestPrice: number;
  /** Annual phUSD reward stream in USD (rate × seconds × phUSD/USD). */
  annualRewardDollars: number;

  // ERC1155 approval state
  isApprovedForAll: boolean;
  approveAll: () => Promise<void>;
  isApproving: boolean;

  // Actions (real chain calls)
  stake: (n: number) => Promise<void>;
  unstake: (n: number) => Promise<void>;
  claim: () => Promise<void>;
  isStaking: boolean;
  isUnstaking: boolean;
  isClaiming: boolean;
}

type AddToast = (toast: Omit<Toast, 'id'>) => string;

/** MinterPageView per-token row key used for the owned-units balance. */
type OwnedRowKey = 'EYE' | 'SCX' | 'Flax' | 'USDS' | 'WBTC' | 'USDC';

/**
 * Per-NFT bindings for {@link useStakingPageData}. Omit for Liquid Sky
 * Phoenix (id 2) — the defaults below reproduce its original behaviour
 * byte-for-byte. Reservoir Ratchet (id 6) passes its own staker address,
 * the USDC owned-row key, and its display name.
 */
export interface StakingPageDataOptions {
  /** Resolved NFTStaker address. Defaults to `addresses.NFTStaker` (Liquid Sky). */
  stakerAddress?: Address;
  /** MinterPageView row supplying owned units / price. Defaults to `'USDS'`. */
  ownedRowKey?: OwnedRowKey;
  /** NFT display name woven into action toasts. Defaults to `'Liquid Sky Phoenix'`. */
  nftName?: string;
  /**
   * Whether this staker exposes `targetAPY()`. Defaults to `true` (fixed
   * stakers). Pass `false` for the Uniboost depletion stakers so the missing
   * `targetAPY` contract is omitted from the batch — avoiding a noisy
   * failed-call in the console. `targetApyRaw` then defaults to `0n`, which is
   * already the status-guarded fallback, so behaviour is unchanged.
   */
  hasTargetApy?: boolean;
}

/**
 * Hook returning everything the staking surface needs.
 *
 * Reads the NFTStaker contract for global / per-user state, derives
 * the displayed APY via `computeMinApy`, exposes the user's wallet
 * balance via `useMinterPageView` (the `ownedRowKey` row — Liquid Sky
 * pays in USDS, id=2; Reservoir Ratchet pays in USDC, id=6), and wires
 * `stake / unstake / claim` writes through wagmi's `useWriteContract` +
 * `useWaitForTransactionReceipt` lifecycle with toast feedback mirroring
 * `NFTListMintModal`.
 *
 * The staker address, owned-units row, and toast NFT name are
 * parameterized via {@link StakingPageDataOptions} so the same hook drives
 * every NFT's dedicated staker. Omitting the options reproduces Liquid
 * Sky Phoenix's original behaviour exactly.
 *
 * Gracefully no-ops when the staker is not deployed on the active
 * network: returns zeroed numeric fields, `isStakerDeployed = false`,
 * and action callbacks that throw so accidental calls surface in
 * dev-tools instead of silently swallowing.
 */
export function useStakingPageData(
  addToast?: AddToast,
  options?: StakingPageDataOptions,
): StakingPageData {
  const { address: userAddress } = useAccount();
  const { addresses } = useContractAddresses();
  const { data: minterData, refetch: refetchMinterData } = useMinterPageView();
  const { price: phUsdPrice } = useBalancerPrice();

  const ownedRowKey: OwnedRowKey = options?.ownedRowKey ?? 'USDS';
  const nftName = options?.nftName ?? 'Liquid Sky Phoenix';
  const hasTargetApy = options?.hasTargetApy ?? true;

  const stakerAddress = (options?.stakerAddress ??
    (addresses?.NFTStaker as Address | undefined)) as Address | undefined;
  const nftMinterAddress = addresses?.NFTMinter as Address | undefined;

  const isStakerDeployed = useMemo(
    () =>
      !!stakerAddress &&
      stakerAddress.toLowerCase() !== ZERO_ADDRESS,
    [stakerAddress],
  );

  // ── ERC1155 approval state (NFTMinterV2 → NFTStaker) ────────────────
  // NFTStaker.stake() pulls the user's Liquid Sky units via
  // safeTransferFrom on the staked ERC1155, which is NFTMinterV2 — not
  // the BalancerPooler (a downstream dispatcher with no ERC1155 surface).
  const {
    isApprovedForAll,
    approveAll: approveAllRaw,
    refetch: refetchApproval,
  } = useERC1155ApprovalForAll(
    userAddress,
    isStakerDeployed ? stakerAddress : undefined,
    nftMinterAddress,
  );

  // ── Batched NFTStaker reads ────────────────────────────────────────
  const stakerReadsEnabled = isStakerDeployed && !!userAddress;
  const {
    data: stakerReads,
    refetch: refetchStakerReads,
  } = useReadContracts({
    contracts: stakerReadsEnabled
      ? [
          {
            address: stakerAddress as Address,
            abi: nftStakerAbi,
            functionName: 'currentRewardRate',
          },
          {
            address: stakerAddress as Address,
            abi: nftStakerAbi,
            functionName: 'totalStaked',
          },
          {
            address: stakerAddress as Address,
            abi: nftStakerAbi,
            functionName: 'pendingReward',
            args: [userAddress as Address],
          },
          {
            address: stakerAddress as Address,
            abi: nftStakerAbi,
            functionName: 'users',
            args: [userAddress as Address],
          },
        ]
      : [],
    query: {
      enabled: stakerReadsEnabled,
      refetchInterval: REFETCH_INTERVAL_MS,
      refetchOnWindowFocus: false,
    },
  });

  // ── targetAPY (separate, conditional read) ─────────────────────────
  // The Uniboost depletion stakers don't expose `targetAPY()`, so it is read
  // on its own hook gated by `hasTargetApy`. Keeping it out of the batch above
  // means depletion stakers never fire a failed call (no console noise); when
  // disabled the read simply returns `undefined`, so `targetApyRaw` is 0n —
  // exactly the status-guarded fallback the batched read would have produced.
  const { data: targetApyData, refetch: refetchTargetApy } = useReadContract({
    address: stakerAddress as Address,
    abi: nftStakerAbi,
    functionName: 'targetAPY',
    query: {
      enabled: stakerReadsEnabled && hasTargetApy,
      refetchInterval: REFETCH_INTERVAL_MS,
      refetchOnWindowFocus: false,
    },
  });

  const currentRewardRate = useMemo<bigint>(() => {
    const r = stakerReads?.[0];
    return r?.status === 'success' ? (r.result as bigint) : 0n;
  }, [stakerReads]);

  const totalStakedRaw = useMemo<bigint>(() => {
    const r = stakerReads?.[1];
    return r?.status === 'success' ? (r.result as bigint) : 0n;
  }, [stakerReads]);

  const pendingRewardRaw = useMemo<bigint>(() => {
    const r = stakerReads?.[2];
    return r?.status === 'success' ? (r.result as bigint) : 0n;
  }, [stakerReads]);

  const userStakedRaw = useMemo<bigint>(() => {
    const r = stakerReads?.[3];
    if (r?.status !== 'success') return 0n;
    // `users` is a public mapping getter returning (amount, rewardDebt) — wagmi
    // surfaces tuple structs as readonly arrays.
    const tuple = r.result as readonly [bigint, bigint];
    return tuple[0];
  }, [stakerReads]);

  const targetApyRaw = useMemo<bigint>(
    () => (typeof targetApyData === 'bigint' ? targetApyData : 0n),
    [targetApyData],
  );

  // ── NFT data from useMinterPageView (Liquid Sky → USDS, Ratchet → USDC) ──
  const ownedRow = minterData?.[ownedRowKey];
  const ownedUnits = ownedRow?.nftBalance ?? 0;
  const priceRaw = ownedRow?.priceRaw ?? 0n;
  const growthBasisPoints = ownedRow?.growthBasisPoints ?? 0;
  // `priceRaw` is denominated in the NFT's payment token, whose scale varies
  // (Liquid Sky pays USDS = 18 decimals; Reservoir Ratchet pays USDC = 6).
  // Convert the price to USD with the row's own decimals, not a hardcoded 1e18.
  const priceDecimals = ownedRow?.decimals ?? 18;

  // ── Derived numbers ────────────────────────────────────────────────
  const phUsdPriceSafe = phUsdPrice ?? 1; // USDS pinned to $1; phUSD ≈ $1

  const stakedUnits = Number(userStakedRaw);
  const totalStaked = Number(totalStakedRaw);
  const pendingYield = Number(pendingRewardRaw) / 1e18;
  const ratePerSec = computeUserRatePerSec(
    currentRewardRate,
    userStakedRaw,
    totalStakedRaw,
  );

  const annualRewardDollars =
    (Number(currentRewardRate) / 1e18) * 86_400 * 365 * phUsdPriceSafe;

  const highestPrice =
    Number(backOutGrowthStep(priceRaw, growthBasisPoints)) / 10 ** priceDecimals;

  const minApy = computeMinApy(
    currentRewardRate,
    totalStakedRaw,
    priceRaw,
    growthBasisPoints,
    phUsdPriceSafe,
    targetApyRaw,
    priceDecimals,
  );

  // ── Write-tx state ─────────────────────────────────────────────────
  const { writeContractAsync } = useWriteContract();
  const [stakeHash, setStakeHash] = useState<Hash | undefined>();
  const [unstakeHash, setUnstakeHash] = useState<Hash | undefined>();
  const [claimHash, setClaimHash] = useState<Hash | undefined>();
  const [approveHash, setApproveHash] = useState<Hash | undefined>();
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const { isSuccess: stakeConfirmed } = useWaitForTransactionReceipt({
    hash: stakeHash,
    query: { enabled: !!stakeHash },
  });
  const { isSuccess: unstakeConfirmed } = useWaitForTransactionReceipt({
    hash: unstakeHash,
    query: { enabled: !!unstakeHash },
  });
  const { isSuccess: claimConfirmed } = useWaitForTransactionReceipt({
    hash: claimHash,
    query: { enabled: !!claimHash },
  });
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveHash,
    query: { enabled: !!approveHash },
  });

  const refetchAll = useCallback(() => {
    refetchStakerReads();
    refetchTargetApy();
    refetchMinterData();
    refetchApproval();
  }, [refetchStakerReads, refetchTargetApy, refetchMinterData, refetchApproval]);

  // Stake confirmation
  useEffect(() => {
    if (stakeConfirmed && stakeHash) {
      setIsStaking(false);
      setStakeHash(undefined);
      refetchAll();
    }
  }, [stakeConfirmed, stakeHash, refetchAll]);

  // Unstake confirmation
  useEffect(() => {
    if (unstakeConfirmed && unstakeHash) {
      setIsUnstaking(false);
      setUnstakeHash(undefined);
      refetchAll();
    }
  }, [unstakeConfirmed, unstakeHash, refetchAll]);

  // Claim confirmation
  useEffect(() => {
    if (claimConfirmed && claimHash) {
      setIsClaiming(false);
      setClaimHash(undefined);
      refetchAll();
    }
  }, [claimConfirmed, claimHash, refetchAll]);

  // Approval confirmation
  useEffect(() => {
    if (approveConfirmed && approveHash) {
      setIsApproving(false);
      setApproveHash(undefined);
      refetchApproval();
      addToast?.({
        type: 'success',
        title: 'Approval Confirmed',
        description: `${nftName} is now approved for staking.`,
      });
    }
  }, [approveConfirmed, approveHash, refetchApproval, addToast, nftName]);

  // ── Action callbacks ───────────────────────────────────────────────
  const handleError = useCallback(
    (err: unknown, fallbackTitle: string) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      const isRejection =
        msg.toLowerCase().includes('user rejected') ||
        msg.toLowerCase().includes('user denied');
      addToast?.({
        type: 'error',
        title: isRejection ? 'Transaction Cancelled' : fallbackTitle,
        description: isRejection ? 'You cancelled the transaction.' : msg,
      });
    },
    [addToast],
  );

  const stake = useCallback(
    async (n: number): Promise<void> => {
      if (!isStakerDeployed || !stakerAddress) return;
      if (n <= 0) return;
      const amount = BigInt(Math.floor(n));
      setIsStaking(true);
      try {
        addToast?.({
          type: 'info',
          title: 'Confirm in Wallet',
          description: `Staking ${n} unit${n === 1 ? '' : 's'} of ${nftName}...`,
          duration: 30_000,
        });
        const hash = await writeContractAsync({
          address: stakerAddress,
          abi: nftStakerAbi,
          functionName: 'stake',
          args: [amount],
        });
        setStakeHash(hash);
        addToast?.({
          type: 'info',
          title: 'Transaction Submitted',
          description: 'Waiting for stake confirmation...',
        });
      } catch (err) {
        setIsStaking(false);
        handleError(err, 'Stake Failed');
      }
    },
    [isStakerDeployed, stakerAddress, writeContractAsync, addToast, handleError, nftName],
  );

  const unstake = useCallback(
    async (n: number): Promise<void> => {
      if (!isStakerDeployed || !stakerAddress) return;
      if (n <= 0) return;
      const amount = BigInt(Math.floor(n));
      setIsUnstaking(true);
      try {
        addToast?.({
          type: 'info',
          title: 'Confirm in Wallet',
          description: `Unstaking ${n} unit${n === 1 ? '' : 's'} (pending phUSD will be claimed)...`,
          duration: 30_000,
        });
        const hash = await writeContractAsync({
          address: stakerAddress,
          abi: nftStakerAbi,
          functionName: 'unstake',
          args: [amount],
        });
        setUnstakeHash(hash);
        addToast?.({
          type: 'info',
          title: 'Transaction Submitted',
          description: 'Waiting for unstake confirmation...',
        });
      } catch (err) {
        setIsUnstaking(false);
        handleError(err, 'Unstake Failed');
      }
    },
    [isStakerDeployed, stakerAddress, writeContractAsync, addToast, handleError],
  );

  const claim = useCallback(
    async (): Promise<void> => {
      if (!isStakerDeployed || !stakerAddress) return;
      const claimable = pendingRewardRaw;
      setIsClaiming(true);
      try {
        addToast?.({
          type: 'info',
          title: 'Confirm in Wallet',
          description: `Claiming ${formatUnits(claimable, 18)} phUSD...`,
          duration: 30_000,
        });
        const hash = await writeContractAsync({
          address: stakerAddress,
          abi: nftStakerAbi,
          functionName: 'claim',
        });
        setClaimHash(hash);
        addToast?.({
          type: 'info',
          title: 'Transaction Submitted',
          description: 'Waiting for claim confirmation...',
        });
      } catch (err) {
        setIsClaiming(false);
        handleError(err, 'Claim Failed');
      }
    },
    [isStakerDeployed, stakerAddress, writeContractAsync, addToast, handleError, pendingRewardRaw],
  );

  const approveAll = useCallback(
    async (): Promise<void> => {
      if (!isStakerDeployed || !nftMinterAddress) return;
      setIsApproving(true);
      try {
        addToast?.({
          type: 'info',
          title: 'Confirm in Wallet',
          description: `Approving ${nftName} for staking...`,
          duration: 30_000,
        });
        const hash = await approveAllRaw();
        setApproveHash(hash);
        addToast?.({
          type: 'info',
          title: 'Transaction Submitted',
          description: 'Waiting for approval confirmation...',
        });
      } catch (err) {
        setIsApproving(false);
        handleError(err, 'Approval Failed');
      }
    },
    [isStakerDeployed, nftMinterAddress, approveAllRaw, addToast, handleError, nftName],
  );

  return {
    isStakerDeployed,
    stakedUnits,
    totalStaked,
    ownedUnits,
    pendingYield,
    ratePerSec,
    minApy,
    highestPrice,
    annualRewardDollars,
    isApprovedForAll,
    approveAll,
    isApproving,
    stake,
    unstake,
    claim,
    isStaking,
    isUnstaking,
    isClaiming,
  };
}
