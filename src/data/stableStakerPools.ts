import USDC from '../assets/usdc-logo.svg';
import USDe from '../assets/USDe.png';
import sDOLA from '../assets/sDOLA.png';
import type { ContractAddresses } from '../types/contracts';

/**
 * Static configuration for the three StableStaker pools (story 069).
 *
 * The pool *list* is fixed (USDC / USDe / DOLA → earn phUSD); all per-pool
 * on-chain state (staked, pending, APY, TVL, paused, withdrawDisabled) is read
 * live by `useStableStakerPools`. `addressKey` indexes the resolved
 * `ContractAddresses` so the token address is never hardcoded here.
 */
export type StablePoolId = 'usdc' | 'usde' | 'dola';

export interface StablePoolConfig {
  id: StablePoolId;
  /** Display symbol of the stake token. */
  symbol: string;
  /** Key into the resolved ContractAddresses for this token's address. */
  addressKey: keyof ContractAddresses;
  /** Token native decimals (USDC 6, USDe/DOLA 18). */
  decimals: number;
  /** Stake-token icon. */
  stakeIcon: string;
  /** Short tagline shown in the expanded row. */
  tagline: string;
}

export const STABLE_POOLS: StablePoolConfig[] = [
  {
    id: 'usdc',
    symbol: 'USDC',
    addressKey: 'USDC',
    decimals: 6,
    stakeIcon: USDC,
    tagline: 'Stake USDC into the yield-bearing TVL pool, earn a phUSD stream.',
  },
  {
    id: 'usde',
    symbol: 'USDe',
    addressKey: 'USDe',
    decimals: 18,
    stakeIcon: USDe,
    tagline: 'Stake USDe, earn a phUSD stream.',
  },
  {
    id: 'dola',
    symbol: 'DOLA',
    addressKey: 'Dola',
    decimals: 18,
    stakeIcon: sDOLA,
    tagline: 'Stake DOLA, earn a phUSD stream.',
  },
];
