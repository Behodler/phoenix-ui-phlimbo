import { createConfig, http } from 'wagmi'
import { mainnet, arbitrum, sepolia } from 'wagmi/chains'
import { defineChain } from 'viem'
import { walletConnect, injected } from 'wagmi/connectors'

export const anvil = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
})

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

export const wagmiConfig = createConfig({
  chains: [anvil, sepolia, arbitrum, mainnet],
  connectors: [
    injected(),
    walletConnect({
      projectId,
      metadata: {
        name: 'Phoenix UI',
        description: 'Decentralized vault interface',
        url: 'https://phoenix.behodler.io',
        icons: ['https://phoenix.behodler.io/icon.png']
      },
      showQrModal: true,
    }),
  ],
  transports: {
    [anvil.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [mainnet.id]: http(),
  },
  ssr: false,
})
