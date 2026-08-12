import { describe, it, expect, vi } from 'vitest';
import { decodeDepositPageView, PromoPhase } from './useDepositPageView';

vi.mock('../utils/logger', () => ({
  log: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const PRECISION = 10n ** 18n;
const KENDU = '0x00000000000000000000000000000000000000ab';

/**
 * Builds a 23-field page-view array with sane defaults, so each test only has
 * to state the fields it actually cares about.
 */
function page(overrides: Partial<Record<number, bigint>> = {}): bigint[] {
  const data: bigint[] = [
    1_000n * PRECISION, // 0  userPhUSDBalance
    0n, // 1  phUSDRewardsPerSecond   (RAW wei/sec)
    0n, // 2  stableRewardsPerSecond  (PRECISION-scaled)
    0n, // 3  pendingPhUSDRewards
    0n, // 4  pendingStableRewards
    500n * PRECISION, // 5  stakedBalance
    0n, // 6  userAllowance
    PRECISION, // 7  precision
    PRECISION / 10n, // 8  minimumStake
    5_000n * PRECISION, // 9  totalStaked
    0n, // 10 paused
    0n, // 11 promoToken
    0n, // 12 promoTokenDecimals
    0n, // 13 promoRewardPerSecond    (PRECISION-scaled)
    0n, // 14 promoRewardBalance
    0n, // 15 promoDepletionDuration
    0n, // 16 promoPhase
    0n, // 17 flushCursor
    3n, // 18 stakerCount
    0n, // 19 pendingPromoRewards
    0n, // 20 unclaimablePromo
    0n, // 21 unclaimableStable
    0n, // 22 unclaimablePhUSD
  ];
  for (const [index, value] of Object.entries(overrides)) {
    data[Number(index)] = value as bigint;
  }
  return data;
}

describe('decodeDepositPageView', () => {
  describe('length guard', () => {
    it('refuses a 7-field V1 page', () => {
      expect(decodeDepositPageView(page().slice(0, 7))).toBeNull();
    });

    it('refuses an over-long page', () => {
      expect(decodeDepositPageView([...page(), 0n])).toBeNull();
    });

    it('accepts exactly 23 fields', () => {
      expect(decodeDepositPageView(page())).not.toBeNull();
    });
  });

  describe('scaling asymmetry between adjacent rate fields', () => {
    it('leaves field 1 (phUSD rate) raw and descales field 2 (stable rate)', () => {
      // 1 USDC/sec on-chain is 1e6 (USDC decimals) × 1e18 (PRECISION).
      const oneUsdcPerSecond = 10n ** 6n * PRECISION;
      const decoded = decodeDepositPageView(
        page({ 1: 12_345n, 2: oneUsdcPerSecond }),
      )!;

      expect(decoded.phUSDRewardsPerSecondRaw).toBe(12_345n);
      expect(decoded.stableRewardsPerSecond).toBeCloseTo(1.0, 12);
    });

    it('descales field 13 (promo rate) by promo decimals, not by 1e6', () => {
      // 2 KENDU/sec, KENDU being 18-decimal.
      const twoPerSecond = 2n * PRECISION * PRECISION;
      const decoded = decodeDepositPageView(
        page({ 11: BigInt(KENDU), 12: 18n, 13: twoPerSecond }),
      )!;

      expect(decoded.promoRewardPerSecond).toBeCloseTo(2.0, 12);
    });

    it('uses the page view’s own PRECISION rather than a hardcoded 1e18', () => {
      // A farm on 1e12 precision: the same scaled value means a larger rate.
      const precision = 10n ** 12n;
      const decoded = decodeDepositPageView(
        page({ 2: 10n ** 6n * precision, 7: precision }),
      )!;

      expect(decoded.stableRewardsPerSecond).toBeCloseTo(1.0, 12);
    });

    it('reports a zero rate when precision is zero rather than dividing by it', () => {
      const decoded = decodeDepositPageView(page({ 2: 999n, 7: 0n }))!;
      expect(decoded.stableRewardsPerSecond).toBe(0);
    });
  });

  describe('entitlement', () => {
    it('sums claimable-now and banked for each bucket', () => {
      const decoded = decodeDepositPageView(
        page({
          3: 10n,
          4: 20n,
          19: 30n,
          20: 3n,
          21: 2n,
          22: 1n,
        }),
      )!;

      expect(decoded.entitlementPhUSD).toBe(11n);
      expect(decoded.entitlementStable).toBe(22n);
      expect(decoded.entitlementPromo).toBe(33n);
    });

    it('still reports the banked amount when pending has been zeroed by a failed payout', () => {
      // This is the case the old 7-field page could not express: the user has
      // a real balance but every `pendingX` reads zero.
      const decoded = decodeDepositPageView(page({ 3: 0n, 21: 500n }))!;

      expect(decoded.pendingStableRewards).toBe(0n);
      expect(decoded.entitlementStable).toBe(500n);
    });
  });

  describe('promo slot', () => {
    it('decodes the promo token address out of its uint256 slot', () => {
      const decoded = decodeDepositPageView(page({ 11: BigInt(KENDU) }))!;

      expect(decoded.promoToken.toLowerCase()).toBe(KENDU);
      expect(decoded.hasPromo).toBe(true);
    });

    it('reports no promo when the slot is the zero address', () => {
      const decoded = decodeDepositPageView(page({ 11: 0n }))!;

      expect(decoded.hasPromo).toBe(false);
      expect(decoded.promoPhase).toBe(PromoPhase.None);
    });

    it('treats a drained promo as still Active, not as a phase of its own', () => {
      const decoded = decodeDepositPageView(
        page({ 11: BigInt(KENDU), 12: 18n, 14: 0n, 16: 1n }),
      )!;

      expect(decoded.promoPhase).toBe(PromoPhase.Active);
      expect(decoded.promoRewardBalance).toBe(0n);
    });

    it('pairs Flushing with the paused flag', () => {
      const decoded = decodeDepositPageView(
        page({ 11: BigInt(KENDU), 12: 18n, 16: 2n, 10: 1n, 17: 2n }),
      )!;

      expect(decoded.promoPhase).toBe(PromoPhase.Flushing);
      expect(decoded.paused).toBe(true);
      expect(decoded.flushCursor).toBe(2n);
    });
  });

  it('passes indices 0-6 through unchanged, matching the retired DepositView', () => {
    const decoded = decodeDepositPageView(
      page({ 0: 1n, 1: 2n, 2: 3n, 3: 4n, 4: 5n, 5: 6n, 6: 7n }),
    )!;

    expect(decoded.userPhUSDBalance).toBe(1n);
    expect(decoded.phUSDRewardsPerSecondRaw).toBe(2n);
    expect(decoded.stableRewardsPerSecondScaled).toBe(3n);
    expect(decoded.pendingPhUSDRewards).toBe(4n);
    expect(decoded.pendingStableRewards).toBe(5n);
    expect(decoded.stakedBalance).toBe(6n);
    expect(decoded.userAllowance).toBe(7n);
  });
});
