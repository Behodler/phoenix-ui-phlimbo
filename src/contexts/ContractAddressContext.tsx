import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useChainId } from 'wagmi'
import type { ContractAddresses } from '../types/contracts'
import { NetworkType } from '../types/contracts'
import { getNetworkType, isMainnet, isSepolia, isLocalAnvil } from '../lib/networkDetection'
import { MAINNET_CONTRACT_ADDRESSES, SEPOLIA_CONTRACT_ADDRESSES } from '../lib/contracts'
import { fetchLocalAddresses } from '../lib/addressFetcher'

/**
 * Contract Address Context State
 */
interface ContractAddressContextState {
  addresses: ContractAddresses | null
  loading: boolean
  error: string | null
  networkType: NetworkType
}

/**
 * Contract Address Context
 */
const ContractAddressContext = createContext<ContractAddressContextState | undefined>(undefined)

/**
 * Contract Address Provider Props
 */
interface ContractAddressProviderProps {
  children: ReactNode
}

/**
 * Contract Address Provider Component
 *
 * Detects the current network and loads appropriate contract addresses:
 * - Mainnet (chain ID 1): Uses hardcoded addresses from constants
 * - Sepolia (chain ID 11155111): Uses hardcoded testnet addresses from constants
 * - Local Anvil (chain ID 31337): Fetches addresses from http://localhost:3001/contracts
 * - Other networks: Returns unsupported error
 *
 * @example
 * ```tsx
 * <ContractAddressProvider>
 *   <App />
 * </ContractAddressProvider>
 * ```
 */
export function ContractAddressProvider({ children }: ContractAddressProviderProps) {
  const chainId = useChainId()
  const [addresses, setAddresses] = useState<ContractAddresses | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [networkType, setNetworkType] = useState<NetworkType>(NetworkType.UNSUPPORTED)

  useEffect(() => {
    const loadAddresses = async () => {
      setLoading(true)
      setError(null)

      const detectedNetworkType = getNetworkType(chainId)
      setNetworkType(detectedNetworkType)

      console.log('🌐 Network detected:', {
        chainId,
        networkType: detectedNetworkType,
      })

      try {
        if (isMainnet(chainId)) {
          // Use hardcoded mainnet addresses
          console.log('🏦 Loading mainnet contract addresses')
          setAddresses(MAINNET_CONTRACT_ADDRESSES)
        } else if (isSepolia(chainId)) {
          // Use hardcoded Sepolia testnet addresses
          console.log('🧪 Loading Sepolia testnet contract addresses')
          setAddresses(SEPOLIA_CONTRACT_ADDRESSES)
        } else if (isLocalAnvil(chainId)) {
          // Fetch addresses from local development server
          console.log('🔧 Fetching contract addresses from local server...')
          const localAddresses = await fetchLocalAddresses()
          setAddresses(localAddresses)
        } else {
          // Unsupported network
          const errorMsg = `Unsupported network (Chain ID: ${chainId}). Please connect to Mainnet, Sepolia, or Local Anvil.`
          console.error('❌', errorMsg)
          setError(errorMsg)
          setAddresses(null)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load contract addresses'
        console.error('❌ Error loading contract addresses:', errorMsg)
        setError(errorMsg)
        setAddresses(null)
      } finally {
        setLoading(false)
      }
    }

    loadAddresses()
  }, [chainId])

  return (
    <ContractAddressContext.Provider value={{ addresses, loading, error, networkType }}>
      {children}
    </ContractAddressContext.Provider>
  )
}

/**
 * Custom hook to access contract addresses
 *
 * @returns Contract address context state
 * @throws Error if used outside of ContractAddressProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { addresses, loading, error, networkType } = useContractAddresses()
 *
 *   if (loading) return <div>Loading addresses...</div>
 *   if (error) return <div>Error: {error}</div>
 *   if (!addresses) return <div>No addresses available</div>
 *
 *   return <div>DOLA Token: {addresses.dolaToken}</div>
 * }
 * ```
 */
export function useContractAddresses(): ContractAddressContextState {
  const context = useContext(ContractAddressContext)

  if (context === undefined) {
    throw new Error('useContractAddresses must be used within a ContractAddressProvider')
  }

  return context
}
