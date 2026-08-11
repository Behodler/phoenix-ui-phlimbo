import { createConfig, http, fallback } from 'wagmi'
import { mainnet, arbitrum, sepolia } from 'wagmi/chains'
import { defineChain } from 'viem'
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
      // Free public endpoints, tried in order. All verified to send
      // Access-Control-Allow-Origin for https://phusd.behodler.io — an endpoint
      // without it surfaces every outage as an opaque CORS error in the console.
      // retryCount is lowered from viem's default of 3 because `fallback` only
      // advances to the next transport once the current one exhausts its
      // retries — at the default, a full public-endpoint outage would burn ~16
      // backed-off attempts before reaching the paid fallback below.
      http('https://eth.drpc.org', { retryCount: 1 }),
      http('https://mainnet.gateway.tenderly.co', { retryCount: 1 }),
      http('https://cloudflare-eth.com', { retryCount: 1 }),
      http('https://rpc.ankr.com/eth', { retryCount: 1 }),
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
