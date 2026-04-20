import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useChainId } from 'wagmi'
import type { ContractAddresses, YieldNFTAddresses } from '../types/contracts'
import { NetworkType } from '../types/contracts'
import { getNetworkType, isMainnet, isSepolia, isLocalAnvil } from '../lib/networkDetection'
import { MAINNET_CONTRACT_ADDRESSES, SEPOLIA_CONTRACT_ADDRESSES } from '../lib/contracts'
import { fetchLocalAddresses } from '../lib/addressFetcher'
import { log } from '../utils/logger'

/**
 * Primary-view mapping of NFT-related contract addresses.
 *
 * The UI consumes these opinionated names rather than reaching into
 * `addresses.nftsV2.NFTMinter` directly, so the consumer layer stays
 * stable when the upstream generated shape evolves. All fields point
 * at the V2 deploy; `nftMinter_old` carries the full V1 struct and
 * is reserved for a future migration UI (no consumer in this story).
 */
export interface NFTPrimaryView {
  NFTMinter: string
  BalancerPooler: string
  BurnerEYE: string
  BurnerSCX: string
  BurnerFlax: string
  GatherWBTC: string
  MintPageView: string
  /** Full V1 NFT struct, reserved for a future migration story. */
  nftMinter_old: YieldNFTAddresses
}

/**
 * Contract Address Context State
 */
interface ContractAddressContextState {
  addresses: ContractAddresses | null
  /**
   * Opinionated NFT primary view resolved from `addresses.nftsV2` plus
   * the top-level `MintPageView`. Null when `addresses` is null.
   */
  nftPrimary: NFTPrimaryView | null
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
      log.debug('🔍 ContractAddressContext: Loading addresses for chainId:', chainId)
      setLoading(true)
      setError(null)

      const detectedNetworkType = getNetworkType(chainId)
      log.debug('🌐 Detected network type:', detectedNetworkType)
      setNetworkType(detectedNetworkType)

      try {
        if (isMainnet(chainId)) {
          // Use hardcoded mainnet addresses
          log.debug('📍 Using mainnet addresses')
          setAddresses(MAINNET_CONTRACT_ADDRESSES)
        } else if (isSepolia(chainId)) {
          // Use hardcoded Sepolia testnet addresses
          log.debug('📍 Using Sepolia testnet addresses')
          setAddresses(SEPOLIA_CONTRACT_ADDRESSES)
        } else if (isLocalAnvil(chainId)) {
          // Fetch addresses from local development server
          log.debug('🔧 Detected Anvil (chainId 31337) - fetching addresses from http://localhost:3001/contracts')
          const localAddresses = await fetchLocalAddresses()
          log.debug('✅ Successfully fetched local addresses:', localAddresses)
          setAddresses(localAddresses)
        } else {
          // Unsupported network
          const errorMsg = `Unsupported network (Chain ID: ${chainId}). Please connect to Mainnet, Sepolia, or Local Anvil.`
          log.error('❌', errorMsg)
          setError(errorMsg)
          setAddresses(null)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load contract addresses'
        log.error('❌ Error loading contract addresses:', errorMsg)
        setError(errorMsg)
        setAddresses(null)
      } finally {
        setLoading(false)
      }
    }

    loadAddresses()
  }, [chainId])

  const nftPrimary: NFTPrimaryView | null = useMemo(() => {
    if (!addresses) return null
    return {
      NFTMinter: addresses.nftsV2.NFTMinter,
      BalancerPooler: addresses.nftsV2.BalancerPooler,
      BurnerEYE: addresses.nftsV2.BurnerEYE,
      BurnerSCX: addresses.nftsV2.BurnerSCX,
      BurnerFlax: addresses.nftsV2.BurnerFlax,
      GatherWBTC: addresses.nftsV2.GatherWBTC,
      MintPageView: addresses.MintPageView,
      nftMinter_old: addresses.nftsV1,
    }
  }, [addresses])

  return (
    <ContractAddressContext.Provider value={{ addresses, nftPrimary, loading, error, networkType }}>
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
 *   const { addresses, nftPrimary, loading, error, networkType } = useContractAddresses()
 *
 *   if (loading) return <div>Loading addresses...</div>
 *   if (error) return <div>Error: {error}</div>
 *   if (!addresses) return <div>No addresses available</div>
 *
 *   return <div>DOLA Token: {addresses.Dola}</div>
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
