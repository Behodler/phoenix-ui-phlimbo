export interface ApyPillProps {
  apy: number;
  className?: string;
}

const TOOLTIP =
  'Minimum APY. Earlier minters paid less per NFT so they earn a higher effective APY than this number shows; this figure assumes every staked NFT was bought at the most recent (highest) mint price.';

/**
 * Pill showing `{apy}% min APY` with a tooltip (native title) explaining
 * why the number is a minimum (NFT mint price grows on every mint, so early
 * minters have a higher effective APY).
 */
export default function ApyPill({ apy, className }: ApyPillProps) {
  return (
    <span
      title={TOOLTIP}
      aria-label={`Minimum APY ${apy.toFixed(2)} percent`}
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-bold tabular-nums',
        'border border-pxusd-orange-400/30 text-pxusd-orange-300',
        'bg-gradient-to-br from-pxusd-orange-400/[0.14] to-pxusd-yellow-400/[0.10]',
        className ?? '',
      ].join(' ')}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-pxusd-yellow-400"
        style={{ boxShadow: '0 0 8px var(--pxusd-yellow-400)' }}
      />
      {apy.toFixed(2)}% min APY
    </span>
  );
}
