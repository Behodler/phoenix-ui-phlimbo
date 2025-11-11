import type { ContractAddresses } from '../types/contracts'

/**
 * Mainnet contract addresses
 * TODO: Replace these placeholder addresses with actual deployed mainnet contract addresses before launch
 *
 * IMPORTANT: bondingCurve is the Behodler3Tokenlaunch contract (mints bonding tokens)
 *            bondingToken is the ERC20 token produced by the bonding curve
 */
export const MAINNET_CONTRACT_ADDRESSES: ContractAddresses = {
  dolaToken: '0x0000000000000000000000000000000000000000', // TODO: Add actual DOLA token address
  tokeToken: '0x0000000000000000000000000000000000000000', // TODO: Add actual TOKE token address
  autoDolaVault: '0x0000000000000000000000000000000000000000', // TODO: Add actual AutoDola vault address
  tokemakMainRewarder: '0x0000000000000000000000000000000000000000', // TODO: Add actual Tokemak main rewarder address
  bondingToken: '0x0000000000000000000000000000000000000000', // TODO: Add actual bonding token address
  autoDolaYieldStrategy: '0x0000000000000000000000000000000000000000', // TODO: Add actual AutoDolaYieldStrategy address
  bondingCurve: '0x0000000000000000000000000000000000000000', // TODO: Add actual Behodler3Tokenlaunch address
  surplusTracker: '0x0000000000000000000000000000000000000000', // TODO: Add actual SurplusTracker address after mainnet deployment
  surplusWithdrawer: '0x0000000000000000000000000000000000000000', // TODO: Add actual SurplusWithdrawer address after mainnet deployment
}

/**
 * Sepolia testnet contract addresses
 * Deployed contract addresses from deployment-staging-RM progress.json
 *
 * IMPORTANT: bondingCurve is the Behodler3Tokenlaunch contract (mints bonding tokens)
 *            bondingToken is the ERC20 token produced by the bonding curve
 */

export const SEPOLIA_CONTRACT_ADDRESSES: ContractAddresses = {
  autoDolaVault: '0xB1Bd6dFa01bDF73CC874766e527ec48dC7E219Ab',
  autoDolaYieldStrategy: '0x387f6C1Bd54ff45Ba5bD5cDb1e73191F9da41549',
  bondingCurve: '0x035cc3dA9EEf5b95F92ad8953D76f0EE9cC8de12',
  bondingToken: '0xe11e8237bb44FA621D3Bd2d4832Bc1Cf78CA7a64',
  dolaToken: '0x689ce47B630F676Cfc5C5B0Cd7Dabfcd999d105D',
  eyeToken: '0xb10E00DE1e7C9947D9eEF3E46e94ff56eB94d460',
  pauser: '0x7eb3B25D52eaE6AED07b148e3d75B6224F9481D9',
  surplusTracker: '0x6C5ABf4336591051A0288e8Ad1B0d833219D0b23',
  surplusWithdrawer: '0x58810b71885049b2043BED515724129A5269A68E',
  tokeToken: '0x771C4E7C3f5Ab191b796d66c66d471078bC46c34',
  tokemakMainRewarder: '0x589482473377217e38569a9eFb4b836F6be92564',
};
