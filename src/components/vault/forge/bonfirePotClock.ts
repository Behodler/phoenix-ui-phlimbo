import { useSyncExternalStore } from 'react';
import { bonfirePotAt } from './forgeFormat';

export interface BonfirePotParams {
  potInitial: number;
  ratePerDay: number;
  maxPayout: number;
}

/**
 * Shared ticking source for the NFT Bonfire pot. The row header metric, the
 * pot panel and the burn button all read the same snapshot, so they always
 * agree. Ticks only while something is subscribed; elapsed time is measured
 * from the last reset, so pausing the ticker never loses accrual.
 *
 * MOCKED: the live-wiring story replaces this with NFTBonfire.pendingPayout().
 */
export interface BonfirePotClock {
  readonly ratePerDay: number;
  readonly maxPayout: number;
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
  /** A burn paid out the pot: restart accrual from zero. */
  reset: () => void;
}

export interface BonfirePotClockOptions {
  /** Tick interval in ms. Use ~1000 under prefers-reduced-motion. */
  intervalMs?: number;
  /** Clock source in ms (test seam). */
  now?: () => number;
}

export function createBonfirePotClock(
  { potInitial, ratePerDay, maxPayout }: BonfirePotParams,
  { intervalMs = 50, now = () => Date.now() }: BonfirePotClockOptions = {},
): BonfirePotClock {
  let start = Math.min(maxPayout, potInitial);
  let origin = now();
  let snapshot = start;
  let timer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());
  const tick = () => {
    const next = bonfirePotAt(start, (now() - origin) / 1000, ratePerDay, maxPayout);
    if (next !== snapshot) {
      snapshot = next;
      emit();
    }
  };

  return {
    ratePerDay,
    maxPayout,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      if (timer === null) {
        tick();
        timer = setInterval(tick, intervalMs);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer !== null) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    reset: () => {
      start = 0;
      origin = now();
      snapshot = 0;
      emit();
    },
  };
}

/** Current pot (Antimatter), re-rendering on every clock tick. */
export const useBonfirePot = (clock: BonfirePotClock) => useSyncExternalStore(clock.subscribe, clock.getSnapshot);

/** True when the user asked the OS for reduced motion (false where matchMedia is unavailable). */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
