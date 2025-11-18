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
  autoDolaVault: '0x38922e154e5b9410195a5454Ed8753668D43e23E',
  autoDolaYieldStrategy: '0x34A238F701E5Ba0dE8CE93Ce045F9A8A397E90D1',
  bondingCurve: '0x30CA05536e9Bd686bd030A90C862700686e16275',
  bondingToken: '0x4adA3BD2DFe1833e39D25B8210B158CcBe35D093',
  dolaToken: '0x90dFeFCB7010E6E27434B3758005a318B8758A7c',
  eyeToken: '0x25bbfC47cA8916BD895B311B27aB9946F45b2451',
  pauser: '0x1653D52861289977439D3055e84c1024541B1114',
  surplusTracker: '0x9ff7d5e7352B9c29596b18E08fC2E9165B512758',
  surplusWithdrawer: '0x9e35C1D206Ce74B2B7BD37039F49693bf2eAD51f',
  tokeToken: '0xB3Bc1577B5b8e2636905679455fFCa5eF1941bA6',
  tokemakMainRewarder: '0x653521230023D3Ecf13bB0A46606e99942D262a2',
};
