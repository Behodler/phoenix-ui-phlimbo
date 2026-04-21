import phUsdLogo from '../../../assets/phUSD-nobackground.png';

export interface PhUsdCoinProps {
  size?: number;
  className?: string;
}

/**
 * Small phUSD glyph.
 *
 * Uses the existing `phUSD-nobackground.png` asset rather than the mock's
 * inline gradient SVG so the staking surface matches the rest of phlimbo-ui
 * (Header, YieldRewardsInfo, etc.).
 */
export default function PhUsdCoin({ size = 18, className }: PhUsdCoinProps) {
  return (
    <img
      src={phUsdLogo}
      width={size}
      height={size}
      alt="phUSD"
      className={['shrink-0 select-none', className ?? ''].join(' ')}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
