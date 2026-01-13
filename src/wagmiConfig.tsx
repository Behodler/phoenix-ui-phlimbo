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
      http('https://ethereum-rpc.publicnode.com'),
      http('https://eth.llamarpc.com'),
    ]),
  },
  ssr: false,
})
