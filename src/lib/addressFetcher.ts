import type { ContractAddresses, LocalAddressServerResponse } from '../types/contracts'
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

    const data: LocalAddressServerResponse = await response.json()
    log.debug('📡 fetchLocalAddresses: Raw response data:', data)

    // Validate response structure
    if (!data.contracts) {
      throw new Error('Invalid response structure: missing contracts field')
    }

    // Map local contract addresses to unified structure
    // Note: Local server uses "mockAutoDolaVault" and "mockMainRewarder"
    // CRITICAL: Server sends "behodler3Tokenlaunch" (lowercase b, lowercase l) which we map to
    // "bondingCurve" for cleaner internal naming. This is the minter contract that accepts
    // DOLA deposits. bondingToken is the ERC20 token it produces.
    const addresses: ContractAddresses = {
      dolaToken: data.contracts.dolaToken,
      tokeToken: data.contracts.tokeToken,
      eyeToken: data.contracts.eyeToken || '0x0000000000000000000000000000000000000000',
      autoDolaVault: data.contracts.autoDolaVault,
      tokemakMainRewarder: data.contracts.tokemakMainRewarder,
      bondingToken: data.contracts.bondingToken,
      autoDolaYieldStrategy: data.contracts.autoDolaYieldStrategy,
      bondingCurve: data.contracts.behodler3Tokenlaunch,
      surplusTracker: data.contracts.surplusTracker,
      surplusWithdrawer: data.contracts.surplusWithdrawer,
      pauser: data.contracts.pauser || '0x0000000000000000000000000000000000000000',
    }
    log.debug('📡 fetchLocalAddresses: Mapped addresses:', addresses)

    // Validate all addresses are present
    // Allow zero addresses for optional contracts (pauser, eyeToken)
    const optionalContracts = ['pauser', 'eyeToken']
    const missingAddresses = Object.entries(addresses)
      .filter(([key, value]) => !value && !optionalContracts.includes(key))
      .map(([key]) => key)

    if (missingAddresses.length > 0) {
      log.error('❌ fetchLocalAddresses: Missing addresses:', missingAddresses)
      throw new Error(`Missing contract addresses: ${missingAddresses.join(', ')}`)
    }

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
