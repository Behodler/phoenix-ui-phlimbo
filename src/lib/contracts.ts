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
  autoDolaVault: '0x2215c4D493D46aF04550a75197F70363e2178E1b',
  autoDolaYieldStrategy: '0xdbd3383fAe2D72FCaa5aF7Ccd74B3290D140Badd',
  bondingCurve: '0xA95A4670fbd0b6b9130f840A3423Ff7CA82E53cf',
  bondingToken: '0xED33913430cdF11387FE2376b6ce79d20d8e2Ee7',
  dolaToken: '0x1E391B5A519543482D44e2724B7A8EB42AE469c9',
  tokeToken: '0x141F829D99e96db28411CFDe4286b070fCe24A54',
  tokemakMainRewarder: '0xA108d897C51ceD3Ae208c952FdE15D2B384e09aD',
  surplusTracker: '0x0000000000000000000000000000000000000000', // TODO: Add actual SurplusTracker address after Sepolia deployment
  surplusWithdrawer: '0x0000000000000000000000000000000000000000', // TODO: Add actual SurplusWithdrawer address after Sepolia deployment
};