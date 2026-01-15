import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { log } from '../utils/logger'

/**
 * Local storage key for polling preference
 */
const POLLING_ENABLED_KEY = 'phoenix-polling-enabled'

/**
 * Polling Context State
 */
interface PollingContextState {
  /** Whether real-time polling is enabled globally */
  isPollingEnabled: boolean
  /** Toggle the polling state */
  togglePolling: () => void
  /** Set polling state explicitly */
  setPollingEnabled: (enabled: boolean) => void
}

/**
 * Polling Context
 */
const PollingContext = createContext<PollingContextState | undefined>(undefined)

/**
 * Polling Provider Props
 */
interface PollingProviderProps {
  children: ReactNode
}

/**
 * Get initial polling state from localStorage
 * Defaults to true (enabled) if no preference is stored
 */
function getInitialPollingState(): boolean {
  try {
    const stored = localStorage.getItem(POLLING_ENABLED_KEY)
    if (stored === null) {
      // First visit - default to enabled
      return true
    }
    return stored === 'true'
  } catch (error) {
    // localStorage not available (e.g., private browsing)
    log.warn('Unable to access localStorage for polling preference:', error)
    return true
  }
}

/**
 * Save polling state to localStorage
 */
function savePollingState(enabled: boolean): void {
  try {
    localStorage.setItem(POLLING_ENABLED_KEY, String(enabled))
  } catch (error) {
    log.warn('Unable to save polling preference to localStorage:', error)
  }
}

/**
 * Polling Provider Component
 *
 * Provides global polling state management with localStorage persistence.
 * Users with slow connections or custom RPCs can disable real-time stats updates.
 *
 * @example
 * ```tsx
 * <PollingProvider>
 *   <App />
 * </PollingProvider>
 * ```
 */
export function PollingProvider({ children }: PollingProviderProps) {
  const [isPollingEnabled, setIsPollingEnabledState] = useState<boolean>(getInitialPollingState)

  // Save to localStorage whenever state changes
  useEffect(() => {
    savePollingState(isPollingEnabled)
    log.debug('Polling state updated:', isPollingEnabled ? 'enabled' : 'disabled')
  }, [isPollingEnabled])

  const togglePolling = useCallback(() => {
    setIsPollingEnabledState(prev => !prev)
  }, [])

  const setPollingEnabled = useCallback((enabled: boolean) => {
    setIsPollingEnabledState(enabled)
  }, [])

  return (
    <PollingContext.Provider value={{ isPollingEnabled, togglePolling, setPollingEnabled }}>
      {children}
    </PollingContext.Provider>
  )
}

/**
 * Custom hook to access polling context
 *
 * @returns Polling context state with toggle function
 * @throws Error if used outside of PollingProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isPollingEnabled, togglePolling } = usePolling()
 *
 *   return (
 *     <button onClick={togglePolling}>
 *       {isPollingEnabled ? 'Disable' : 'Enable'} Polling
 *     </button>
 *   )
 * }
 * ```
 */
export function usePolling(): PollingContextState {
  const context = useContext(PollingContext)

  if (context === undefined) {
    throw new Error('usePolling must be used within a PollingProvider')
  }

  return context
}
