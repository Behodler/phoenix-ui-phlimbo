import type { ContractAddresses } from '../types/contracts'

/**
 * Mainnet contract addresses
 * TODO: Replace these placeholder addresses with actual deployed mainnet contract addresses before launch
 *
 * IMPORTANT: bondingCurve is the Behodler3Tokenlaunch contract (mints bonding tokens)
 *            bondingToken is the ERC20 token produced by the bonding curve
 */
export const MAINNET_CONTRACT_ADDRESSES: ContractAddresses = {
  dolaToken: '0x865377367054516e17014CcdED1e7d814EDC9ce4',
  tokeToken: '0x2e9d63788249371f1DFC918a52f8d799F4a38C94',
  eyeToken: '0x155ff1A85F440EE0A382eA949f24CE4E0b751c65',
  autoDolaVault: '0x79eB84B5E30Ef2481c8f00fD0Aa7aAd6Ac0AA54d',
  tokemakMainRewarder: '0xDC39C67b38ecdA8a1974336c89B00F68667c91B7',
  bondingToken: '0xf3B5B661b92B75C71fA5Aba8Fd95D7514A9CD605',
  autoDolaYieldStrategy: '0x6601b9A7678A00407090BD7dC0fe554bCbB7EF25',
  bondingCurve: '0xA06ae98c150f3ab5c109Df05Fc51be1dC25E2573',
  surplusTracker: '0x3d07755C02c69c07BfDc5cBe556d316D08D01447',
  surplusWithdrawer: '0xa525d92aDaF89C173245B39B74c643E63cA2341d',
  pauser: '0x912Ce60b408CFCF735ED5c2A5AE4E9F274670d9a',
};

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
