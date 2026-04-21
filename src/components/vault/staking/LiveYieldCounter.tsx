import { useEffect, useRef, useState } from 'react';

export interface LiveYieldCounterProps {
  /** phUSD disbursed per second to the holder (may be 0) */
  ratePerSecond: number;
  /** Starting value (baseline); counter resets to this whenever it changes */
  initial?: number;
  /** Decimal places to render (default 6) */
  decimals?: number;
  /** Font size in px */
  size?: number;
  /** Font weight */
  weight?: number;
  /** Text alignment */
  align?: 'left' | 'right' | 'center';
}

/**
 * requestAnimationFrame-driven counter.
 *
 * The displayed value is baseline + elapsed * ratePerSecond. The baseline
 * and time origin are reset whenever either `ratePerSecond` or `initial`
 * changes, so Claim / Unstake (which drop pendingYield to 0 and re-render
 * the parent with a new `initial` prop) make the number snap back cleanly.
 *
 * The trailing (min(3, decimals)) digits are rendered in the yellow accent
 * color per the mock — gives a subtle "fresh digits" glow without any
 * layout shift or transition.
 */
export default function LiveYieldCounter({
  ratePerSecond,
  initial = 0,
  decimals = 6,
  size = 32,
  weight = 700,
  align = 'left',
}: LiveYieldCounterProps) {
  const [value, setValue] = useState<number>(initial);
  const startRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0);
  const baseRef = useRef<number>(initial);

  // Reset baseline whenever rate or initial changes.
  useEffect(() => {
    startRef.current = performance.now();
    baseRef.current = initial;
    setValue(initial);
  }, [ratePerSecond, initial]);

  // RAF ticker.
  useEffect(() => {
    let raf: number | null = null;
    const tick = () => {
      const elapsed = (performance.now() - startRef.current) / 1000;
      setValue(baseRef.current + elapsed * ratePerSecond);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [ratePerSecond]);

  const str = value.toFixed(decimals);
  const tailLen = Math.min(3, decimals);
  const head = tailLen > 0 ? str.slice(0, str.length - tailLen) : str;
  const tail = tailLen > 0 ? str.slice(str.length - tailLen) : '';

  return (
    <span
      className="font-mono tabular-nums text-pxusd-white"
      style={{
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.05,
        textAlign: align,
        letterSpacing: '-0.02em',
        display: 'inline-block',
      }}
    >
      {head}
      {tail && <span style={{ color: 'rgba(255,217,61,.92)' }}>{tail}</span>}
    </span>
  );
}
