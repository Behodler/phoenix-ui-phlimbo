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
  autoDolaVault: '0x52D5A1cd81b4cc08aFa69132944686Bc0dCE6683',
  autoDolaYieldStrategy: '0x0f8500e47A7C3070611220De48b81eeDfD83bfb3',
  bondingCurve: '0xf49bdBa3194Fa044b9D6143f70197445b04aEDa7',
  bondingToken: '0xD15FD844227e3a474808e3F18561B4D230980716',
  dolaToken: '0xd4B6E817687005B30bFbf104Ef4F787347348AF8',
  surplusTracker: '0x9d72F8eF966c4772eb62425DD01952429587Da36',
  surplusWithdrawer: '0x5BAA4fd203Fc95a82aD19AC1b1c7f8bBB5226Bc3',
  tokeToken: '0x85bb8e662a3877A6bB074728c8DDa837E6505AeD',
  tokemakMainRewarder: '0x80B2407d16145761D368f51f231F91Cd41E49330',
};
