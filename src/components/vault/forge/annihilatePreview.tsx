import type { ReactNode } from 'react';

/** Presentational pieces of the Annihilate row's preview panel. */

export function PreviewCell({
  label,
  labelColor,
  value,
  emphasised = false,
}: {
  label: string;
  labelColor: string;
  value: string;
  emphasised?: boolean;
}) {
  return (
    <div
      data-testid={`preview-cell-${label}`}
      className="min-w-0 rounded-xl border p-3"
      style={
        emphasised
          ? { borderColor: 'rgba(255,140,66,.35)', background: 'rgba(255,140,66,.08)' }
          : { borderColor: 'rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)' }
      }
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: labelColor }}>
        {label}
      </div>
      <div className="truncate font-mono text-[19px] font-semibold tabular-nums tracking-[-0.02em] text-pxusd-white">
        {value}
      </div>
    </div>
  );
}

export function Glyph({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="text-center font-mono text-lg text-muted-foreground">
      {children}
    </span>
  );
}

export function PreviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono tabular-nums text-pxusd-white">{children}</span>
    </div>
  );
}
