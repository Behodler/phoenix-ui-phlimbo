/**
 * Contract address registry shape. Copied from phStaging2
 * `server/deployments/addresses.ts` — never edit it locally; re-sync by
 * re-copying (see `src/types/generated/phStaging2/`).
 */
export type { ContractAddresses } from './generated/phStaging2/addresses'


/**
 * Response structure from local development address server
 * GET http://localhost:3001/contracts
 *
 * Note: Server sends behodler3Tokenlaunch (lowercase 'b', lowercase 'l'),
 *       which gets mapped to bondingCurve internally for cleaner naming.
 *       behodler3Tokenlaunch is the minter contract that accepts DOLA deposits,
 *       bondingToken is the ERC20 token it produces.
 */

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
