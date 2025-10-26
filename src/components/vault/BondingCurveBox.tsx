import type { BondingCurveBoxProps } from '../../types/vault';
import FAQWrapper from './FAQWrapper';

export default function BondingCurveBox({
  startPrice,
  endPrice,
  currentPrice,
  isLoading = false,
  isError = false,
  onTriggerFAQ
}: BondingCurveBoxProps) {
  // Calculate the progress percentage (0-100) based on current price position
  const progress = Math.max(0, Math.min(100, ((currentPrice - startPrice) / (endPrice - startPrice)) * 100));

  // SVG dimensions and styling
  const svgWidth = 280;
  const svgHeight = 120;
  const margin = { top: 20, right: 20, bottom: 30, left: 20 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  // Calculate line points for the bonding curve (linear progression)
  const startX = margin.left;
  const endX = margin.left + chartWidth;
  const startY = margin.top + chartHeight;
  const endY = margin.top;

  // Current price position on the line
  const currentX = startX + (progress / 100) * chartWidth;
  const currentY = startY - (progress / 100) * chartHeight;

  return (
    <div className="phoenix-card p-6">
      <div className="space-y-6">
        {/* Title and Subtitle */}
        <div className="space-y-2">
          {onTriggerFAQ ? (
            <FAQWrapper componentType="IgnitionPhase" onTriggerFAQ={onTriggerFAQ}>
              <h2 className="text-lg sm:text-xl font-bold text-card-foreground">
                Ignition Phase
              </h2>
            </FAQWrapper>
          ) : (
            <h2 className="text-lg sm:text-xl font-bold text-card-foreground">
              Ignition Phase
            </h2>
          )}
          <p className="text-xs sm:text-sm text-muted-foreground">
            Bonding Curve state
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading bonding curve data...</div>
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-red-400">Failed to load bonding curve data. Please try again.</div>
          </div>
        )}

        {/* Main Content - only show when not loading and no error */}
        {!isLoading && !isError && (
          <>

            {/* Bonding Curve Visualization */}
            <div className="relative overflow-hidden">
              <svg
                width={svgWidth}
                height={svgHeight}
                className="w-full h-auto min-h-[120px]"
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Background grid lines */}
                <defs>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path
                      d="M 20 0 L 0 0 0 20"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" opacity="0.3" />

                {/* Bonding curve line */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="var(--pxusd-orange-500)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Progress line (completed portion) */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={currentX}
                  y2={currentY}
                  stroke="var(--pxusd-pink-400)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Current price marker with pulsing animation */}
                <g>
                  <circle
                    cx={currentX}
                    cy={currentY}
                    r="6"
                    fill="var(--pxusd-pink-400)"
                    className="animate-pulse"
                  />
                  <circle
                    cx={currentX}
                    cy={currentY}
                    r="3"
                    fill="var(--pxusd-white)"
                  />
                </g>

                {/* Price labels */}
                <text
                  x={startX}
                  y={startY + 20}
                  textAnchor="start"
                  className="text-xs fill-muted-foreground"
                >
                  ${startPrice.toFixed(2)}
                </text>
                <text
                  x={endX}
                  y={endY - 10}
                  textAnchor="end"
                  className="text-xs fill-muted-foreground"
                >
                  ${endPrice.toFixed(2)}
                </text>

                {/* Current price label */}
                <text
                  x={currentX}
                  y={currentY - 15}
                  textAnchor="middle"
                  className="text-xs font-semibold fill-card-foreground"
                >
                  ${currentPrice.toFixed(2)}
                </text>
              </svg>
            </div>

            {/* Progress indicator */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
                <span>Progress</span>
                <span>{progress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${progress}%`,
                    background: 'var(--grad-accent)'
                  }}
                />
              </div>
            </div>

            {/* Additional info */}
            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm pt-4 border-t border-border">
              <div className="text-muted-foreground">Current Phase</div>
              <div className="text-right">
                <div className="font-semibold text-card-foreground">
                  {progress < 25 ? 'Early' : progress < 75 ? 'Active' : 'Late'} Ignition
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}