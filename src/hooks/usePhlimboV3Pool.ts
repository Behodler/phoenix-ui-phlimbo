import { useEffect, useState } from 'react';
import {
  useAccount,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { parseUnits, maxUint256 } from 'viem';
import { phlimboV3Abi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { useToast } from '../components/ui/ToastProvider';
import { useWalletBalances } from '../contexts/WalletBalancesContext';
import { usePolling } from '../contexts/PollingContext';
import { useApprovalTransaction } from './useTransaction';
import { useTokenApproval } from './useContractInteractions';
import { useDepositPageView, PromoPhase } from './useDepositPageView';
import type { DepositPageViewData } from './useDepositPageView';
import { useBalancerPrice } from './useBalancerPrice';
import { getErrorTitle, shouldOfferRetry } from '../utils/transactionErrors';
import { decodeContractError } from '../lib/decodeContractError';
import { log } from '../utils/logger';

/** Heartbeat for re-reading the page view while real-time updates are on. */
const STAKE_REFRESH_INTERVAL_MS = 12_000;

/** The stable reward token (USDC) is 6-decimal. */
const STABLE_DECIMALS = 6;

const SECONDS_PER_YEAR = 31_536_000;

export type PhlimboV3Action =
  | 'stake'
  | 'withdraw'
  | 'claim'
  | 'approve'
  | 'claimPromo'
  | 'claimStable'
  | 'claimPhUSD';

/**
 * UI-facing view of the successor deposit farm (PhlimboV3).
 *
 * Mirrors `usePhUsdStakePool` (the incumbent V2 pool) field for field so the
 * two Stake surfaces can be compared side by side during the cutover, and adds
 * the V3-only promo and banked-entitlement surface.
 */
export interface PhlimboV3Pool {
  /** Full decoded page view — 23 fields, already descaled. Null until loaded. */
  view: DepositPageViewData | null;
  /**
   * The DepositPageViewV3 implementation resolved from ViewRouter. Needed for
   * `getRetiredPromoBanks`, which the router does not proxy.
   */
  depositPageViewAddress: `0x${string}` | undefined;

  // --- projected onto the shared StakeRowModel ------------------------------
  walletBalance: number;
  stakedBalance: number;
  /** Claimable-now stable rewards (human). Excludes the banked bucket. */
  pendingRewards: number;
  ratePerSecond: number;
  apy: number;
  /**
   * This wallet's share of the promo emission, in promo-token units per second.
   * Zero unless a promotion is Active *and* still funded — a flushing or
   * drained promotion accrues nothing, so a live counter ticking against it
   * would invent yield the contract will never pay.
   */
  promoRatePerSecond: number;
  /**
   * The USD figure every APY on this farm divides by: staked phUSD priced in
   * USD, falling back to this wallet's balance before anything is staked so a
   * fresh farm still quotes a rate. Zero when neither is known.
   *
   * Exposed so a second reward stream can be annualised against exactly the
   * same denominator as `apy`, rather than a re-derived near-copy of it.
   */
  apyDenominatorUSD: number;
  needsApproval: (amount: string) => boolean;
  isPaused: boolean;
  phUsdMarketPrice: number | null;

  // --- writes ---------------------------------------------------------------
  stake: (amount: string) => Promise<void>;
  withdraw: (amount: string) => Promise<void>;
  claim: () => Promise<void>;
  approve: () => Promise<void>;
  /** Claim promo banked after a failed transfer. */
  claimUnclaimablePromo: (token: `0x${string}`) => Promise<void>;
  /** Claim stable banked after a failed transfer. */
  claimUnclaimableStable: () => Promise<void>;
  /** Claim phUSD banked after a failed mint. */
  claimUnclaimablePhUSD: () => Promise<void>;

  txPending: PhlimboV3Action | null;
  isLoading: boolean;
  refresh: () => void;
}

export function usePhlimboV3Pool(isActive: boolean): PhlimboV3Pool {
  const chainId = useChainId();
  const isMainnet = chainId === 1;
  const { address: walletAddress } = useAccount();
  const { addresses, networkType } = useContractAddresses();
  const { addToast } = useToast();
  const { refreshWalletBalances } = useWalletBalances();
  const { approve } = useTokenApproval();
  const { isPollingEnabled } = usePolling();

  const phlimboV3 = addresses?.PhlimboV3 as `0x${string}` | undefined;

  // ---- Reads: the whole surface comes from one router-resolved page view ---
  const { data: view, depositPageViewAddress, isLoading, refetch } = useDepositPageView(isActive);

  useEffect(() => {
    if (!isActive || !isPollingEnabled) return;
    const id = setInterval(() => refetch(), STAKE_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isActive, isPollingEnabled, refetch]);

  // ---- phUSD market price (mainnet only) ----------------------------------
  const { price: balancerPrice } = useBalancerPrice();
  const phUsdMarketPrice = isMainnet ? balancerPrice : null;

  // ---- Derived human values ------------------------------------------------
  const walletBalance = view ? Number(view.userPhUSDBalance) / 1e18 : 0;
  const stakedBalance = view ? Number(view.stakedBalance) / 1e18 : 0;
  const pendingRewards = view ? Number(view.pendingStableRewards) / 10 ** STABLE_DECIMALS : 0;
  const totalStaked = view ? Number(view.totalStaked) / 1e18 : 0;

  // Denominator shared by every reward stream's APY on this farm. Factored out
  // of the stable-APY expression so the promo stream annualises against the
  // identical base — see `apyDenominatorUSD` on the interface.
  const apyDenominatorUSD = (() => {
    if (!view) return 0;

    let denominatorInPhUsd: number;
    if (view.totalStaked > 0n) {
      denominatorInPhUsd = totalStaked;
    } else if (view.userPhUSDBalance > 0n) {
      denominatorInPhUsd = walletBalance;
    } else {
      return 0;
    }
    if (denominatorInPhUsd === 0) return 0;

    let phUsdPriceMultiplier = 1.0;
    if (isMainnet && balancerPrice !== null && balancerPrice > 0 && balancerPrice <= 2.0) {
      phUsdPriceMultiplier = balancerPrice;
    }

    return denominatorInPhUsd * phUsdPriceMultiplier;
  })();

  // Same APY formula as the V2 pool, but sourced from the page view's own
  // PRECISION (field 7) rather than a hardcoded 1e18. USDC is a dollar, so the
  // annual emission is already a USD numerator.
  const apy =
    view && apyDenominatorUSD > 0
      ? ((view.stableRewardsPerSecond * SECONDS_PER_YEAR) / apyDenominatorUSD) * 100
      : 0;

  // This wallet's share of the pool-wide emission. Frozen when Live is off.
  const ratePerSecond =
    view && isPollingEnabled && totalStaked > 0 && stakedBalance > 0
      ? view.stableRewardsPerSecond * (stakedBalance / totalStaked)
      : 0;

  // The promo twin of `ratePerSecond`. Gated on the promotion actually paying:
  // Flushing freezes accrual while the contract walks the staker set, and an
  // Active promotion whose reward balance has drained to zero emits nothing
  // until it is topped up.
  const promoIsPaying =
    !!view &&
    view.hasPromo &&
    view.promoPhase === PromoPhase.Active &&
    view.promoRewardBalance > 0n;

  const promoRatePerSecond =
    view && isPollingEnabled && promoIsPaying && totalStaked > 0 && stakedBalance > 0
      ? view.promoRewardPerSecond * (stakedBalance / totalStaked)
      : 0;

  const needsApproval = (amount: string): boolean => {
    if (!view) return false;
    let amountWei = 0n;
    if (amount && amount !== '' && amount !== '0') {
      try {
        amountWei = parseUnits(amount, 18);
      } catch {
        amountWei = 0n;
      }
    }
    if (amountWei === 0n) return false;
    return view.userAllowance < amountWei;
  };

  // ---- Writes --------------------------------------------------------------
  const [txPending, setTxPending] = useState<PhlimboV3Action | null>(null);
  const [pendingAmount, setPendingAmount] = useState<string>('');

  const explorerUrl = (hash: string) =>
    networkType === 'mainnet'
      ? `https://etherscan.io/tx/${hash}`
      : `https://sepolia.etherscan.io/tx/${hash}`;

  const { data: stakeHash, writeContractAsync: writeStake } = useWriteContract();
  const { isSuccess: isStakeSuccess } = useWaitForTransactionReceipt({
    hash: stakeHash,
    query: { enabled: !!stakeHash },
  });

  const { data: withdrawHash, writeContractAsync: writeWithdraw } = useWriteContract();
  const { isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({
    hash: withdrawHash,
    query: { enabled: !!withdrawHash },
  });

  const { data: claimHash, writeContractAsync: writeClaim } = useWriteContract();
  const { isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({
    hash: claimHash,
    query: { enabled: !!claimHash },
  });

  const { data: bankHash, writeContractAsync: writeBank } = useWriteContract();
  const { isSuccess: isBankSuccess } = useWaitForTransactionReceipt({
    hash: bankHash,
    query: { enabled: !!bankHash },
  });

  const approvalTransaction = useApprovalTransaction(
    async () => {
      if (!addresses?.PhUSD || !phlimboV3) {
        throw new Error('Contract addresses not loaded');
      }
      return approve(addresses.PhUSD as `0x${string}`, phlimboV3, maxUint256);
    },
    {
      onSuccess: (hash) => {
        refetch();
        setTxPending(null);
        addToast({
          type: 'success',
          title: 'Approval Successful',
          description: 'phUSD spending has been approved for staking.',
          duration: 30000,
          action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(hash), '_blank') },
        });
      },
      onError: (error) => {
        log.error('phUSD approval for V3 stake failed:', error);
        setTxPending(null);
      },
      onStatusChange: (status) => {
        if (status === 'PENDING_SIGNATURE') {
          addToast({ type: 'info', title: 'Confirm in Wallet', description: 'Please confirm the approval transaction in your wallet.', duration: 30000 });
        } else if (status === 'PENDING_CONFIRMATION') {
          addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000 });
        }
      },
    },
  );

  function handleTxError(error: unknown, failTitle: string) {
    log.error(`${failTitle}:`, error);
    const decoded = decodeContractError(error);
    if (decoded.userRejected) {
      addToast({ type: 'error', title: 'Transaction Cancelled', description: 'You cancelled the transaction. Please try again when ready.', duration: 8000 });
    } else {
      addToast({ type: 'error', title: failTitle, description: decoded.message, duration: 16000 });
    }
  }

  /** Guard shared by every write: wallet connected and V3 address resolved. */
  const ready = (): boolean => {
    if (!walletAddress) {
      addToast({ type: 'error', title: 'Wallet Not Connected', description: 'Please connect your wallet using the button in the header.' });
      return false;
    }
    if (!phlimboV3) {
      addToast({ type: 'error', title: 'Contract Not Ready', description: 'PhlimboV3 address is not loaded for this network.' });
      return false;
    }
    return true;
  };

  const approveAction = async (): Promise<void> => {
    if (!ready()) return;
    if (!addresses?.PhUSD) {
      addToast({ type: 'error', title: 'Contract Not Ready', description: 'Please wait for contract addresses to load.' });
      return;
    }
    setTxPending('approve');
    try {
      await approvalTransaction.execute();
    } catch {
      if (approvalTransaction.state.error) {
        const { error: txError } = approvalTransaction.state;
        addToast({
          type: 'error',
          title: getErrorTitle(txError.type),
          description: txError.message,
          duration: 16000,
          action: shouldOfferRetry(txError.type) ? { label: 'Retry', onClick: () => approvalTransaction.retry() } : undefined,
        });
      }
      setTxPending(null);
    }
  };

  const stake = async (amount: string): Promise<void> => {
    if (!amount || amount === '0' || amount === '') {
      addToast({ type: 'error', title: 'Invalid Amount', description: 'Please enter a valid amount greater than 0.' });
      return;
    }
    if (!ready()) return;
    if (parseFloat(amount) > walletBalance) {
      addToast({ type: 'error', title: 'Insufficient Balance', description: `You only have ${walletBalance.toFixed(4)} phUSD available.` });
      return;
    }
    // MINIMUM_STAKE is a hard revert on the contract; surface it before signing.
    const amountWei = parseUnits(amount, 18);
    if (view && amountWei < view.minimumStake && view.stakedBalance === 0n) {
      addToast({
        type: 'error',
        title: 'Below Minimum Stake',
        description: `The farm requires at least ${(Number(view.minimumStake) / 1e18).toFixed(4)} phUSD for a first stake.`,
      });
      return;
    }
    try {
      setTxPending('stake');
      setPendingAmount(amount);
      addToast({ type: 'info', title: 'Confirm Transaction', description: 'Please confirm the stake transaction in your wallet.', duration: 30000 });
      const hash = await writeStake({
        address: phlimboV3!,
        abi: phlimboV3Abi,
        functionName: 'stake',
        args: [amountWei, walletAddress!],
      });
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, 'Stake Failed');
      setTxPending(null);
    }
  };

  const withdraw = async (amount: string): Promise<void> => {
    if (!amount || amount === '0' || amount === '') {
      addToast({ type: 'error', title: 'Invalid Amount', description: 'Please enter a valid amount greater than 0.' });
      return;
    }
    if (!ready()) return;
    if (parseFloat(amount) > stakedBalance) {
      addToast({ type: 'error', title: 'Insufficient Staked Balance', description: `You only have ${stakedBalance.toFixed(4)} phUSD staked.` });
      return;
    }
    try {
      setTxPending('withdraw');
      setPendingAmount(amount);
      addToast({ type: 'info', title: 'Confirm Transaction', description: 'Please confirm the withdrawal transaction in your wallet.', duration: 30000 });
      const hash = await writeWithdraw({
        address: phlimboV3!,
        abi: phlimboV3Abi,
        functionName: 'withdraw',
        args: [parseUnits(amount, 18), walletAddress!],
      });
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, 'Withdrawal Failed');
      setTxPending(null);
    }
  };

  const claim = async (): Promise<void> => {
    if (!ready()) return;
    try {
      setTxPending('claim');
      addToast({ type: 'info', title: 'Confirm Transaction', description: 'Please confirm the claim transaction in your wallet.', duration: 30000 });
      const hash = await writeClaim({
        address: phlimboV3!,
        abi: phlimboV3Abi,
        functionName: 'claim',
        args: [walletAddress!],
      });
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, 'Claim Failed');
      setTxPending(null);
    }
  };

  /**
   * The three banked-bucket claims. V3 banks a reward whenever paying it out
   * fails (a reverting token transfer, a revoked mint), at which point the
   * matching `pendingX` drops to zero — so these are the only way to recover it.
   */
  const claimBanked = async (
    action: Extract<PhlimboV3Action, 'claimPromo' | 'claimStable' | 'claimPhUSD'>,
    functionName: 'claimUnclaimablePromo' | 'claimUnclaimableStable' | 'claimUnclaimablePhUSD',
    args: readonly unknown[],
    failTitle: string,
  ): Promise<void> => {
    if (!ready()) return;
    try {
      setTxPending(action);
      addToast({ type: 'info', title: 'Confirm Transaction', description: 'Please confirm the claim transaction in your wallet.', duration: 30000 });
      const hash = await writeBank({
        address: phlimboV3!,
        abi: phlimboV3Abi,
        functionName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: args as any,
      });
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, failTitle);
      setTxPending(null);
    }
  };

  const claimUnclaimablePromo = (token: `0x${string}`) =>
    claimBanked('claimPromo', 'claimUnclaimablePromo', [token], 'Promo Claim Failed');
  const claimUnclaimableStable = () =>
    claimBanked('claimStable', 'claimUnclaimableStable', [], 'Stable Claim Failed');
  const claimUnclaimablePhUSD = () =>
    claimBanked('claimPhUSD', 'claimUnclaimablePhUSD', [], 'phUSD Claim Failed');

  // ---- Post-tx success handlers -------------------------------------------
  useEffect(() => {
    if (isStakeSuccess && stakeHash) {
      addToast({ type: 'success', title: 'Stake Successful', description: `Successfully staked ${parseFloat(pendingAmount || '0').toFixed(4)} phUSD`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(stakeHash), '_blank') } });
      setTxPending(null);
      setPendingAmount('');
      refetch();
      refreshWalletBalances();
    }
  }, [isStakeSuccess, stakeHash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isWithdrawSuccess && withdrawHash) {
      addToast({ type: 'success', title: 'Withdrawal Successful', description: `Successfully withdrew ${parseFloat(pendingAmount || '0').toFixed(4)} phUSD plus pending rewards`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(withdrawHash), '_blank') } });
      setTxPending(null);
      setPendingAmount('');
      refetch();
      refreshWalletBalances();
    }
  }, [isWithdrawSuccess, withdrawHash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isClaimSuccess && claimHash) {
      addToast({ type: 'success', title: 'Claim Successful', description: `Successfully claimed ${pendingRewards.toFixed(2)} USDC rewards`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(claimHash), '_blank') } });
      setTxPending(null);
      refetch();
      refreshWalletBalances();
    }
  }, [isClaimSuccess, claimHash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isBankSuccess && bankHash) {
      addToast({ type: 'success', title: 'Claim Successful', description: 'Banked rewards have been released to your wallet.', duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(bankHash), '_blank') } });
      setTxPending(null);
      refetch();
      refreshWalletBalances();
    }
  }, [isBankSuccess, bankHash]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    view,
    depositPageViewAddress,
    walletBalance,
    stakedBalance,
    pendingRewards,
    ratePerSecond,
    apy,
    promoRatePerSecond,
    apyDenominatorUSD,
    needsApproval,
    // The farm reports its own pause state (field 10). It is always true while
    // a promo is Flushing.
    isPaused: view?.paused ?? false,
    phUsdMarketPrice,
    stake,
    withdraw,
    claim,
    approve: approveAction,
    claimUnclaimablePromo,
    claimUnclaimableStable,
    claimUnclaimablePhUSD,
    txPending,
    isLoading,
    refresh: refetch,
  };
}
