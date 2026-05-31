import { useState } from 'react';
import { useToast } from '../components/ui/ToastProvider';
import USDC from '../assets/usdc-logo.svg';
import USDe from '../assets/USDe.png';
import sDOLA from '../assets/sDOLA.png';
import phUSD from '../assets/phUSD.png';

/**
 * Mock stablecoin staking pools (USDC / USDe / DOLA → earn phUSD).
 *
 * These are placeholders until the `stable-staker` contracts module is
 * deployed; a follow-up story will wire them to real contracts. All state,
 * transactions, and balance updates here are simulated in local component
 * state (mirrors the prototype `usePoolState`).
 */
export interface MockStablePool {
  id: string;
  stakeToken: string;
  stakeIcon: string;
  earnToken: string;
  earnIcon: string;
  apy: number;
  tvl: number;
  walletBalance: number;
  stakedBalance: number;
  pendingRewards: number;
  /** earn-token per second per user, for the live counter */
  ratePerSecond: number;
  tagline: string;
}

export const MOCK_STABLE_POOLS: MockStablePool[] = [
  {
    id: 'usdc',
    stakeToken: 'USDC',
    stakeIcon: USDC,
    earnToken: 'phUSD',
    earnIcon: phUSD,
    apy: 6.15,
    tvl: 1_280_000,
    walletBalance: 12_400,
    stakedBalance: 5000,
    pendingRewards: 1.847,
    ratePerSecond: 0.0000029,
    tagline: 'Stake USDC into the yield-bearing TVL pool, earn a phUSD stream.',
  },
  {
    id: 'usde',
    stakeToken: 'USDe',
    stakeIcon: USDe,
    earnToken: 'phUSD',
    earnIcon: phUSD,
    apy: 7.2,
    tvl: 940_000,
    walletBalance: 2_300,
    stakedBalance: 0,
    pendingRewards: 0,
    ratePerSecond: 0,
    tagline: 'Stake USDe, earn a phUSD stream.',
  },
  {
    id: 'dola',
    stakeToken: 'DOLA',
    stakeIcon: sDOLA,
    earnToken: 'phUSD',
    earnIcon: phUSD,
    apy: 5.8,
    tvl: 612_000,
    walletBalance: 800,
    stakedBalance: 0,
    pendingRewards: 0,
    ratePerSecond: 0,
    tagline: 'Stake DOLA, earn a phUSD stream.',
  },
];

export interface MockTxPending {
  poolId: string;
  action: 'stake' | 'withdraw' | 'claim';
}

export interface UseMockStablePoolsReturn {
  pools: MockStablePool[];
  txPending: MockTxPending | null;
  stake: (poolId: string, amount: string) => Promise<void>;
  withdraw: (poolId: string, amount: string) => Promise<void>;
  claim: (poolId: string) => Promise<void>;
}

const TX_DELAY_MS = 1400;

/**
 * Simulated stake/withdraw/claim hook for the mock stable pools.
 *
 * Uses the real app toast system (`useToast`) for feedback and applies
 * optimistic balance updates after a ~1.4s simulated transaction delay.
 */
export function useMockStablePools(): UseMockStablePoolsReturn {
  const [pools, setPools] = useState<MockStablePool[]>(() =>
    MOCK_STABLE_POOLS.map((p) => ({ ...p }))
  );
  const [txPending, setTxPending] = useState<MockTxPending | null>(null);
  const { addToast } = useToast();

  const poolFor = (id: string) => pools.find((p) => p.id === id);

  // Resolves after a delay — mocks signature + on-chain confirmation.
  const fakeTx = (poolId: string, action: MockTxPending['action']) => {
    setTxPending({ poolId, action });
    return new Promise<void>((res) =>
      setTimeout(() => {
        setTxPending(null);
        res();
      }, TX_DELAY_MS)
    );
  };

  const stake = async (poolId: string, amount: string): Promise<void> => {
    const amt = parseFloat(amount);
    const pool = poolFor(poolId);
    if (!pool || !amt || amt <= 0) return;
    addToast({ type: 'info', title: 'Confirm in wallet', description: `Staking ${amt.toLocaleString()} ${pool.stakeToken}…`, duration: 30000 });
    await fakeTx(poolId, 'stake');
    setPools((prev) =>
      prev.map((p) =>
        p.id === poolId
          ? {
              ...p,
              walletBalance: Math.max(0, p.walletBalance - amt),
              stakedBalance: p.stakedBalance + amt,
              ratePerSecond: p.ratePerSecond > 0 ? p.ratePerSecond * (1 + amt / (p.stakedBalance + 1)) : 0.0000018,
            }
          : p
      )
    );
    addToast({ type: 'success', title: 'Staked', description: `${amt.toLocaleString()} ${pool.stakeToken} deposited.` });
  };

  const withdraw = async (poolId: string, amount: string): Promise<void> => {
    const amt = parseFloat(amount);
    const pool = poolFor(poolId);
    if (!pool || !amt || amt <= 0) return;
    addToast({ type: 'info', title: 'Confirm in wallet', description: `Withdrawing ${amt.toLocaleString()} ${pool.stakeToken}…`, duration: 30000 });
    await fakeTx(poolId, 'withdraw');
    setPools((prev) =>
      prev.map((p) =>
        p.id === poolId
          ? {
              ...p,
              walletBalance: p.walletBalance + amt,
              stakedBalance: Math.max(0, p.stakedBalance - amt),
            }
          : p
      )
    );
    addToast({ type: 'success', title: 'Withdrawn', description: `${amt.toLocaleString()} ${pool.stakeToken} returned to wallet.` });
  };

  const claim = async (poolId: string): Promise<void> => {
    const pool = poolFor(poolId);
    if (!pool || pool.pendingRewards <= 0) return;
    const claimed = pool.pendingRewards;
    addToast({ type: 'info', title: 'Confirm in wallet', description: `Claiming ${claimed.toFixed(4)} ${pool.earnToken}…`, duration: 30000 });
    await fakeTx(poolId, 'claim');
    setPools((prev) => prev.map((p) => (p.id === poolId ? { ...p, pendingRewards: 0 } : p)));
    addToast({ type: 'success', title: 'Claimed', description: `${claimed.toFixed(4)} ${pool.earnToken} sent to your wallet.` });
  };

  return { pools, txPending, stake, withdraw, claim };
}

// ---- Formatting helpers (ported from the prototype) ---------------------
export const fmtUSD = (n: number) =>
  '$' + (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtTVL = (n: number) => {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
  return '$' + n.toFixed(0);
};

export const fmtAmount = (n: number, decimals = 4) => {
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
};

export const fmtAPY = (n: number) => n.toFixed(2) + '%';
