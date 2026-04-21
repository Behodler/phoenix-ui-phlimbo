import type { ReactNode } from 'react';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Optional small numeric badge shown next to the label (e.g. staked unit count) */
  badge?: number;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Generic labeled toggle (2-or-n options) styled with tailwind + pxusd-* tokens.
 *
 * Mirrors the `.sub-toggle` pattern from the design mock using tailwind
 * utilities — no custom CSS, no hex literals.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={[
        'inline-flex gap-0.5 rounded-[10px] border border-border bg-white/[0.04] p-1',
        className ?? '',
      ].join(' ')}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={[
              'flex items-center gap-1.5 rounded-[7px] px-3.5 py-1.5 font-sans text-[13px] font-semibold transition-colors duration-150',
              isActive
                ? 'bg-pxusd-teal-700 text-pxusd-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                : 'bg-transparent text-muted-foreground hover:text-pxusd-white',
            ].join(' ')}
          >
            <span>{opt.label}</span>
            {typeof opt.badge === 'number' && opt.badge > 0 && (
              <span className="ml-0.5 rounded px-1.5 py-px font-mono text-[10px] font-bold tabular-nums bg-pxusd-orange-400/20 text-pxusd-orange-300">
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
