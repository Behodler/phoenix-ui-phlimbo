/**
 * Contract addresses structure shared across mainnet and local development
 *
 * IMPORTANT DISTINCTION:
 * - bondingCurve: The Behodler3Tokenlaunch contract that MINTS bonding tokens (the factory/minter)
 * - bond ingToken: The ERC20 token PRODUCED by the bonding curve (the product)
 * - surplusTracker: Tracks surplus yield accumulation from the yield strategy
 * - surplusWithdrawer: Handles withdrawal of accumulated surplus yield
 */

export interface ContractAddresses {
  PhUSD: string;
  USDC: string;
  USDS: string;
  SUSDS: string;
  USDe: string;
  SUSDe: string;
  Dola: string;
  EYE: string;
  SCX: string;
  Flax: string;
  WBTC: string;
  Pauser: string;
  AutoDOLA: string;
  YieldStrategyDola: string;
  AutoUSDC: string;
  YieldStrategyUSDC: string;
  USDeAMMAdapter: string;
  YieldStrategyUSDe: string;
  PhusdStableMinter: string;
  PhlimboEA: string;
  StableYieldAccumulator: string;
  BalancerPool: string;
  BalancerVault: string;
  BurnRecorder: string;
  BalancerRouter: string;
  NFTMinter: string;
  UniboostEYE: string;
  UniboostSCX: string;
  UniboostFLX: string;
  BalancerPooler: string;
  GatherWBTC: string;
  MultiPooler: string;
  UniboostHookEYE: string;
  UniboostHookSCX: string;
  UniboostHookFLX: string;
  WaUSDC: string;
  SkyPSM: string;
  BalancerPoolerMintDebtHook: string;
  NFTStaker: string;
  BatchNFTMinter: string;
  UniboostStakerEYE: string;
  UniboostStakerSCX: string;
  UniboostStakerFLX: string;
  EyeBatchNFTMinter: string;
  ScxBatchNFTMinter: string;
  FlxBatchNFTMinter: string;
  NudgeRatchet: string;
  NudgeRatchetMintDebtHook: string;
  RatchetNFTStaker: string;
  RatchetBatchNFTMinter: string;
  StableStaker: string;
  DepositView: string;
  ViewRouter: string;
  DepositPageView: string;
  MintPageView: string;
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
