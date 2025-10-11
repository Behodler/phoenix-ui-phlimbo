/**
 * Contract addresses structure shared across mainnet and local development
 */
export interface ContractAddresses {
  dolaToken: string
  tokeToken: string
  autoDolaVault: string
  tokemakMainRewarder: string
  bondingToken: string
}

/**
 * Response structure from local development address server
 * GET http://localhost:3001/contracts
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
  }
}

/**
 * Network type constants
 */
export const NetworkType = {
  MAINNET: 'mainnet',
  LOCAL: 'local',
  UNSUPPORTED: 'unsupported',
} as const

export type NetworkType = typeof NetworkType[keyof typeof NetworkType]
