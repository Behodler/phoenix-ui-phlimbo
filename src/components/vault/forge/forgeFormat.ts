// Pure helpers shared by the Forge rows (kept out of the component files so
// they stay fast-refresh friendly).

// Constant import only — issues no contract calls. Keeps one source of truth
// for the annihilation price gate.
import { ANNIHILATE_PRICE_FLOOR } from '../../../hooks/useStableStakerPools';

/** True when annihilating would destroy value: net per unit is 2p − 1. Raw price, never clamped. */
export const isAnnihilateGated = (price: number) => price <= ANNIHILATE_PRICE_FLOOR;

/** 2 dp with thousands separators, e.g. 1250 → "1,250.00". */
export const fmt2 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Floor to `dp` decimal places (round in favour of the protocol, never the user). */
export const floorTo = (n: number, dp: number) => {
  const f = 10 ** dp;
  // The epsilon absorbs binary noise such as 0.29 * 100 = 28.999999999999996.
  return Math.floor(n * f + 1e-9) / f;
};

/** Trailing-zero-free string for writing a number back into an amount input. */
export const toInputString = (n: number, dp = 4) => {
  const s = floorTo(n, dp).toFixed(dp);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};

/** Accepts '', digits, and at most one '.' with up to 4 decimals (Mint's limit). */
export const AMOUNT_INPUT_PATTERN = /^\d*\.?\d{0,4}$/;
