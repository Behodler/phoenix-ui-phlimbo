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
 * `.pill-mc` styles exactly. The tint/border alphas are applied as inline
 * literal `rgba(...)` (the sibling `EarningPanel`/`LiveYieldCounter` convention)
 * rather than `pxusd-*` opacity classes: those tokens are defined as full hex
 * (`var(--pxusd-teal-400)` → `#1f5a73`), so a Tailwind opacity modifier compiles
 * to the invalid `rgb(#1f5a73 / 0.24)` and the fill/outline silently drop.
 */
export default function ApyRangePill({ floor, ceil, variant }: ApyRangePillProps) {
  const label = `${floor.toFixed(1)}–${ceil.toFixed(1)}%`;
  const isMc = variant === 'mc';

  return (
    <span
      className={[
        'inline-block rounded-full border px-[9px] py-[3px] font-mono text-xs font-bold tabular-nums',
        isMc ? 'text-pxusd-orange-300' : '',
      ].join(' ')}
      style={
        isMc
          ? {
              background:
                'linear-gradient(135deg, rgba(255,140,66,0.16), rgba(255,217,61,0.1))',
              borderColor: 'rgba(255,140,66,0.36)',
            }
          : {
              color: '#a6dbef',
              background: 'rgba(31,90,115,0.24)',
              borderColor: 'rgba(31,90,115,0.5)',
            }
      }
    >
      {label}
    </span>
  );
}
