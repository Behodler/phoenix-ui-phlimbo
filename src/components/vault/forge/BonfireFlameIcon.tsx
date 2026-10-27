import { useId } from 'react';

/**
 * NFT Bonfire row icon: a gradient flame on a warm tinted disc. The gradient
 * id comes from useId (colons stripped so `url(#…)` resolves) so several
 * icons on one page never collide.
 */
export default function BonfireFlameIcon() {
  const gradientId = `bonfire-flame-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <span
      aria-hidden="true"
      data-testid="bonfire-flame-icon"
      className="flex h-9 w-9 items-center justify-center rounded-full border"
      style={{
        background: 'radial-gradient(circle at 50% 70%, rgba(255,140,66,.35), rgba(255,77,109,.12) 70%)',
        borderColor: 'rgba(255,140,66,.35)',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#FF4D6D" />
            <stop offset="55%" stopColor="#FF8C42" />
            <stop offset="100%" stopColor="#FFD93D" />
          </linearGradient>
        </defs>
        <path
          fill={`url(#${gradientId})`}
          d="M12 2c.6 3.3-1.2 5.1-2.9 6.9C7.4 10.7 6 12.7 6 15.3 6 18.9 8.7 22 12 22s6-3.1 6-6.7c0-2.5-1.1-4.3-2.4-5.8-.3 1.6-1.1 2.7-2.3 3.2.5-4-.4-7.6-1.3-10.7z"
        />
      </svg>
    </span>
  );
}
