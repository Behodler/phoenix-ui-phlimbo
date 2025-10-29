import type { ContractAddresses, LocalAddressServerResponse } from '../types/contracts'

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
  try {
    const response = await fetch(LOCAL_ADDRESS_SERVER)

    if (!response.ok) {
      throw new Error(`Address server returned ${response.status}: ${response.statusText}`)
    }

    const data: LocalAddressServerResponse = await response.json()

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
      autoDolaVault: data.contracts.mockAutoDolaVault,
      tokemakMainRewarder: data.contracts.mockMainRewarder,
      bondingToken: data.contracts.bondingToken,
      autoDolaYieldStrategy: data.contracts.autoDolaYieldStrategy,
      bondingCurve: data.contracts.behodler3Tokenlaunch,
    }

    // Validate all addresses are present
    const missingAddresses = Object.entries(addresses)
      .filter(([_, value]) => !value)
      .map(([key]) => key)

    if (missingAddresses.length > 0) {
      throw new Error(`Missing contract addresses: ${missingAddresses.join(', ')}`)
    }

    return addresses
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `Local address server is not running at ${LOCAL_ADDRESS_SERVER}. ` +
          'Please start the address server before running the UI in local development mode.'
      )
    }
    throw error
  }
}
