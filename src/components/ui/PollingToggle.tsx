import { useState } from 'react'
import { usePolling } from '../../contexts/PollingContext'

/**
 * PollingToggle Component
 *
 * A toggle switch for enabling/disabling real-time RPC polling.
 * Users with custom RPCs or slow connections can disable real-time stats updates.
 * Includes a tooltip explaining the feature.
 */
export default function PollingToggle() {
  const { isPollingEnabled, togglePolling } = usePolling()
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative flex items-center gap-2">
      {/* Toggle switch */}
      <button
        onClick={togglePolling}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full
          transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-phoenix-primary focus:ring-offset-2 focus:ring-offset-background
          ${isPollingEnabled ? 'bg-phoenix-primary' : 'bg-gray-600'}
        `}
        role="switch"
        aria-checked={isPollingEnabled}
        aria-label="Toggle real-time polling"
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white shadow-md
            transition-transform duration-200 ease-in-out
            ${isPollingEnabled ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>

      {/* Status indicator */}
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {isPollingEnabled ? 'Live' : 'Paused'}
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute top-full right-0 mt-2 w-64 p-3 bg-card border border-border rounded-lg shadow-lg z-50"
          role="tooltip"
        >
          <p className="text-sm text-foreground font-medium mb-1">
            Real-time Updates
          </p>
          <p className="text-xs text-muted-foreground">
            {isPollingEnabled
              ? 'Stats are updated every 60 seconds. Click to disable if you have a slow connection or custom RPC.'
              : 'Real-time updates are disabled. Click to enable automatic stat refreshing.'}
          </p>
        </div>
      )}
    </div>
  )
}
