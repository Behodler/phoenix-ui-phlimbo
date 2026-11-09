import { describe, it, expect, vi, afterEach } from 'vitest';
import { createBonfirePotClock } from './bonfirePotClock';
import { bonfirePotAt, fmtPot2 } from './forgeFormat';

const POT = { potInitial: 18.4062, ratePerDay: 2.5, maxPayout: 50 };

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
  it('floors the pot to 2 dp', () => {
    expect(fmtPot2(18.4062)).toBe('18.40');
    expect(fmtPot2(18.4099)).toBe('18.40');
  });
});

describe('createBonfirePotClock (fake timers)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('advances at 2.5/day and clamps at the 50 cap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const clock = createBonfirePotClock(POT, { intervalMs: 1000 });
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
    const clock = createBonfirePotClock(POT, { intervalMs: 1000 });
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

  it('sync() re-anchors to a fresh chain read, adopting its rate and cap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const clock = createBonfirePotClock(POT, { intervalMs: 1000 });
    const seen: number[] = [];
    const unsubscribe = clock.subscribe(() => seen.push(clock.getSnapshot()));

    vi.setSystemTime(DAY_MS);
    clock.sync({ potInitial: 30, ratePerDay: 10, maxPayout: 100 });
    expect(clock.getSnapshot()).toBe(30);
    expect(seen.at(-1)).toBe(30);
    expect(clock.ratePerDay).toBe(10);
    expect(clock.maxPayout).toBe(100);

    // Half a day after the sync: 30 + 5.
    vi.setSystemTime(DAY_MS * 1.5 - 1000);
    vi.advanceTimersByTime(1000);
    expect(clock.getSnapshot()).toBeCloseTo(35, 8);
    unsubscribe();
  });

  it('an unlimited cap (Infinity) never clamps; a zero rate holds the pot still', () => {
    let t = 0;
    const clock = createBonfirePotClock({ potInitial: 0, ratePerDay: 0, maxPayout: Infinity }, { now: () => t, intervalMs: 10 });
    clock.sync({ potInitial: 500, ratePerDay: 100, maxPayout: Infinity });
    t = DAY_MS * 10;
    const unsubscribe = clock.subscribe(() => {});
    expect(clock.getSnapshot()).toBeCloseTo(1500, 8);
    clock.sync({ potInitial: 1500, ratePerDay: 0, maxPayout: Infinity });
    t = DAY_MS * 20;
    unsubscribe();
    const again = clock.subscribe(() => {});
    expect(clock.getSnapshot()).toBe(1500);
    again();
  });

  it('starts clamped when potInitial exceeds the cap', () => {
    const clock = createBonfirePotClock({ potInitial: 80, ratePerDay: 2.5, maxPayout: 50 }, { now: () => 0 });
    expect(clock.getSnapshot()).toBe(50);
  });
});
