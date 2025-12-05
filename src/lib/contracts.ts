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
  autoDolaVault: '0x6c67eea46843c1862074cc6676ee5d9a8c7d9dde',
  autoDolaYieldStrategy: '0x06bdb6597b61def3b208d7aa62dff6cd545c6597',
  bondingCurve: '0xa3d3d44893d1e043a4de85cd04ee18fe2c4eca43',
  bondingToken: '0x2b816211e1932dbcb0ac0fe10e3eb55d38237f27',
  dolaToken: '0x96f82e94126d7b377087018b9c86603288b3dc60',
  eyeToken: '0x65592560d929829aafa24b45a86ba80869381d29',
  pauser: '0x15e3a4b7a07265db3b24072e731f0994379bc7a9',
  surplusTracker: '0x0f4f811d0aa5e71f43bfed9519713220e85071e2',
  surplusWithdrawer: '0x7754d1935207fb8e8f637e3bc3193c23609027f9',
  tokeToken: '0xf74654cdef22ee236e0af6d0132962081e6c5fdf',
  tokemakMainRewarder: '0xbe45cecb90c7c66b38b3480db554421b80a055f9',
};
