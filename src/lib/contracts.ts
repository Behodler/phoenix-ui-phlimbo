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
