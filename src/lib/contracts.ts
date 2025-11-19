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
  eyeToken: '0x0000000000000000000000000000000000000000', // TODO: Add actual EYE token address
  autoDolaVault: '0x0000000000000000000000000000000000000000', // TODO: Add actual AutoDola vault address
  tokemakMainRewarder: '0x0000000000000000000000000000000000000000', // TODO: Add actual Tokemak main rewarder address
  bondingToken: '0x0000000000000000000000000000000000000000', // TODO: Add actual bonding token address
  autoDolaYieldStrategy: '0x0000000000000000000000000000000000000000', // TODO: Add actual AutoDolaYieldStrategy address
  bondingCurve: '0x0000000000000000000000000000000000000000', // TODO: Add actual Behodler3Tokenlaunch address
  surplusTracker: '0x0000000000000000000000000000000000000000', // TODO: Add actual SurplusTracker address after mainnet deployment
  surplusWithdrawer: '0x0000000000000000000000000000000000000000', // TODO: Add actual SurplusWithdrawer address after mainnet deployment
  pauser: '0x0000000000000000000000000000000000000000', // TODO: Add actual Pauser address after mainnet deployment
}

/**
 * Sepolia testnet contract addresses
 * Deployed contract addresses from deployment-staging-RM progress.json
 *
 * IMPORTANT: bondingCurve is the Behodler3Tokenlaunch contract (mints bonding tokens)
 *            bondingToken is the ERC20 token produced by the bonding curve
 */


export const SEPOLIA_CONTRACT_ADDRESSES: ContractAddresses = {
  autoDolaVault: '0x82484932a2B4B94337D56f6A3B8e7583FC1E5D81',
  autoDolaYieldStrategy: '0x9f500F1B05a52B76eC5873E11D29C1df4981d595',
  bondingCurve: '0xbb84159DfBc0ee88f51F0a350033B92b80F63e7F',
  bondingToken: '0x6B7A8A77713885e2e6bB8B4cb48Db9135bF81bC2',
  dolaToken: '0x57Df00a8aff6537af97DEa2930D37f714A864460',
  eyeToken: '0xC8ea89199F8bCd48D6FE2AF2870C2eb6CF73b7AD',
  pauser: '0xCfe7520695aef99C76862A25CD2273C3cDe1896C',
  surplusTracker: '0x64743FdfaFF5DE1f5bE33Ae85bDFB915C4b2dF41',
  surplusWithdrawer: '0x9f9d66EC89cAfA3f735Ac485004c8C97E8771E19',
  tokeToken: '0x36307fD3211b8365De44B83DB59a83F1B9FFc9E8',
  tokemakMainRewarder: '0xA5c1ABc6Ef84C2EE17C51E68c5Eb8d017A03DA4C',
};
