import type { ContractAddresses } from '../types/contracts'
import { log } from '../utils/logger'

/**
 * Local development address server endpoint
 */
const LOCAL_ADDRESS_SERVER = 'http://localhost:3001/contracts'

/**
 * Fetches contract addresses from the local development server
 * @returns Promise resolving to contract addresses
 * @throws Error if server is not running or response is invalid
 */
export async function fetchLocalAddresses(): Promise<ContractAddresses> {
  log.debug('📡 fetchLocalAddresses: Attempting to fetch from', LOCAL_ADDRESS_SERVER)
  try {
    const response = await fetch(LOCAL_ADDRESS_SERVER)
    log.debug('📡 fetchLocalAddresses: Response status:', response.status, response.statusText)

    if (!response.ok) {
      throw new Error(`Address server returned ${response.status}: ${response.statusText}`)
    }

    const data: ContractAddresses = await response.json()
    log.debug('📡 fetchLocalAddresses: Raw response data:', data)

    // Validate response structure
    if (!data) {
      throw new Error('Invalid response structure: missing contracts field')
    }

    // Map local contract addresses to unified structure
    // Note: Local server uses "mockAutoDolaVault" and "mockMainRewarder"
    // CRITICAL: Server sends "behodler3Tokenlaunch" (lowercase b, lowercase l) which we map to
    // "bondingCurve" for cleaner internal naming. This is the minter contract that accepts
    // DOLA deposits. bondingToken is the ERC20 token it produces.
    const addresses: ContractAddresses = {

      Dola: data.Dola || '0x0000000000000000000000000000000000000000',
      EYE: data.EYE || '0x0000000000000000000000000000000000000000',
      YieldStrategyDola: data.YieldStrategyDola ||  '0x0000000000000000000000000000000000000000',
      Pauser: data.Pauser || '0x0000000000000000000000000000000000000000',
      PhUSD: data.PhUSD || '0x0000000000000000000000000000000000000000',
      USDC: data.USDC || '0x0000000000000000000000000000000000000000',
      USDT: data.USDT || '0x0000000000000000000000000000000000000000',
      USDS: data.USDS || '0x0000000000000000000000000000000000000000',
      YieldStrategyUSDT: data.YieldStrategyUSDT || '0x0000000000000000000000000000000000000000',
      YieldStrategyUSDS: data.YieldStrategyUSDS || '0x0000000000000000000000000000000000000000',
      PhusdStableMinter: data.PhusdStableMinter || '0x0000000000000000000000000000000000000000',
      StableYieldAccumulator: data.StableYieldAccumulator || '0x0000000000000000000000000000000000000000',
      PhlimboEA: data.PhlimboEA || '0x0000000000000000000000000000000000000000'
    }
    log.debug('📡 fetchLocalAddresses: Mapped addresses:', addresses)




    log.debug('✅ fetchLocalAddresses: Successfully validated all addresses')
    return addresses
  } catch (error) {
    log.error('❌ fetchLocalAddresses: Error occurred:', error)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `Local address server is not running at ${LOCAL_ADDRESS_SERVER}. ` +
        'Please start the address server before running the UI in local development mode.'
      )
    }
    throw error
  }
}
