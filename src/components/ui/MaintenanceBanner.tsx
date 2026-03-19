import { MAINTENANCE_MODE } from '../../config/maintenance'

/**
 * MaintenanceBanner Component
 *
 * Displays a full-screen, non-dismissible overlay when MAINTENANCE_MODE is enabled.
 * Blocks all interaction with the rest of the site.
 *
 * Features:
 * - Fixed overlay with backdrop blur (z-[200], above all other modals)
 * - Centered maintenance message card
 * - Fully responsive across mobile, tablet, and desktop
 * - No close button, no click-away, no escape key dismiss
 */
export default function MaintenanceBanner() {
  if (!MAINTENANCE_MODE) {
    return null
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="bg-background border border-border rounded-xl max-w-lg w-full p-6 sm:p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="flex justify-center mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 sm:h-16 sm:w-16 text-pxusd-orange-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.42 15.17l-1.42-.88a1.14 1.14 0 01-.38-1.57l.32-.53a1.14 1.14 0 011.57-.38l.88.54M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-5.07l-1.41 1.41M8.34 15.66l-1.41 1.41m0-10.14l1.41 1.41m7.32 7.32l1.41 1.41"
              />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            Down for Routine Maintenance
          </h2>
          <div className="mt-2 w-16 h-1 bg-pxusd-orange-400 mx-auto rounded-full" />
        </div>

        {/* Message */}
        <div className="mb-6">
          <div className="bg-pxusd-teal-900/50 border border-border rounded-lg p-4 sm:p-5">
            <p className="text-foreground text-sm sm:text-base leading-relaxed text-center">
              The site is currently unavailable as we prepare for the integration of new contracts. 
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Thank you for your patience.
        </p>
      </div>
    </div>
  )
}

export { MaintenanceBanner }
