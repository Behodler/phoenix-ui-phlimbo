// Pure helpers shared by the Forge rows (kept out of the component files so
// they stay fast-refresh friendly).

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

/** One NFT as shown by ForgeNftPicker / ForgeNftPickerModal. `id` is the token ID (= dispatcher index). */
export interface ForgeNftOption {
  id: number;
  name: string;
  image: string;
  held: number;
}

/** Joins static NFT config (names, images) with a tokenId → units-held map. */
export const buildForgeNftOptions = (
  config: readonly { id: number; name: string; image: string }[],
  holdings: Record<number, number>,
): ForgeNftOption[] => config.map(({ id, name, image }) => ({ id, name, image, held: holdings[id] ?? 0 }));

/** Signed 4 dp with a real minus sign (U+2212), e.g. "+0.0395" / "−0.0007". */
export const fmtSigned4 = (n: number) => {
  const abs = Math.abs(n).toFixed(4);
  return `${n < 0 && abs !== '0.0000' ? '−' : '+'}${abs}`;
};

export interface HarvestQuoteInput {
  ethOut: number;
  gasEth: number;
}

/** Derived numbers for the Harvest Yield row. Profitable iff ethOut > gasEth. */
export const harvestQuote = ({ ethOut, gasEth }: HarvestQuoteInput, minOutBps: number) => {
  const profit = ethOut - gasEth;
  const profitable = ethOut > gasEth;
  // Floor so the minimum never overstates what the caller is guaranteed.
  const minEthOut = floorTo((ethOut * minOutBps) / 10_000, 4);
  const scale = Math.max(ethOut, gasEth);
  const gasPct = profitable ? (gasEth / scale) * 100 : 100;
  const profitPct = profitable ? (profit / scale) * 100 : 0;
  return { profit, profitable, minEthOut, gasPct, profitPct };
};

/** Pot after `elapsedSeconds` of linear accrual from `start`, clamped at `maxPayout` (NFTBonfire semantics). */
export const bonfirePotAt = (start: number, elapsedSeconds: number, ratePerDay: number, maxPayout: number) =>
  Math.min(maxPayout, start + (Math.max(0, elapsedSeconds) * ratePerDay) / 86_400);

/** `minPayout` for NFTBonfire.burn: pot × bps, floored to 2 dp so it never overstates the guarantee. */
export const bonfireMinPayout = (pot: number, minPayoutBps: number) => floorTo((pot * minPayoutBps) / 10_000, 2);

/**
 * Id of the next NFT the wallet still holds, scanning `nfts` in order after `fromId` and wrapping
 * (so `fromId` itself is checked last). Null when nothing is held.
 */
export const nextHeldNftId = (nfts: readonly ForgeNftOption[], fromId: number): number | null => {
  const start = nfts.findIndex((n) => n.id === fromId);
  for (let i = 1; i <= nfts.length; i++) {
    const nft = nfts[(start + i + nfts.length) % nfts.length];
    if (nft.held > 0) return nft.id;
  }
  return null;
};

/** Bonfire pot as shown to the user: floored to 2 dp (round in favour of the protocol), e.g. "18.40". */
export const fmtPot2 = (pot: number) => fmt2(floorTo(pot, 2));
