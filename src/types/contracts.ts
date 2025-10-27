/**
 * Contract addresses structure shared across mainnet and local development
 *
 * IMPORTANT DISTINCTION:
 * - bondingCurve: The Behodler3Tokenlaunch contract that MINTS bonding tokens (the factory/minter)
 * - bondingToken: The ERC20 token PRODUCED by the bonding curve (the product)
 */
export interface ContractAddresses {
  dolaToken: string
  tokeToken: string
  autoDolaVault: string
  tokemakMainRewarder: string
  bondingToken: string
  autoDolaYieldStrategy: string
  bondingCurve: string
}

/**
 * Response structure from local development address server
 * GET http://localhost:3001/contracts
 *
 * Note: Server sends behodler3Tokenlaunch (lowercase 'b', lowercase 'l'),
 *       which gets mapped to bondingCurve internally for cleaner naming.
 *       behodler3Tokenlaunch is the minter contract that accepts DOLA deposits,
 *       bondingToken is the ERC20 token it produces.
 */
export interface LocalAddressServerResponse {
  networkId: number
  networkName: string
  deployedAt: string
  rpcUrl: string
  contracts: {
    dolaToken: string
    tokeToken: string
    mockAutoDolaVault: string
    mockMainRewarder: string
    bondingToken: string
    autoDolaYieldStrategy: string
    behodler3Tokenlaunch: string
  }
}

/**
 * Network type constants
 */
export const NetworkType = {
  MAINNET: 'mainnet',
  SEPOLIA: 'sepolia',
  LOCAL: 'local',
  UNSUPPORTED: 'unsupported',
} as const

export type NetworkType = typeof NetworkType[keyof typeof NetworkType]
