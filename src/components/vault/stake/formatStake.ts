// Formatting helpers for the Stake tab rows (relocated from the now-deleted
// mock stable-pool layer in story 069; previously lived in
// `src/data/mockStablePools.ts`).

/** Format a number as a USD currency string with 2 decimals. */
export const fmtUSD = (n: number) =>
  '$' + (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Compact TVL formatting ($1.23M / $4.5k / $678). */
export const fmtTVL = (n: number) => {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
  return '$' + n.toFixed(0);
};

/** Format a token amount with up to `decimals` fraction digits. */
export const fmtAmount = (n: number, decimals = 4) => {
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
};

/** Format an APY percentage (e.g. 6.15 → "6.15%"). */
export const fmtAPY = (n: number) => n.toFixed(2) + '%';
