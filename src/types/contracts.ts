/**
 * Contract addresses structure shared across mainnet and local development
 *
 * IMPORTANT DISTINCTION:
 * - bondingCurve: The Behodler3Tokenlaunch contract that MINTS bonding tokens (the factory/minter)
 * - bondingToken: The ERC20 token PRODUCED by the bonding curve (the product)
 * - surplusTracker: Tracks surplus yield accumulation from the yield strategy
 * - surplusWithdrawer: Handles withdrawal of accumulated surplus yield
 */
export interface ContractAddresses {
  PhUSD: string,
  USDC: string,
  USDT: string,
  Dola: string,
  USDS: string,
  EYE: string,
  Pauser: string,
  YieldStrategyUSDT: string,
  YieldStrategyDola: string,
  YieldStrategyUSDS: string,
  PhusdStableMinter: string,
  StableYieldAccumulator: string,
  PhlimboEA: string
}


/**
 * Response structure from local development address server
 * GET http://localhost:3001/contracts
 *
 * Note: Server sends behodler3Tokenlaunch (lowercase 'b', lowercase 'l'),
 *       which gets mapped to bondingCurve internally for cleaner naming.
 *       behodler3Tokenlaunch is the minter contract that accepts DOLA deposits,
 *       bondingToken is the ERC20 token it produces.
 */

/**
 * Network type constants
 */
export const NetworkType = {
  MAINNET: 'mainnet',
  SEPOLIA: 'sepolia',
  LOCAL: 'local',
  UNSUPPORTED: 'unsupported',
} as const

export type NetworkType = typeof NetworkType[keyof typeof NetworkType]
