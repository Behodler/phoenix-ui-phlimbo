import type { TargetSymbol } from '../../../data/uniMarketConfig';
import TokenIcon from './TokenIcon';

interface LpPairIconProps {
  /** Pixel size of each round icon. */
  size: number;
  /** Border colour class matching the surface behind the icons (e.g. `border-pxusd-teal-700`). */
  ringClass: string;
  /** The pair's other token (default phUSD). */
  target?: TargetSymbol;
}

/** Overlapping sUSDS + target (phUSD or AM) icons standing for the UNI-V2 pair token. */
export default function LpPairIcon({ size, ringClass, target = 'phUSD' }: LpPairIconProps) {
  return (
    <span aria-hidden="true" className="inline-flex flex-shrink-0">
      <span className={`inline-flex rounded-full border-2 ${ringClass}`}>
        <TokenIcon sym="sUSDS" size={size} />
      </span>
      <span className={`inline-flex rounded-full border-2 -ml-[10px] ${ringClass}`}>
        <TokenIcon sym={target} size={size} />
      </span>
    </span>
  );
}
