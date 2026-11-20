import { describe, it, expect, vi, afterEach } from 'vitest'
import { mainnet, sepolia, arbitrum } from 'wagmi/chains'

/**
 * Story 101: before a wallet connects, wagmi reports `chains[0]` as the chain
 * id, and ContractAddressContext chooses its address source from it. Production
 * must default to mainnet (hardcoded addresses) rather than Anvil (which
 * fetches http://localhost:3001/contracts); dev keeps Anvil first.
 */
afterEach(() => {
  // wagmi persists its store (including chainId) to localStorage; clear it so
  // one config's state cannot rehydrate into the next.
  localStorage.clear()
  vi.unstubAllEnvs()
  vi.resetModules()
})

// RainbowKit's WalletConnect connector refuses to build without a projectId.
function stubProjectId() {
  vi.stubEnv('VITE_WALLETCONNECT_PROJECT_ID', 'test-project-id')
}

async function loadConfig(isDev: boolean) {
  vi.resetModules()
  stubProjectId()
  vi.stubEnv('DEV', isDev)
  vi.stubEnv('PROD', !isDev)
  return import('../wagmiConfig')
}

const ALL_IDS = [1, 11155111, 42161, 31337].sort()

describe('wagmiConfig chain order', () => {
  it('chainsForMode: dev is anvil-first, production is mainnet-first, same chain set', async () => {
    stubProjectId()
    const { chainsForMode, anvil } = await import('../wagmiConfig')
    expect(chainsForMode(true).map((c) => c.id)).toEqual([anvil.id, sepolia.id, arbitrum.id, mainnet.id])
    expect(chainsForMode(false).map((c) => c.id)).toEqual([mainnet.id, sepolia.id, arbitrum.id, anvil.id])
    expect(chainsForMode(false).map((c) => c.id).sort()).toEqual(ALL_IDS)
  })

  it('production build: default (disconnected) chain is mainnet and every chain has a transport', async () => {
    const { wagmiConfig } = await loadConfig(false)
    expect(wagmiConfig.chains[0].id).toBe(mainnet.id)
    // Disconnected visitors see the first chain via useChainId().
    expect(wagmiConfig.state.chainId).toBe(mainnet.id)
    for (const chain of wagmiConfig.chains) {
      expect(wagmiConfig._internal.transports[chain.id]).toBeTypeOf('function')
    }
  })

  it('dev build: default chain stays anvil (31337) for the local workflow', async () => {
    const { wagmiConfig } = await loadConfig(true)
    expect(wagmiConfig.chains[0].id).toBe(31337)
    expect(wagmiConfig.state.chainId).toBe(31337)
    for (const chain of wagmiConfig.chains) {
      expect(wagmiConfig._internal.transports[chain.id]).toBeTypeOf('function')
    }
  })
})
