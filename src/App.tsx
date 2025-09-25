import { MockBlockchainProvider } from './hooks'
import { ToastProvider } from './components/ui/ToastProvider'
import VaultPage from './pages/VaultPage'

export default function App() {
  return (
    <MockBlockchainProvider>
      <ToastProvider>
        <VaultPage />
      </ToastProvider>
    </MockBlockchainProvider>
  )
}
