export interface UnitSliderProps {
  value: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  /**
   * Optional lower bound for the slider. Defaults to `0` so existing
   * 0..max usage (StakedNftCard) is unaffected.
   */
  min?: number;
}

/**
 * min..max unit selector (slider variant from the mock).
 *
 * The visible track + thumb is a pure-CSS overlay; the real <input type="range">
 * is absolutely positioned on top with opacity:0 so it handles pointer/keyboard
 * interaction without visual duplication.
 */
export default function UnitSlider({ value, max, onChange, disabled = false, min = 0 }: UnitSliderProps) {
  const safeMin = min;
  const safeMax = Math.max(safeMin, max);
  const clamped = Math.min(Math.max(safeMin, value), safeMax);
  const range = safeMax - safeMin;
  const pct = range > 0 ? ((clamped - safeMin) / range) * 100 : 0;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono tabular-nums text-[28px] font-bold text-pxusd-white">{clamped}</span>
        <span className="text-xs text-muted-foreground">of {safeMax} units</span>
      </div>

      <div className="relative flex h-7 items-center">
        {/* Background track */}
        <div className="absolute inset-x-0 h-1 rounded-full bg-white/[0.08]" />
        {/* Active fill */}
        <div
          className="absolute left-0 h-1 rounded-full"
          style={{ width: `${pct}%`, background: 'var(--grad-accent)' }}
        />
        {/* Invisible range input for a11y / pointer */}
        <input
          type="range"
          min={safeMin}
          max={safeMax}
          value={clamped}
          disabled={disabled || range <= 0}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="absolute inset-x-0 m-0 h-7 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          aria-label="Units"
        />
        {/* Thumb */}
        <div
          className="pointer-events-none absolute h-5 w-5 rounded-full border-[3px] border-pxusd-orange-400 bg-pxusd-white"
          style={{
            left: `calc(${pct}% - 10px)`,
            boxShadow: '0 4px 12px rgba(0,0,0,.3)',
          }}
        />
      </div>

      <div className="flex justify-between">
        <span className="text-xs text-muted-foreground">{safeMin}</span>
        <span className="text-xs text-muted-foreground">{safeMax}</span>
      </div>
    </div>
  );
}
