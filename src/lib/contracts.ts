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
  autoDolaVault: '0x0352CA6dab003dFB8958C2A5F0d1E7385c493536',
  autoDolaYieldStrategy: '0xD7Eb6e4EF6E26B59F6475180315Ff4624CFbd720',
  bondingCurve: '0x35d836570E74335EF9b58016469636A7a3D7eDcB',
  bondingToken: '0xC83FBc587F46B8Ddc318FDB428678071c9Eb8230',
  dolaToken: '0x048895cA43c99FBc8E1eC9E758B810754B83CEA8',
  surplusTracker: '0xF74716A89915a6D975d1c809FD7ca455Cae8f044',
  surplusWithdrawer: '0xD54A9aE74DF70541EE9DA1ea280fE05B0Cb3237E',
  tokeToken: '0x25b084A31960a7dE34c04fd61eEA6c8701EfA40c',
  tokemakMainRewarder: '0x61214059bD91B1a4A4748818c9FDF18543d7d59D',
};
