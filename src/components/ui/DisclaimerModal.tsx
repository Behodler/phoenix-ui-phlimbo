import { useState, useEffect } from 'react'
import { log } from '../../utils/logger'

/**
 * Local storage key for disclaimer acknowledgement
 */
const DISCLAIMER_ACKNOWLEDGED_KEY = 'phlimbo-disclaimer-acknowledged'

/**
 * The legal disclaimer text (exact text as required)
 */
const DISCLAIMER_TEXT = `This application is experimental software. The token and related smart contracts are provided "as is" without guarantees of value, yield, or stability. Participation in optional yield programs is voluntary and may involve risk of loss. Nothing on this site constitutes financial, investment, legal, or tax advice. Users are solely responsible for understanding and complying with the laws and regulations of their respective jurisdictions before interacting with these contracts.`

/**
 * Check if disclaimer has been acknowledged
 * @returns true if user has previously acknowledged the disclaimer
 */
function hasAcknowledgedDisclaimer(): boolean {
  try {
    const stored = localStorage.getItem(DISCLAIMER_ACKNOWLEDGED_KEY)
    return stored === 'true'
  } catch (error) {
    // localStorage not available (e.g., private browsing)
    log.warn('Unable to access localStorage for disclaimer check:', error)
    return false
  }
}

/**
 * Save disclaimer acknowledgement to localStorage
 */
function saveDisclaimerAcknowledgement(): void {
  try {
    localStorage.setItem(DISCLAIMER_ACKNOWLEDGED_KEY, 'true')
    log.debug('Disclaimer acknowledgement saved')
  } catch (error) {
    log.warn('Unable to save disclaimer acknowledgement to localStorage:', error)
  }
}

/**
 * DisclaimerModal Component
 *
 * Displays a legal disclaimer modal that appears on first visit.
 * Once acknowledged, the modal will not appear again for that user
 * (persisted via localStorage).
 *
 * Features:
 * - Semi-transparent backdrop overlay
 * - Centered modal with professional styling
 * - Blocks interaction with rest of application until acknowledged
 * - Mobile-responsive design
 * - Small delay before showing to prevent flash on cached acknowledgements
 */
export default function DisclaimerModal() {
  // State to control modal visibility
  // Start with null to indicate "checking" state (prevents flash)
  const [isVisible, setIsVisible] = useState<boolean | null>(null)

  // Check localStorage on mount with slight delay
  useEffect(() => {
    // Small delay to prevent flash for users who have already acknowledged
    const timer = setTimeout(() => {
      const acknowledged = hasAcknowledgedDisclaimer()
      setIsVisible(!acknowledged)

      if (acknowledged) {
        log.debug('Disclaimer already acknowledged, not showing modal')
      } else {
        log.debug('First visit detected, showing disclaimer modal')
      }
    }, 50)

    return () => clearTimeout(timer)
  }, [])

  /**
   * Handle user acknowledgement
   */
  const handleAcknowledge = () => {
    saveDisclaimerAcknowledgement()
    setIsVisible(false)
    log.info('User acknowledged disclaimer')
  }

  // Don't render anything while checking or if already acknowledged
  if (isVisible !== true) {
    return null
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="bg-background border border-border rounded-xl max-w-lg w-full p-6 sm:p-8 shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="mb-6 text-center">
          <h2
            id="disclaimer-title"
            className="text-xl sm:text-2xl font-bold text-foreground"
          >
            Legal Disclaimer
          </h2>
          <div className="mt-2 w-16 h-1 bg-primary mx-auto rounded-full" />
        </div>

        {/* Disclaimer Content */}
        <div className="mb-8">
          <div className="bg-pxusd-teal-900/50 border border-border rounded-lg p-4 sm:p-5">
            <p className="text-foreground text-sm sm:text-base leading-relaxed">
              {DISCLAIMER_TEXT}
            </p>
          </div>
        </div>

        {/* Acknowledgement Button */}
        <div className="flex justify-center">
          <button
            onClick={handleAcknowledge}
            className="phoenix-btn-primary w-full sm:w-auto min-w-[200px] text-base font-semibold py-3 px-8"
            autoFocus
          >
            I Understand
          </button>
        </div>

        {/* Footer Note */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By clicking "I Understand", you acknowledge that you have read and understood this disclaimer.
        </p>
      </div>
    </div>
  )
}

export { DisclaimerModal }
