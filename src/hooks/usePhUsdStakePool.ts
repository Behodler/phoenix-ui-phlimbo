import { useEffect, useState } from 'react';
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { parseUnits, maxUint256 } from 'viem';
import { phlimboV2Abi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { useToast } from '../components/ui/ToastProvider';
import { useWalletBalances } from '../contexts/WalletBalancesContext';
import { useApprovalTransaction } from './useTransaction';
import { useTokenApproval } from './useContractInteractions';
import { useDepositViewPolling } from './useDepositViewPolling';
import { useBalancerPrice } from './useBalancerPrice';
import { getErrorTitle, shouldOfferRetry } from '../utils/transactionErrors';
import { log } from '../utils/logger';

/**
 * Action currently awaiting wallet confirmation / chain confirmation.
 */
export type PhUsdStakeAction = 'stake' | 'withdraw' | 'claim' | 'approve';

/**
 * Clean, UI-facing view of the real phUSD staking pool (PhlimboEA).
 *
 * The phUSD pool in the Stake tab is the "inverse" pool: users stake **phUSD**
 * and earn **USDC** streamed from the yield funnel. All numbers here are
 * derived from the exact same reads the legacy Deposit/Withdraw tabs use
 * (DepositView polling + desiredAPYBps + the USDC-APY formula), so they match
 * to the digit.
 */
export interface PhUsdStakePool {
  /** Wallet phUSD balance (human, 18-decimal source). */
  walletBalance: number;
  /** Staked phUSD balance (human, 18-decimal source). */
  stakedBalance: number;
  /** Pending USDC rewards (human, 6-decimal source). */
  pendingRewards: number;
  /** USDC rewards per second for the live counter (human USDC/s). */
  ratePerSecond: number;
  /** USDC APY (same formula as the legacy Deposit tab). */
  apy: number;
  /** True when phUSD allowance toward PhlimboEA is below the requested amount. */
  needsApproval: (amount: string) => boolean;
  /** Whether the protocol is paused (stake/withdraw disabled). */
  isPaused: boolean;
  /** phUSD market price (mainnet only), used for USD-equivalent display. */
  phUsdMarketPrice: number | null;
  stake: (amount: string) => Promise<void>;
  withdraw: (amount: string) => Promise<void>;
  claim: () => Promise<void>;
  approve: () => Promise<void>;
  /** The action awaiting confirmation, or null. */
  txPending: PhUsdStakeAction | null;
  /** Whether the underlying read data is loading. */
  isLoading: boolean;
}

/**
 * Encapsulates the real phUSD pool reads + writes for the Stake tab.
 *
 * NOTE (deliberate duplication): this hook re-derives the DepositView polling
 * and the USDC-APY formula that currently live inline in VaultPage. This keeps
 * the new Stake surface isolated from the working legacy Deposit/Withdraw tabs
 * (story 068 Concerns: dedupe later once the legacy tabs are removed).
 *
 * @param isActive whether the Stake tab is currently active (gates polling)
 */
export function usePhUsdStakePool(isActive: boolean): PhUsdStakePool {
  const chainId = useChainId();
  const isMainnet = chainId === 1;
  const { address: walletAddress } = useAccount();
  const { addresses, networkType } = useContractAddresses();
  const { addToast } = useToast();
  const { refreshWalletBalances } = useWalletBalances();
  const { approve } = useTokenApproval();

  // ---- Reads: DepositView polling (wallet/staked/pending/allowance) -------
  const {
    data: depositViewData,
    isLoading: depositViewLoading,
    refresh: refreshDepositView,
  } = useDepositViewPolling(isActive);

  const userPhUSDBalance = depositViewData?.userPhUSDBalance ?? 0n;
  const pendingStableRewards = depositViewData?.pendingStableRewards ?? 0n;
  const stakedBalanceRaw = depositViewData?.stakedBalance ?? 0n;
  const userAllowance = depositViewData?.userAllowance ?? 0n;
  const stableRewardsPerSecond = depositViewData?.stableRewardsPerSecond ?? 0n;

  // ---- Reads: total staked (APY denominator) ------------------------------
  const { data: poolInfoData, isLoading: poolInfoLoading } = useReadContract({
    address: addresses?.PhlimboEA as `0x${string}` | undefined,
    abi: phlimboV2Abi,
    functionName: 'getPoolInfo',
    query: { enabled: !!addresses?.PhlimboEA },
  });
  const totalStakedRaw = poolInfoData
    ? (poolInfoData as [bigint, bigint, bigint, bigint, bigint])[0]
    : 0n;

  // ---- Reads: pause state -------------------------------------------------
  const pausableAbi = [
    {
      type: 'function',
      name: 'paused',
      inputs: [],
      outputs: [{ type: 'bool' }],
      stateMutability: 'view',
    },
  ] as const;
  const { data: isPausedRaw } = useReadContract({
    address: addresses?.PhusdStableMinter as `0x${string}` | undefined,
    abi: pausableAbi,
    functionName: 'paused',
    query: { enabled: !!addresses?.PhusdStableMinter },
  });

  // ---- Reads: phUSD market price (mainnet only) ---------------------------
  const { price: balancerPrice } = useBalancerPrice();
  const phUsdMarketPrice = isMainnet ? balancerPrice : null;

  // ---- USDC APY (identical to VaultPage:275-324) --------------------------
  const apy = (() => {
    const rewardsRate = stableRewardsPerSecond ? Number(stableRewardsPerSecond) : 0;
    const secondsPerYear = 31536000;

    let denominatorInPhUsd: number;
    if (totalStakedRaw > 0n) {
      denominatorInPhUsd = Number(totalStakedRaw) / 1e18;
    } else if (userPhUSDBalance > 0n) {
      denominatorInPhUsd = Number(userPhUSDBalance) / 1e18;
    } else {
      return 0;
    }
    if (denominatorInPhUsd === 0) return 0;

    let phUsdPriceMultiplier = 1.0;
    if (isMainnet && balancerPrice !== null) {
      if (balancerPrice > 0 && balancerPrice <= 2.0) {
        phUsdPriceMultiplier = balancerPrice;
      }
    }

    const denominatorInUsd = denominatorInPhUsd * phUsdPriceMultiplier;
    const annualUsdcRaw = (rewardsRate / 1e18) * secondsPerYear;
    const annualUsdcValue = annualUsdcRaw / 1e6;
    return (annualUsdcValue / denominatorInUsd) * 100;
  })();

  // ---- Derived human values -----------------------------------------------
  const walletBalance = userPhUSDBalance ? Number(userPhUSDBalance) / 1e18 : 0;
  const stakedBalance = stakedBalanceRaw ? Number(stakedBalanceRaw) / 1e18 : 0;
  const pendingRewards = pendingStableRewards ? Number(pendingStableRewards) / 1e6 : 0;
  // USDC reward stream is scaled by 1e18 and denominated in USDC (6 decimals).
  const ratePerSecond = stableRewardsPerSecond
    ? Number(stableRewardsPerSecond) / 1e18 / 1e6
    : 0;

  const needsApproval = (amount: string): boolean => {
    let amountWei = 0n;
    if (amount && amount !== '' && amount !== '0') {
      try {
        amountWei = parseUnits(amount, 18);
      } catch {
        amountWei = 0n;
      }
    }
    if (amountWei === 0n) return false;
    return userAllowance < amountWei;
  };

  // ---- Writes -------------------------------------------------------------
  const [txPending, setTxPending] = useState<PhUsdStakeAction | null>(null);
  const [pendingAmount, setPendingAmount] = useState<string>('');

  const explorerUrl = (hash: string) =>
    networkType === 'mainnet'
      ? `https://etherscan.io/tx/${hash}`
      : `https://sepolia.etherscan.io/tx/${hash}`;

  // Stake (PhlimboEA.stake)
  const { data: stakeHash, writeContractAsync: writeStake } = useWriteContract();
  const { isSuccess: isStakeSuccess } = useWaitForTransactionReceipt({
    hash: stakeHash,
    query: { enabled: !!stakeHash },
  });

  // Withdraw (PhlimboEA.withdraw)
  const { data: withdrawHash, writeContractAsync: writeWithdraw } = useWriteContract();
  const { isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({
    hash: withdrawHash,
    query: { enabled: !!withdrawHash },
  });

  // Claim (PhlimboEA.claim)
  const { data: claimHash, writeContractAsync: writeClaim } = useWriteContract();
  const { isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({
    hash: claimHash,
    query: { enabled: !!claimHash },
  });

  // phUSD approval toward PhlimboEA (reuses the legacy approval transaction).
  const approvalTransaction = useApprovalTransaction(
    async () => {
      if (!addresses?.PhUSD || !addresses?.PhlimboEA) {
        throw new Error('Contract addresses not loaded');
      }
      return approve(
        addresses.PhUSD as `0x${string}`,
        addresses.PhlimboEA as `0x${string}`,
        maxUint256
      );
    },
    {
      onSuccess: (hash) => {
        refreshDepositView();
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
        log.error('phUSD approval for stake failed:', error);
        setTxPending(null);
      },
      onStatusChange: (status) => {
        if (status === 'PENDING_SIGNATURE') {
          addToast({ type: 'info', title: 'Confirm in Wallet', description: 'Please confirm the approval transaction in your wallet.', duration: 30000 });
        } else if (status === 'PENDING_CONFIRMATION') {
          addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000 });
        }
      },
    }
  );

  const approveAction = async (): Promise<void> => {
    if (!walletAddress) {
      addToast({ type: 'error', title: 'Wallet Not Connected', description: 'Please connect your wallet using the button in the header.' });
      return;
    }
    if (!addresses?.PhUSD || !addresses?.PhlimboEA) {
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
    if (!walletAddress) {
      addToast({ type: 'error', title: 'Wallet Not Connected', description: 'Please connect your wallet using the button in the header.' });
      return;
    }
    if (!addresses?.PhlimboEA || !addresses?.PhUSD) {
      addToast({ type: 'error', title: 'Contract Not Ready', description: 'Please wait for contract addresses to load.' });
      return;
    }
    const parsed = parseFloat(amount);
    if (parsed > walletBalance) {
      addToast({ type: 'error', title: 'Insufficient Balance', description: `You only have ${walletBalance.toFixed(4)} phUSD available.` });
      return;
    }
    try {
      setTxPending('stake');
      setPendingAmount(amount);
      addToast({ type: 'info', title: 'Confirm Transaction', description: 'Please confirm the stake transaction in your wallet.', duration: 30000 });
      const amountWei = parseUnits(amount, 18);
      const hash = await writeStake({
        address: addresses.PhlimboEA as `0x${string}`,
        abi: phlimboV2Abi,
        functionName: 'stake',
        args: [amountWei, walletAddress],
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
    if (!walletAddress) {
      addToast({ type: 'error', title: 'Wallet Not Connected', description: 'Please connect your wallet using the button in the header.' });
      return;
    }
    if (!addresses?.PhlimboEA) {
      addToast({ type: 'error', title: 'Contract Not Ready', description: 'Please wait for contract addresses to load.' });
      return;
    }
    const parsed = parseFloat(amount);
    if (parsed > stakedBalance) {
      addToast({ type: 'error', title: 'Insufficient Staked Balance', description: `You only have ${stakedBalance.toFixed(4)} phUSD staked.` });
      return;
    }
    try {
      setTxPending('withdraw');
      setPendingAmount(amount);
      addToast({ type: 'info', title: 'Confirm Transaction', description: 'Please confirm the withdrawal transaction in your wallet.', duration: 30000 });
      const amountWei = parseUnits(amount, 18);
      const hash = await writeWithdraw({
        address: addresses.PhlimboEA as `0x${string}`,
        abi: phlimboV2Abi,
        functionName: 'withdraw',
        args: [amountWei, walletAddress],
      });
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, 'Withdrawal Failed');
      setTxPending(null);
    }
  };

  const claim = async (): Promise<void> => {
    if (!walletAddress) {
      addToast({ type: 'error', title: 'Wallet Not Connected', description: 'Please connect your wallet using the button in the header.' });
      return;
    }
    if (!addresses?.PhlimboEA) {
      addToast({ type: 'error', title: 'Contract Not Ready', description: 'Please wait for contract addresses to load.' });
      return;
    }
    try {
      setTxPending('claim');
      addToast({ type: 'info', title: 'Confirm Transaction', description: 'Please confirm the claim transaction in your wallet.', duration: 30000 });
      const hash = await writeClaim({
        address: addresses.PhlimboEA as `0x${string}`,
        abi: phlimboV2Abi,
        functionName: 'claim',
        args: [walletAddress],
      });
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, 'Claim Failed');
      setTxPending(null);
    }
  };

  function handleTxError(error: unknown, failTitle: string) {
    log.error(`${failTitle}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    if (errorMessage.toLowerCase().includes('user rejected') || errorMessage.toLowerCase().includes('user denied')) {
      addToast({ type: 'error', title: 'Transaction Cancelled', description: 'You cancelled the transaction. Please try again when ready.', duration: 8000 });
    } else {
      addToast({ type: 'error', title: failTitle, description: errorMessage, duration: 16000 });
    }
  }

  // ---- Post-tx success handlers (mirror VaultPage's useEffect pattern) -----
  useEffect(() => {
    if (isStakeSuccess && stakeHash) {
      const parsedAmount = parseFloat(pendingAmount || '0');
      addToast({ type: 'success', title: 'Stake Successful', description: `Successfully staked ${parsedAmount.toFixed(4)} phUSD`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(stakeHash), '_blank') } });
      setTxPending(null);
      setPendingAmount('');
      refreshDepositView();
      refreshWalletBalances();
    }
  }, [isStakeSuccess, stakeHash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isWithdrawSuccess && withdrawHash) {
      const parsedAmount = parseFloat(pendingAmount || '0');
      addToast({ type: 'success', title: 'Withdrawal Successful', description: `Successfully withdrew ${parsedAmount.toFixed(4)} phUSD plus pending rewards`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(withdrawHash), '_blank') } });
      setTxPending(null);
      setPendingAmount('');
      refreshDepositView();
      refreshWalletBalances();
    }
  }, [isWithdrawSuccess, withdrawHash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isClaimSuccess && claimHash) {
      const usdcDisplay = pendingStableRewards ? (Number(pendingStableRewards) / 1e6).toFixed(2) : '0.00';
      addToast({ type: 'success', title: 'Claim Successful', description: `Successfully claimed ${usdcDisplay} USDC rewards`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(claimHash), '_blank') } });
      setTxPending(null);
      refreshDepositView();
      refreshWalletBalances();
    }
  }, [isClaimSuccess, claimHash]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    walletBalance,
    stakedBalance,
    pendingRewards,
    ratePerSecond,
    apy,
    needsApproval,
    isPaused: isPausedRaw === true,
    phUsdMarketPrice,
    stake,
    withdraw,
    claim,
    approve: approveAction,
    txPending,
    isLoading: depositViewLoading || poolInfoLoading,
  };
}
