import TokenIcon from './TokenIcon';

interface LpPairIconProps {
  /** Pixel size of each round icon. */
  size: number;
  /** Border colour class matching the surface behind the icons (e.g. `border-pxusd-teal-700`). */
  ringClass: string;
}

/** Overlapping sUSDS + phUSD icons standing for the UNI-V2 pair token. */
export default function LpPairIcon({ size, ringClass }: LpPairIconProps) {
  return (
    <span aria-hidden="true" className="inline-flex flex-shrink-0">
      <span className={`inline-flex rounded-full border-2 ${ringClass}`}>
        <TokenIcon sym="sUSDS" size={size} />
      </span>
      <span className={`inline-flex rounded-full border-2 -ml-[10px] ${ringClass}`}>
        <TokenIcon sym="phUSD" size={size} />
      </span>
    </span>
  );
}
