import { WHALE_DISCOUNT_CYAN } from '../../../data/nudgeTokenMeta';
import { formatCountdown } from '../../../lib/nextDiscountNft';

/** Literal colours (Tailwind opacity modifiers on hex tokens emit no CSS). */
const SURFACE = '#0A1C28';
const BORDER = '#163343';
const TRACK = '#163343';
const LABEL = '#8aa1b1';
const AMBER_TEXT = '#f0a24a';
const AMBER_FILL = '#b97a35';

export interface NextDiscountNftProgressProps {
  /** 0–100. */
  fillPct: number;
  /** Seconds to the next discount NFT; ignored while paused. */
  secondsLeft: number | null;
  paused: boolean;
}

/**
 * "Next discount NFT" strip under the Whale Discount CTA: a label, an
 * `HH:MM:SS` countdown (or "Paused") and one progress bar. Presentational;
 * `useNextDiscountNft` supplies the figures.
 *
 * The countdown carries no `aria-live`: it ticks every second and would
 * flood a screen reader. The bar exposes its value through progressbar ARIA.
 */
export default function NextDiscountNftProgress({ fillPct, secondsLeft, paused }: NextDiscountNftProgressProps) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(fillPct) ? fillPct : 0));
  return (
    <div
      className="flex flex-col gap-2.5 rounded-[10px] px-4 py-3.5"
      style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
      data-testid="whale-next-nft"
    >
      <div className="flex items-baseline justify-between gap-4">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ color: LABEL }}
        >
          Next discount NFT
        </span>
        <span
          className={`font-mono text-[16px] font-semibold tabular-nums${paused ? '' : ' text-foreground'}`}
          style={paused ? { color: AMBER_TEXT } : undefined}
          data-testid="whale-next-nft-countdown"
        >
          {paused ? 'Paused' : formatCountdown(secondsLeft ?? 0)}
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Progress to the next discount NFT"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="relative overflow-hidden rounded-full"
        style={{ height: 14, background: TRACK }}
      >
        <div
          className={`absolute inset-y-0 left-0 overflow-hidden rounded-full${paused ? '' : ' whale-next-nft-fill'}`}
          style={{
            width: `${pct}%`,
            background: paused ? AMBER_FILL : `linear-gradient(90deg, #1f8fb8, ${WHALE_DISCOUNT_CYAN})`,
          }}
          data-testid="whale-next-nft-fill"
        >
          {!paused && (
            <div
              aria-hidden="true"
              className="whale-next-nft-sheen absolute inset-y-0"
              style={{
                width: '40%',
                background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.22), rgba(255,255,255,0))',
              }}
            />
          )}
        </div>
      </div>

      <style>{`
        .whale-next-nft-fill { transition: width 0.4s linear; }
        @keyframes whale-next-nft-sheen {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        .whale-next-nft-sheen { animation: whale-next-nft-sheen 2.4s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .whale-next-nft-fill { transition: none; }
          .whale-next-nft-sheen { animation: none; }
        }
      `}</style>
    </div>
  );
}
