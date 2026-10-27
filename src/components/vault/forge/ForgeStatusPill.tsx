import type { CSSProperties, ReactNode } from 'react';

export type ForgeStatusTone = 'good' | 'bad' | 'antimatter' | 'fire';

// Tints are literal rgba: Tailwind opacity modifiers on the bare-var `pxusd-*`
// tokens emit no CSS (see repo CLAUDE.md, "Things that are easy to get wrong").
const TONE_STYLES: Record<ForgeStatusTone, CSSProperties> = {
  good: { color: '#4ade80', borderColor: 'rgba(74,222,128,.35)', background: 'rgba(74,222,128,.07)' },
  bad: { color: '#FF4D6D', borderColor: 'rgba(255,77,109,.35)', background: 'rgba(255,77,109,.07)' },
  antimatter: { color: '#C4AEEA', borderColor: 'rgba(196,174,234,.35)', background: 'rgba(196,174,234,.08)' },
  fire: { color: '#FFD93D', borderColor: 'rgba(255,217,61,.3)', background: 'rgba(255,217,61,.06)' },
};

export interface ForgeStatusPillProps {
  tone: ForgeStatusTone;
  children: ReactNode;
}

export default function ForgeStatusPill({ tone, children }: ForgeStatusPillProps) {
  return (
    <span
      data-tone={tone}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-bold uppercase tracking-[0.06em]"
      style={TONE_STYLES[tone]}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current"
        style={{ boxShadow: '0 0 8px currentColor' }}
      />
      {children}
    </span>
  );
}
