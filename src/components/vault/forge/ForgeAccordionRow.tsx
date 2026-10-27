import type { ReactNode } from 'react';

export interface ForgeAccordionRowProps {
  icon: ReactNode;
  title: string;
  tagline: string;
  /** Headline value shown in the desktop metric column and the mobile line. */
  metric: ReactNode;
  metricLabel: string;
  /** Status pill — shown on the mobile line only (desktop shows the metric). */
  pill: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * Generic, hook-free shell for one Forge tool. ForgeTab owns the open/closed
 * state; this component only renders it. The body is mounted only while the
 * row is expanded.
 */
export default function ForgeAccordionRow({
  icon,
  title,
  tagline,
  metric,
  metricLabel,
  pill,
  expanded,
  onToggle,
  children,
}: ForgeAccordionRowProps) {
  return (
    <div
      className="rounded-2xl border bg-white/[0.02] transition-colors motion-reduce:transition-none"
      // Tinted borders must be literal rgba — opacity modifiers on the
      // bare-var theme tokens emit no CSS.
      style={{ borderColor: expanded ? 'rgba(255,140,66,.45)' : 'rgba(255,255,255,.12)' }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={title}
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3.5 gap-y-3 px-4 py-3.5 text-left sm:grid-cols-[auto_1.3fr_1fr_auto] sm:px-[18px] sm:py-4"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
          {icon}
        </span>

        {/* min-w-0 lets the cell shrink instead of forcing the grid wider than
            a 390px viewport. */}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[16px] font-bold text-pxusd-white">{title}</span>
          <span className="text-[11.5px] text-muted-foreground">{tagline}</span>
        </span>

        <span className="hidden text-right sm:block">
          <span className="block font-mono text-[17px] font-bold tabular-nums">{metric}</span>
          <span className="block text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {metricLabel}
          </span>
        </span>

        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`h-5 w-5 text-muted-foreground transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M5 7.5l5 5 5-5" />
        </svg>

        {/* Mobile line: pill + headline metric under the title, below sm only. */}
        <span
          data-testid="forge-row-mobile-line"
          className="col-span-2 col-start-2 flex min-w-0 flex-wrap items-center gap-2 sm:hidden"
        >
          {pill}
          <span className="font-mono text-[13px] tabular-nums">{metric}</span>
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-border px-[18px] pb-[18px] pt-4">{children}</div>
      )}
    </div>
  );
}
