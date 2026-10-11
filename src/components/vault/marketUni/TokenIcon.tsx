import type { MarketSymbol } from '../../../data/uniMarketMockData';
import { TOKEN_ICONS, TOKEN_MONOGRAMS } from './tokenIcons';

interface TokenIconProps {
  sym: MarketSymbol;
  /** Pixel size of the round icon. */
  size: number;
}

/** Round token icon, or a coloured monogram chip when no artwork exists. */
export default function TokenIcon({ sym, size }: TokenIconProps) {
  const icon = TOKEN_ICONS[sym];
  if (icon) {
    return (
      <img
        src={icon}
        alt=""
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const m = TOKEN_MONOGRAMS[sym];
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-full font-extrabold text-pxusd-white flex-shrink-0"
      style={{ width: size, height: size, background: m?.bg ?? 'var(--pxusd-teal-600)', fontSize: Math.round(size * 0.5) }}
    >
      {m?.mono ?? sym.charAt(0)}
    </span>
  );
}
