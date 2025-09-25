import { MockBlockchainProvider } from './hooks'
import VaultPage from './pages/VaultPage'

export default function App() {
  return (
    <MockBlockchainProvider>
      <VaultPage />
    </MockBlockchainProvider>
  )
}
