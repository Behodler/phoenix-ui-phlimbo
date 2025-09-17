import { createConfig, http } from 'wagmi'
import { mainnet, arbitrum, sepolia } from 'wagmi/chains'
import { defineChain } from 'viem'

export const anvil = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
})

export const wagmiConfig = createConfig({
  chains: [anvil, sepolia, arbitrum, mainnet],
  transports: {
    [anvil.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [mainnet.id]: http(),
  },
  ssr: false,
})
