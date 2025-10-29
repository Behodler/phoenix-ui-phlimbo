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
  autoDolaVault: '0x13945a513cb0b1497F9ac8a55Cb4028e27bCDC8E',
  autoDolaYieldStrategy: '0x362dEBe98E24c66cF996B8843337026D958cD3cc',
  bondingCurve: '0x145C8FDaA6C82d9a8D2DB94BC7C6F7B879B9EC9f',
  bondingToken: '0x839ba8D694410340Dce412f6fc13cd98Fe183032',
  dolaToken: '0x9Fb6eE3F58337eb825Af1e0B588D3b730F604589',
  tokeToken: '0x2bdC9F5b0FC859d707667548b7c3eFE3D3517064',
  tokemakMainRewarder: '0xe605c78F0a1dcf7D87c50f5eA9F68DbA2bb0864E',
};
