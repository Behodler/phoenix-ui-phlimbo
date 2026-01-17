import { useEffect } from 'react'
import { ToastProvider } from './components/ui/ToastProvider'
import { DisclaimerModal } from './components/ui/DisclaimerModal'
import VaultPage from './pages/VaultPage'

export default function App() {
  // Force dark mode always
  useEffect(() => {
    document.documentElement.classList.add('dark')
    document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  return (
    <ToastProvider>
      <DisclaimerModal />
      <VaultPage />
    </ToastProvider>
  )
}
