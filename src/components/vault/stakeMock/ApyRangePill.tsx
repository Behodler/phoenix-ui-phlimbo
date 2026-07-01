import type { StakerKind } from '../../../data/nftStakeMockData';

export interface ApyRangePillProps {
  /** % — the "Latest mint" (floor) anchor. */
  floor: number;
  /** % — the "Earliest mint" (ceil) anchor. */
  ceil: number;
  /** Fixed-rate (teal) vs MasterChef (orange) variant. */
  variant: StakerKind;
}

/**
 * `{floor}–{ceil}%` APY-range pill.
 *
 * Presentational — plain props only. The `fixed` variant is teal-tinted, the
 * `mc` variant is orange-tinted, matching the redesign HTML `.pill-fixed` /
 * `.pill-mc` styles. Tints/borders compose from `pxusd-*` tokens; the light
 * teal accent text has no palette token, so it reuses the design's accent
 * value inline (the same pattern the sibling `EarningPanel` uses for its
 * token-less mock accents).
 */
export default function ApyRangePill({ floor, ceil, variant }: ApyRangePillProps) {
  const label = `${floor.toFixed(1)}–${ceil.toFixed(1)}%`;
  const isMc = variant === 'mc';

  return (
    <span
      className={[
        'inline-block rounded-full px-[9px] py-[3px] font-mono text-xs font-bold tabular-nums',
        isMc
          ? 'text-pxusd-orange-300 border border-pxusd-orange-400/[0.36] bg-gradient-to-br from-pxusd-orange-400/[0.16] to-pxusd-yellow-400/10'
          : 'border border-pxusd-teal-400/50 bg-pxusd-teal-400/[0.24]',
      ].join(' ')}
      style={isMc ? undefined : { color: '#a6dbef' }}
    >
      {label}
    </span>
  );
}
