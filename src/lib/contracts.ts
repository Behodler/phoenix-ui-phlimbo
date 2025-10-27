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
  dolaToken: '0x31981DD066cB5197fdd38A64De31531Ae6DC2F36', // MockERC20_DOLA
  tokeToken: '0xcfa67b2c9447f82aD663C2E08240673b7D7bdbeb', // MockERC20_TOKE
  autoDolaVault: '0xBB26c81a10d72568520288703431dCe53c9F2055', // MockAutoDOLA
  tokemakMainRewarder: '0xb0B28c6135b6d771312C35FA35b6696414cfb95e', // MockMainRewarder
  bondingToken: '0xCf2f5B89bb4C748836E8DB92Fd5FEA51E7E122d7', // FlaxToken
  autoDolaYieldStrategy: '0x928F13bceC9781B14D20AE3842C29D0F2A2e3b64', // AutoDolaYieldStrategy
  bondingCurve: '0x362855B10Be02244f08438bd7b7baa138AB030c8', // Behodler3Tokenlaunch
}
