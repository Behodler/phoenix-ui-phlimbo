import { createConfig, http, fallback, unstable_connector } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { mainnet, arbitrum, sepolia } from 'wagmi/chains'
import { defineChain, ProviderDisconnectedError, type Transport } from 'viem'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  walletConnectWallet,
  injectedWallet,
} from '@rainbow-me/rainbowkit/wallets'

export const anvil = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
})

/**
 * Methods the wallet's own RPC must NOT answer. Some injected wallets (MetaMask
 * with Smart Transactions, Rabby) hand back a non-null "receipt" for a
 * transaction that is only submitted, not mined. viem's
 * waitForTransactionReceipt resolves on the first non-null receipt when
 * confirmations is 1, so every useWaitForTransactionReceipt in the app would
 * fire its success toast the instant the wallet returned the hash. Throwing a
 * ProviderDisconnectedError here is not in viem's fallback `shouldThrow` set,
 * so `fallback` silently moves these calls on to the public endpoints, which
 * only return a receipt once the transaction is in a block.
 */
const WALLET_UNTRUSTED_METHODS = new Set([
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
])

function withoutReceiptMethods(transport: Transport): Transport {
  return (params) => {
    const inner = transport(params)
    const request: typeof inner.request = async (args, options) => {
      if (WALLET_UNTRUSTED_METHODS.has(args.method)) {
        throw new ProviderDisconnectedError(
          new Error(`${args.method} is routed past the wallet RPC`),
        )
      }
      return inner.request(args, options)
    }
    return { ...inner, request }
  }
}

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

const mainnetFallbackRpcUrl: string | undefined =
  import.meta.env.VITE_MAINNET_FALLBACK_RPC_URL

/**
 * RainbowKit wallet configuration with explicit MetaMask support.
 *
 * Architecture Decision (Story 080):
 * - Using connectorsForWallets() for explicit MetaMask mobile/desktop support
 * - MetaMask prioritized in "Recommended" group for optimal UX
 * - WalletConnect fallback maintains compatibility with other wallets
 * - Injected wallet provides fallback for other browser extensions
 *
 * This configuration enhances mobile MetaMask connectivity through
 * RainbowKit's optimized deep-linking and wallet detection.
 */
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, walletConnectWallet],
    },
    {
      groupName: 'Other',
      wallets: [injectedWallet],
    },
  ],
  {
    appName: 'Phoenix UI',
    projectId,
  }
)

export const wagmiConfig = createConfig({
  chains: [anvil, sepolia, arbitrum, mainnet],
  connectors,
  transports: {
    [anvil.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [mainnet.id]: fallback([
      // The connected injected wallet's own RPC (Rabby, MetaMask extension).
      // Throws when no injected wallet is connected or it sits on another
      // chain, so `fallback` moves on to the public endpoints below — which
      // still carry every visitor who has not connected.
      // Receipt and transaction-by-hash lookups skip it: see
      // WALLET_UNTRUSTED_METHODS above.
      withoutReceiptMethods(unstable_connector(injected)),
      // Free public endpoints, tried in order. All verified to send
      // Access-Control-Allow-Origin for https://phoenixdefi.app — an endpoint
      // without it surfaces every outage as an opaque CORS error in the console.
      // retryCount is lowered from viem's default of 3 because `fallback` only
      // advances to the next transport once the current one exhausts its
      // retries — at the default, a full public-endpoint outage would burn ~16
      // backed-off attempts before reaching the paid fallback below.
      http('https://eth.drpc.org', { retryCount: 1 }),
      http('https://mainnet.gateway.tenderly.co', { retryCount: 1 }),
      // Paid last resort (VITE_MAINNET_FALLBACK_RPC_URL). Deliberately last so
      // normal traffic never reaches it; it only carries load when every public
      // endpoint above is down. Note this URL is inlined into the client bundle
      // and is therefore public — rely on the provider's domain allowlist, not
      // on secrecy, to keep it from being used elsewhere.
      ...(mainnetFallbackRpcUrl ? [http(mainnetFallbackRpcUrl)] : []),
    ]),
  },
  ssr: false,
})
