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
}

/**
 * Sepolia testnet contract addresses
 * Deployed contract addresses from deployment-staging-RM progress.json
 *
 * IMPORTANT: bondingCurve is the Behodler3Tokenlaunch contract (mints bonding tokens)
 *            bondingToken is the ERC20 token produced by the bonding curve
 */
export const SEPOLIA_CONTRACT_ADDRESSES: ContractAddresses = {
  autoDolaVault: '0xbB5f6b7d9d64B9b6e2eE720284926a8d54FaA0cF',
  autoDolaYieldStrategy: '0x23BFFd51967342e926e6d2E0550Cd2E45c9f68a6',
  bondingCurve: '0x72F8003f2968DaF8D72926D79B2527Cc8a9b083d',
  bondingToken: '0x5A8581ba8F3872f261542F4aFDD7c8C1B40C1f81',
  dolaToken: '0x7cBB0D58734165A95C259c3B5ef3E1f6AAc10e7D',
  tokeToken: '0x2a6DF6574392Da39cEB97e035F4800E764D210Af',
  tokemakMainRewarder: '0x82b6DC26A72772620f06552ba91B1bD1Fd3753c8',
};
