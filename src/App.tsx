import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/ui/ToastProvider'
import { DisclaimerModal } from './components/ui/DisclaimerModal'
import { MaintenanceBanner } from './components/ui/MaintenanceBanner'
import { NFTUpgradeModal } from './components/modals/NFTUpgradeModal'
import VaultPage from './pages/VaultPage'

export default function App() {
  // Force dark mode always
  useEffect(() => {
    document.documentElement.classList.add('dark')
    document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  return (
    <BrowserRouter>
      <ToastProvider>
        <MaintenanceBanner />
        <DisclaimerModal />
        <NFTUpgradeModal />
        <Routes>
          <Route path="/" element={<VaultPage />} />
          <Route path="/stake" element={<VaultPage />} />
          <Route path="/staking" element={<VaultPage />} />
          <Route path="/nft" element={<VaultPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
