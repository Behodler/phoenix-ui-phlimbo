import { useEffect, useState } from 'react';
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { parseUnits, maxUint256, erc20Abi, zeroAddress } from 'viem';
import { stableStakerAbi, erc4626MarketYieldStrategyAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { useToast } from '../components/ui/ToastProvider';
import { useWalletBalances } from '../contexts/WalletBalancesContext';
import { usePolling } from '../contexts/PollingContext';
import { useTokenApproval } from './useContractInteractions';
import { useBalancerPrice } from './useBalancerPrice';
import { STABLE_POOLS, type StablePoolConfig, type StablePoolId } from '../data/stableStakerPools';
import phUSDIcon from '../assets/phUSD.png';
import { log } from '../utils/logger';

/**
 * Heartbeat for re-reading on-chain stable-pool data while real-time updates
 * are on. Mirrors the phUSD pool's cadence.
 */
const STAKE_REFRESH_INTERVAL_MS = 12_000;
const SECONDS_PER_YEAR = 31_536_000;

export type StableStakeAction = 'stake' | 'withdraw' | 'claim' | 'approve';

/**
 * A single stable pool projected onto the shape `StakeAccordionRow` consumes.
 * Stable pools stake USDC/USDe/DOLA and earn phUSD (18 decimals).
 */
export interface StableStakeRow {
  id: StablePoolId;
  stakeToken: string;
  stakeIcon: string;
  earnToken: 'phUSD';
  earnIcon: string;
  walletBalance: number;
  stakedBalance: number;
  pendingRewards: number;
  ratePerSecond: number;
  apy: number;
  pendingDecimals: number;
  stakePriceUSD: number;
  earnPriceUSD: number;
  liveTicker: boolean;
  isLegacy: false;
  /** Global pause — gates ALL actions for this pool. */
  disabled: boolean;
  /** Per-pool underwater flag — gates ONLY this pool's withdraw. */
  withdrawDisabled: boolean;
  needsApproval: (amount: string) => boolean;
  tagline: string;
  /**
   * Max slippage (bps) of the pool's ERC4626Market yield strategy, when it has
   * one (USDe). Deposits pay exactly this haircut; withdrawals pay between
   * zero and this depending on the strategy's buffer. Undefined for pools
   * without an AMM-routed strategy (and while the value is loading).
   */
  conversionBps?: number;
}

export interface UseStableStakerPools {
  pools: StableStakeRow[];
  pendingAction: { id: StablePoolId; action: StableStakeAction } | null;
  stake: (id: StablePoolId, amount: string) => Promise<void>;
  withdraw: (id: StablePoolId, amount: string) => Promise<void>;
  claim: (id: StablePoolId) => Promise<void>;
  approve: (id: StablePoolId) => Promise<void>;
  isLoading: boolean;
}

/**
 * Per-token on-chain reads. Called exactly once per static pool config (a fixed
 * 3-entry list) so the rules of hooks are satisfied.
 */
interface PoolReads {
  walletBalance: number;
  stakedBalance: number;
  pendingRewards: number;
  ratePerSecond: number;
  apy: number;
  withdrawDisabled: boolean;
  allowanceRaw: bigint;
  conversionBps: number | undefined;
  isLoading: boolean;
  refresh: () => void;
}

function useStablePoolReads(
  config: StablePoolConfig,
  stableStaker: `0x${string}` | undefined,
  tokenAddress: `0x${string}` | undefined,
  strategyAddress: `0x${string}` | undefined,
  walletAddress: `0x${string}` | undefined,
  phUsdPriceUSD: number,
  isActive: boolean,
  isPollingEnabled: boolean,
): PoolReads {
  const enabled = !!stableStaker && !!tokenAddress;
  const enabledUser = enabled && !!walletAddress;

  const { data: poolInfo, isLoading: poolInfoLoading, refetch: refetchPoolInfo } = useReadContract({
    address: stableStaker,
    abi: stableStakerAbi,
    functionName: 'poolInfo',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled },
  });

  const { data: userInfo, isLoading: userInfoLoading, refetch: refetchUserInfo } = useReadContract({
    address: stableStaker,
    abi: stableStakerAbi,
    functionName: 'userInfo',
    args: tokenAddress && walletAddress ? [tokenAddress, walletAddress] : undefined,
    query: { enabled: enabledUser },
  });

  const { data: pending, isLoading: pendingLoading, refetch: refetchPending } = useReadContract({
    address: stableStaker,
    abi: stableStakerAbi,
    functionName: 'pendingReward',
    args: tokenAddress && walletAddress ? [tokenAddress, walletAddress] : undefined,
    query: { enabled: enabledUser },
  });

  const { data: withdrawDisabledRaw, refetch: refetchWithdrawDisabled } = useReadContract({
    address: stableStaker,
    abi: stableStakerAbi,
    functionName: 'withdrawDisabled',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled },
  });

  const { data: walletBalanceRaw, isLoading: balanceLoading, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!tokenAddress && !!walletAddress },
  });

  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: walletAddress && stableStaker ? [walletAddress, stableStaker] : undefined,
    query: { enabled: !!tokenAddress && !!walletAddress && !!stableStaker },
  });

  // Max slippage of the pool's ERC4626Market yield strategy, when it has one.
  // Admin-set and effectively static, so it's read once and deliberately left
  // out of the 12s heartbeat refresh.
  const { data: slippageBpsRaw } = useReadContract({
    address: strategyAddress,
    abi: erc4626MarketYieldStrategyAbi,
    functionName: 'slippageToleranceBps',
    query: { enabled: !!strategyAddress },
  });

  const refresh = () => {
    refetchPoolInfo();
    refetchUserInfo();
    refetchPending();
    refetchWithdrawDisabled();
    refetchBalance();
    refetchAllowance();
  };

  // 12s heartbeat, gated on tab-active + the global Live toggle.
  useEffect(() => {
    if (!isActive || !isPollingEnabled) return;
    const interval = setInterval(() => refresh(), STAKE_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isPollingEnabled, enabled, enabledUser]);

  const pool = poolInfo as [bigint, bigint, bigint, bigint] | undefined;
  const phusdPerSecond = pool ? pool[0] : 0n;
  const totalStaked = pool ? pool[3] : 0n;
  const userAmount = userInfo ? (userInfo as [bigint, bigint])[0] : 0n;
  const pendingRaw = (pending as bigint | undefined) ?? 0n;

  const walletBalance = walletBalanceRaw ? Number(walletBalanceRaw) / 10 ** config.decimals : 0;
  const stakedBalance = userAmount ? Number(userAmount) / 10 ** config.decimals : 0;
  const pendingRewards = pendingRaw ? Number(pendingRaw) / 1e18 : 0;

  // User's phUSD/s share of emissions = phusdPerSecond * userAmount / totalStaked.
  // Both userAmount and totalStaked are in token decimals, so the ratio is
  // dimensionless; phusdPerSecond is 18-dec phUSD/s. Guard totalStaked == 0.
  // Hold the counter still when polling is paused (rate 0).
  const ratePerSecond =
    isPollingEnabled && totalStaked > 0n && userAmount > 0n
      ? (Number(phusdPerSecond) / 1e18) * (Number(userAmount) / Number(totalStaked))
      : 0;

  // APY = annualized phUSD emission (in USD) / deposit USD * 100. Stables valued
  // at $1.00, phUSD at phUsdPriceUSD.
  //
  // When the pool already has staked deposits (totalStaked > 0) we report the
  // real, current APY off the actual total. When the pool is empty there is no
  // real APY to show, so we infer a *starting* APY from a placeholder deposit:
  // what the user would earn if they deposited their entire wallet balance and
  // became the sole staker (owning 100% of emissions). For dust balances below
  // 10 (or a disconnected wallet → 0), we assume a placeholder of 100 tokens so
  // the figure stays representative instead of spiking arbitrarily high.
  const apy = (() => {
    const annualPhUsd = (Number(phusdPerSecond) / 1e18) * SECONDS_PER_YEAR;
    const annualUsd = annualPhUsd * phUsdPriceUSD;

    // Effective deposit (in tokens) that anchors the APY denominator.
    const depositTokens =
      totalStaked > 0n
        ? Number(totalStaked) / 10 ** config.decimals
        : walletBalance < 10
          ? 100
          : walletBalance;

    const depositUsd = depositTokens * 1.0;
    if (depositUsd === 0) return 0;
    return (annualUsd / depositUsd) * 100;
  })();

  return {
    walletBalance,
    stakedBalance,
    pendingRewards,
    ratePerSecond,
    apy,
    withdrawDisabled: withdrawDisabledRaw === true,
    allowanceRaw: (allowanceRaw as bigint | undefined) ?? 0n,
    conversionBps:
      strategyAddress && slippageBpsRaw !== undefined ? Number(slippageBpsRaw as bigint) : undefined,
    isLoading: poolInfoLoading || userInfoLoading || pendingLoading || balanceLoading,
    refresh,
  };
}

/**
 * Real on-chain stable-pool layer for the Stake tab (story 069). Replaces the
 * former mock `useMockStablePools`. Reads poolInfo / userInfo / pendingReward /
 * wallet balance / allowance per token from the deployed StableStaker, plus the
 * global `paused()` and per-pool `withdrawDisabled(token)` flags, and exposes
 * approve / stake / withdraw / claim writes.
 *
 * The address resolves through `useContractAddresses()` (local server on dev,
 * `contracts.ts` on mainnet/sepolia). Per the story's explicit decision there
 * is no zero-address fallback — calls simply fail until the address is set.
 *
 * @param isActive whether the Stake tab is currently active (gates polling)
 */
export function useStableStakerPools(isActive: boolean): UseStableStakerPools {
  const chainId = useChainId();
  const isMainnet = chainId === 1;
  const { address: walletAddress } = useAccount();
  const { addresses, networkType } = useContractAddresses();
  const { addToast } = useToast();
  const { refreshWalletBalances } = useWalletBalances();
  const { approve } = useTokenApproval();
  const { isPollingEnabled } = usePolling();
  const { price: balancerPrice } = useBalancerPrice();

  const stableStaker = addresses?.StableStaker as `0x${string}` | undefined;
  const phUsdMarketPrice = isMainnet ? balancerPrice : null;
  const phUsdPriceUSD = phUsdMarketPrice !== null && phUsdMarketPrice > 0 ? phUsdMarketPrice : 1.0;

  const tokenAddressFor = (cfg: StablePoolConfig): `0x${string}` | undefined =>
    addresses ? (addresses[cfg.addressKey] as `0x${string}`) : undefined;

  // ERC4626Market yield strategy address for pools that route deposits through
  // an AMM (USDe). Undefined (read disabled) for the others, and when the
  // address server reports the zero-address placeholder.
  const strategyAddressFor = (cfg: StablePoolConfig): `0x${string}` | undefined => {
    if (!addresses || !cfg.marketStrategyKey) return undefined;
    const addr = addresses[cfg.marketStrategyKey] as `0x${string}`;
    return addr && addr !== zeroAddress ? addr : undefined;
  };

  // ---- Global pause (gates all actions for all pools) ---------------------
  const { data: isPausedRaw } = useReadContract({
    address: stableStaker,
    abi: stableStakerAbi,
    functionName: 'paused',
    query: { enabled: !!stableStaker },
  });
  const isPaused = isPausedRaw === true;

  // ---- Per-token reads (fixed 3-entry static config) ----------------------
  const usdcReads = useStablePoolReads(STABLE_POOLS[0], stableStaker, tokenAddressFor(STABLE_POOLS[0]), strategyAddressFor(STABLE_POOLS[0]), walletAddress, phUsdPriceUSD, isActive, isPollingEnabled);
  const usdeReads = useStablePoolReads(STABLE_POOLS[1], stableStaker, tokenAddressFor(STABLE_POOLS[1]), strategyAddressFor(STABLE_POOLS[1]), walletAddress, phUsdPriceUSD, isActive, isPollingEnabled);
  const dolaReads = useStablePoolReads(STABLE_POOLS[2], stableStaker, tokenAddressFor(STABLE_POOLS[2]), strategyAddressFor(STABLE_POOLS[2]), walletAddress, phUsdPriceUSD, isActive, isPollingEnabled);
  const readsById: Record<StablePoolId, PoolReads> = {
    usdc: usdcReads,
    usde: usdeReads,
    dola: dolaReads,
  };

  const configById = (id: StablePoolId) => STABLE_POOLS.find((p) => p.id === id)!;

  const needsApprovalFor = (cfg: StablePoolConfig, allowanceRaw: bigint) => (amount: string): boolean => {
    if (!amount || amount === '' || amount === '0') return false;
    let amountWei = 0n;
    try {
      amountWei = parseUnits(amount, cfg.decimals);
    } catch {
      return false;
    }
    if (amountWei === 0n) return false;
    return allowanceRaw < amountWei;
  };

  const pools: StableStakeRow[] = STABLE_POOLS.map((cfg) => {
    const r = readsById[cfg.id];
    return {
      id: cfg.id,
      stakeToken: cfg.symbol,
      stakeIcon: cfg.stakeIcon,
      earnToken: 'phUSD' as const,
      earnIcon: phUSDIcon,
      walletBalance: r.walletBalance,
      stakedBalance: r.stakedBalance,
      pendingRewards: r.pendingRewards,
      ratePerSecond: r.ratePerSecond,
      apy: r.apy,
      pendingDecimals: 18,
      stakePriceUSD: 1.0,
      earnPriceUSD: phUsdPriceUSD,
      liveTicker: true,
      isLegacy: false as const,
      disabled: isPaused,
      withdrawDisabled: r.withdrawDisabled,
      needsApproval: needsApprovalFor(cfg, r.allowanceRaw),
      tagline: cfg.tagline,
      conversionBps: r.conversionBps,
    };
  });

  // ---- Writes -------------------------------------------------------------
  const [pendingAction, setPendingAction] = useState<{ id: StablePoolId; action: StableStakeAction } | null>(null);
  // Track which pool each write hash belongs to so the success effect refreshes
  // the right pool.
  const [stakeCtx, setStakeCtx] = useState<{ id: StablePoolId; amount: string } | null>(null);
  const [withdrawCtx, setWithdrawCtx] = useState<{ id: StablePoolId; amount: string } | null>(null);
  const [claimCtx, setClaimCtx] = useState<{ id: StablePoolId } | null>(null);
  const [approveCtx, setApproveCtx] = useState<{ id: StablePoolId } | null>(null);

  const explorerUrl = (hash: string) =>
    networkType === 'mainnet'
      ? `https://etherscan.io/tx/${hash}`
      : `https://sepolia.etherscan.io/tx/${hash}`;

  const { data: stakeHash, writeContractAsync: writeStake } = useWriteContract();
  const { isSuccess: isStakeSuccess } = useWaitForTransactionReceipt({ hash: stakeHash, query: { enabled: !!stakeHash } });

  const { data: withdrawHash, writeContractAsync: writeWithdraw } = useWriteContract();
  const { isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash, query: { enabled: !!withdrawHash } });

  const { data: claimHash, writeContractAsync: writeClaim } = useWriteContract();
  const { isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({ hash: claimHash, query: { enabled: !!claimHash } });

  // Approval goes through the shared `useTokenApproval().approve` helper (its own
  // internal write), so we track the returned hash ourselves to await the receipt.
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>(undefined);
  const { isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash, query: { enabled: !!approveHash } });

  function handleTxError(error: unknown, failTitle: string) {
    log.error(`${failTitle}:`, error);
    const msg = error instanceof Error ? error.message : 'Unknown error occurred';
    if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('user denied')) {
      addToast({ type: 'error', title: 'Transaction Cancelled', description: 'You cancelled the transaction. Please try again when ready.', duration: 8000 });
    } else {
      addToast({ type: 'error', title: failTitle, description: msg, duration: 16000 });
    }
  }

  const ensureReady = (cfg: StablePoolConfig): `0x${string}` | undefined => {
    if (!walletAddress) {
      addToast({ type: 'error', title: 'Wallet Not Connected', description: 'Please connect your wallet using the button in the header.' });
      return undefined;
    }
    const tokenAddress = tokenAddressFor(cfg);
    if (!stableStaker || !tokenAddress) {
      addToast({ type: 'error', title: 'Contract Not Ready', description: 'Please wait for contract addresses to load.' });
      return undefined;
    }
    return tokenAddress;
  };

  const approveAction = async (id: StablePoolId): Promise<void> => {
    const cfg = configById(id);
    const tokenAddress = ensureReady(cfg);
    if (!tokenAddress) return;
    try {
      setPendingAction({ id, action: 'approve' });
      setApproveCtx({ id });
      addToast({ type: 'info', title: 'Confirm in Wallet', description: `Please confirm the ${cfg.symbol} approval in your wallet.`, duration: 30000 });
      const hash = await approve(tokenAddress, stableStaker!, maxUint256);
      setApproveHash(hash);
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, 'Approval Failed');
      setPendingAction(null);
      setApproveCtx(null);
    }
  };

  const stake = async (id: StablePoolId, amount: string): Promise<void> => {
    const cfg = configById(id);
    if (isPaused) {
      addToast({ type: 'info', title: 'Staking Paused', description: 'Staking is temporarily paused. Please try again later.' });
      return;
    }
    if (!amount || amount === '0' || amount === '') {
      addToast({ type: 'error', title: 'Invalid Amount', description: 'Please enter a valid amount greater than 0.' });
      return;
    }
    const tokenAddress = ensureReady(cfg);
    if (!tokenAddress) return;
    if (parseFloat(amount) > readsById[id].walletBalance) {
      addToast({ type: 'error', title: 'Insufficient Balance', description: `You only have ${readsById[id].walletBalance.toFixed(4)} ${cfg.symbol} available.` });
      return;
    }
    try {
      setPendingAction({ id, action: 'stake' });
      setStakeCtx({ id, amount });
      addToast({ type: 'info', title: 'Confirm Transaction', description: `Please confirm the ${cfg.symbol} stake in your wallet.`, duration: 30000 });
      const amountWei = parseUnits(amount, cfg.decimals);
      const hash = await writeStake({ address: stableStaker!, abi: stableStakerAbi, functionName: 'stake', args: [tokenAddress, amountWei] });
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, 'Stake Failed');
      setPendingAction(null);
      setStakeCtx(null);
    }
  };

  const withdraw = async (id: StablePoolId, amount: string): Promise<void> => {
    const cfg = configById(id);
    if (isPaused) {
      addToast({ type: 'info', title: 'Withdrawals Paused', description: 'Withdrawals are temporarily paused. Please try again later.' });
      return;
    }
    if (readsById[id].withdrawDisabled) {
      addToast({
        type: 'info',
        title: 'Withdrawals Paused',
        description: "Withdrawals for this pool are temporarily paused — the pool's yield strategy is below par. Staking and claiming are unaffected.",
        duration: 12000,
      });
      return;
    }
    if (!amount || amount === '0' || amount === '') {
      addToast({ type: 'error', title: 'Invalid Amount', description: 'Please enter a valid amount greater than 0.' });
      return;
    }
    const tokenAddress = ensureReady(cfg);
    if (!tokenAddress) return;
    if (parseFloat(amount) > readsById[id].stakedBalance) {
      addToast({ type: 'error', title: 'Insufficient Staked Balance', description: `You only have ${readsById[id].stakedBalance.toFixed(4)} ${cfg.symbol} staked.` });
      return;
    }
    try {
      setPendingAction({ id, action: 'withdraw' });
      setWithdrawCtx({ id, amount });
      addToast({ type: 'info', title: 'Confirm Transaction', description: `Please confirm the ${cfg.symbol} withdrawal in your wallet.`, duration: 30000 });
      const amountWei = parseUnits(amount, cfg.decimals);
      const hash = await writeWithdraw({ address: stableStaker!, abi: stableStakerAbi, functionName: 'withdraw', args: [tokenAddress, amountWei] });
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, 'Withdrawal Failed');
      setPendingAction(null);
      setWithdrawCtx(null);
    }
  };

  const claim = async (id: StablePoolId): Promise<void> => {
    const cfg = configById(id);
    if (isPaused) {
      addToast({ type: 'info', title: 'Claiming Paused', description: 'Claiming is temporarily paused. Please try again later.' });
      return;
    }
    const tokenAddress = ensureReady(cfg);
    if (!tokenAddress) return;
    if (readsById[id].pendingRewards <= 0) {
      addToast({ type: 'info', title: 'Nothing to Claim', description: `No pending phUSD rewards in the ${cfg.symbol} pool.` });
      return;
    }
    try {
      setPendingAction({ id, action: 'claim' });
      setClaimCtx({ id });
      addToast({ type: 'info', title: 'Confirm Transaction', description: `Please confirm the ${cfg.symbol} pool claim in your wallet.`, duration: 30000 });
      const hash = await writeClaim({ address: stableStaker!, abi: stableStakerAbi, functionName: 'claim', args: [tokenAddress] });
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, 'Claim Failed');
      setPendingAction(null);
      setClaimCtx(null);
    }
  };

  // ---- Post-tx success handlers -------------------------------------------
  useEffect(() => {
    if (isStakeSuccess && stakeHash && stakeCtx) {
      const cfg = configById(stakeCtx.id);
      addToast({ type: 'success', title: 'Stake Successful', description: `Successfully staked ${parseFloat(stakeCtx.amount || '0').toFixed(4)} ${cfg.symbol}`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(stakeHash), '_blank') } });
      readsById[stakeCtx.id].refresh();
      refreshWalletBalances();
      setPendingAction(null);
      setStakeCtx(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStakeSuccess, stakeHash]);

  useEffect(() => {
    if (isWithdrawSuccess && withdrawHash && withdrawCtx) {
      const cfg = configById(withdrawCtx.id);
      addToast({ type: 'success', title: 'Withdrawal Successful', description: `Successfully withdrew ${parseFloat(withdrawCtx.amount || '0').toFixed(4)} ${cfg.symbol} plus pending phUSD`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(withdrawHash), '_blank') } });
      readsById[withdrawCtx.id].refresh();
      refreshWalletBalances();
      setPendingAction(null);
      setWithdrawCtx(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWithdrawSuccess, withdrawHash]);

  useEffect(() => {
    if (isClaimSuccess && claimHash && claimCtx) {
      const cfg = configById(claimCtx.id);
      addToast({ type: 'success', title: 'Claim Successful', description: `Successfully claimed pending phUSD from the ${cfg.symbol} pool`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(claimHash), '_blank') } });
      readsById[claimCtx.id].refresh();
      refreshWalletBalances();
      setPendingAction(null);
      setClaimCtx(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClaimSuccess, claimHash]);

  useEffect(() => {
    if (isApproveSuccess && approveHash && approveCtx) {
      const cfg = configById(approveCtx.id);
      addToast({ type: 'success', title: 'Approval Successful', description: `${cfg.symbol} spending approved for staking.`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(approveHash), '_blank') } });
      // Re-read allowance so the button flips from Approve to Stake.
      readsById[approveCtx.id].refresh();
      setPendingAction(null);
      setApproveCtx(null);
      setApproveHash(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproveSuccess, approveHash]);

  const isLoading = usdcReads.isLoading || usdeReads.isLoading || dolaReads.isLoading;

  return {
    pools,
    pendingAction,
    stake,
    withdraw,
    claim,
    approve: approveAction,
    isLoading,
  };
}
