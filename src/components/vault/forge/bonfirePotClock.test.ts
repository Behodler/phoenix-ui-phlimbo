import { describe, it, expect, vi, afterEach } from 'vitest';
import { createBonfirePotClock } from './bonfirePotClock';
import { bonfireMinPayout, bonfirePotAt, fmtPot2, nextHeldNftId } from './forgeFormat';
import { FORGE_BONFIRE_MIN_PAYOUT_BPS, FORGE_BONFIRE_MOCK } from '../../../data/forgeMockData';

const DAY_MS = 86_400_000;

describe('bonfirePotAt', () => {
  it('accrues linearly per day and clamps at maxPayout', () => {
    expect(bonfirePotAt(10, 0, 2.5, 50)).toBe(10);
    expect(bonfirePotAt(10, 86_400, 2.5, 50)).toBeCloseTo(12.5, 10);
    expect(bonfirePotAt(10, 43_200, 2.5, 50)).toBeCloseTo(11.25, 10);
    expect(bonfirePotAt(49, 86_400, 2.5, 50)).toBe(50);
    expect(bonfirePotAt(10, -5, 2.5, 50)).toBe(10);
  });
});

describe('bonfire formatting', () => {
  it('floors the pot and minPayout to 2 dp', () => {
    expect(fmtPot2(18.4062)).toBe('18.40');
    expect(fmtPot2(18.4099)).toBe('18.40');
    // 18.4062 × 98% = 18.038076 → 18.03
    expect(bonfireMinPayout(18.4062, FORGE_BONFIRE_MIN_PAYOUT_BPS)).toBe(18.03);
    expect(bonfireMinPayout(0, FORGE_BONFIRE_MIN_PAYOUT_BPS)).toBe(0);
  });

  it('nextHeldNftId scans forward from the given id and wraps', () => {
    const nfts = [
      { id: 1, name: 'a', image: '', held: 0 },
      { id: 2, name: 'b', image: '', held: 0 },
      { id: 3, name: 'c', image: '', held: 2 },
      { id: 4, name: 'd', image: '', held: 1 },
    ];
    expect(nextHeldNftId(nfts, 1)).toBe(3);
    expect(nextHeldNftId(nfts, 3)).toBe(4);
    expect(nextHeldNftId(nfts, 4)).toBe(3);
    expect(nextHeldNftId(nfts.map((n) => ({ ...n, held: 0 })), 2)).toBeNull();
  });
});

describe('createBonfirePotClock (fake timers)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('advances at 2.5/day and clamps at the 50 cap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const clock = createBonfirePotClock(FORGE_BONFIRE_MOCK, { intervalMs: 1000 });
    const seen: number[] = [];
    const unsubscribe = clock.subscribe(() => seen.push(clock.getSnapshot()));

    expect(clock.getSnapshot()).toBeCloseTo(18.4062, 10);

    // One day later: +2.5 (advanceTimersByTime also moves the fake clock by 1s).
    vi.setSystemTime(DAY_MS - 1000);
    vi.advanceTimersByTime(1000);
    expect(clock.getSnapshot()).toBeCloseTo(20.9062, 8);

    // Half a day more: +1.25.
    vi.setSystemTime(DAY_MS * 1.5 - 1000);
    vi.advanceTimersByTime(1000);
    expect(clock.getSnapshot()).toBeCloseTo(22.1562, 8);

    // Long enough to overshoot the cap: clamps at exactly 50.
    vi.setSystemTime(DAY_MS * 30);
    vi.advanceTimersByTime(1000);
    expect(clock.getSnapshot()).toBe(50);
    expect(seen.length).toBeGreaterThan(0);

    unsubscribe();
  });

  it('reset() empties the pot, which then accrues again from zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const clock = createBonfirePotClock(FORGE_BONFIRE_MOCK, { intervalMs: 1000 });
    const unsubscribe = clock.subscribe(() => {});
    clock.reset();
    expect(clock.getSnapshot()).toBe(0);
    vi.setSystemTime(DAY_MS * 2 - 1000);
    vi.advanceTimersByTime(1000);
    expect(clock.getSnapshot()).toBeCloseTo(5, 8);
    unsubscribe();
  });

  it('keeps accruing while unsubscribed (elapsed time is measured from the last reset)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const clock = createBonfirePotClock({ potInitial: 0, ratePerDay: 2.5, maxPayout: 50 }, { intervalMs: 1000 });
    vi.setSystemTime(DAY_MS * 4);
    const unsubscribe = clock.subscribe(() => {});
    expect(clock.getSnapshot()).toBeCloseTo(10, 8);
    unsubscribe();
  });

  it('starts clamped when potInitial exceeds the cap', () => {
    const clock = createBonfirePotClock({ potInitial: 80, ratePerDay: 2.5, maxPayout: 50 }, { now: () => 0 });
    expect(clock.getSnapshot()).toBe(50);
  });
});
