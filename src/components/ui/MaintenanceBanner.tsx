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
      <div className="bg-background border border-border rounded-xl max-w-xl w-full p-6 sm:p-10 shadow-2xl">
        {/* Construction Image */}
        <div className="mb-6 flex justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 160"
            className="w-40 h-32 sm:w-56 sm:h-44"
            aria-hidden="true"
          >
            {/* Ground */}
            <rect x="0" y="140" width="200" height="6" fill="currentColor" className="text-pxusd-teal-900/70" />

            {/* Left traffic cone */}
            <polygon points="30,140 42,100 54,140" fill="#f59e0b" />
            <rect x="33" y="120" width="18" height="4" fill="#fff" />
            <rect x="35" y="128" width="14" height="4" fill="#fff" />
            <ellipse cx="42" cy="142" rx="16" ry="3" fill="#1f2937" />

            {/* Right traffic cone */}
            <polygon points="146,140 158,100 170,140" fill="#f59e0b" />
            <rect x="149" y="120" width="18" height="4" fill="#fff" />
            <rect x="151" y="128" width="14" height="4" fill="#fff" />
            <ellipse cx="158" cy="142" rx="16" ry="3" fill="#1f2937" />

            {/* Hard hat */}
            <path
              d="M70 90 Q70 50 100 50 Q130 50 130 90 Z"
              fill="#fbbf24"
            />
            <rect x="62" y="88" width="76" height="8" rx="2" fill="#f59e0b" />
            <rect x="96" y="55" width="8" height="35" fill="#f59e0b" />

            {/* Wrench crossing hammer */}
            <g transform="rotate(-25 100 115)">
              <rect x="60" y="112" width="50" height="6" rx="2" fill="#9ca3af" />
              <circle cx="58" cy="115" r="7" fill="#9ca3af" />
              <circle cx="58" cy="115" r="3" fill="#1f2937" />
            </g>
            <g transform="rotate(25 100 115)">
              <rect x="95" y="112" width="40" height="6" rx="2" fill="#92400e" />
              <rect x="130" y="106" width="14" height="18" rx="2" fill="#9ca3af" />
            </g>
          </svg>
        </div>

        {/* Header */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            Site Currently Paused for Maintenance
          </h2>
          <div className="mt-3 w-20 h-1 bg-pxusd-orange-400 mx-auto rounded-full" />
        </div>

        {/* Message */}
        <div className="mb-6">
          <div className="bg-pxusd-teal-900/50 border border-border rounded-lg p-5 sm:p-6">
            <p className="text-foreground text-sm sm:text-base leading-relaxed text-center">
              We sincerely apologize for the inconvenience. The site is temporarily offline while we make some improvements behind the scenes. Please check back again shortly.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs sm:text-sm text-muted-foreground">
          Thank you for your patience and understanding.
        </p>
      </div>
    </div>
  )
}

export { MaintenanceBanner }
