import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from './wagmiConfig'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { ContractAddressProvider } from './contexts/ContractAddressContext'
import { PollingProvider } from './contexts/PollingContext'
import { WalletBalancesProvider } from './contexts/WalletBalancesContext'
import App from './App'

const qc = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider theme={darkTheme()}>
          <ContractAddressProvider>
            <WalletBalancesProvider>
              <PollingProvider>
                <App />
              </PollingProvider>
            </WalletBalancesProvider>
          </ContractAddressProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
