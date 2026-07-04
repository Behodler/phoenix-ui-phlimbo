import { describe, it, expect } from 'vitest';
import { computeStep1, computeStep2 } from './uniboostPoolMath';

const E = 10n ** 18n; // 1 token, 18 decimals

describe('uniboostPoolMath.computeStep1', () => {
  it('applies 1% tolerance to the prime->pair quote and halves the worst-case pair balance', () => {
    // pairOutExp 1000, plus 10 pre-existing pair dust.
    const r = computeStep1({ pairPre: 10n * E, pairOutExp: 1000n * E });
    expect(r).not.toBeNull();
    // minPairOut = 1000 * 99/100 = 990
    expect(r!.minPairOut).toBe(990n * E);
    // pairBalWorst = 10 + 990 = 1000; halfWorst = 500
    expect(r!.halfWorst).toBe(500n * E);
  });

  it('returns null when there is no prime->pair output to pool', () => {
    expect(computeStep1({ pairPre: 5n * E, pairOutExp: 0n })).toBeNull();
  });
});

describe('uniboostPoolMath.computeStep2', () => {
  // Hand-worked exact scenario:
  //   minTargetOut = 100 * 99/100          = 99
  //   pairRemainingWorst = 200 - 100        = 100
  //   targetBalWorst = 0 + 99               = 99
  //   rPairAfter   = 900 + 100              = 1000
  //   rTargetAfter = 1000 - 100             = 900
  //   lpFromTarget = 99 * 1000 / 900        = 110
  //   lpFromPair   = 100 * 1000 / 1000      = 100
  //   expectedLP   = min(110, 100)          = 100  (the naive 50/50 split makes one side limit)
  //   minLP        = 100 * 99/100           = 99
  const base = {
    pairPre: 0n,
    targetPre: 0n,
    minPairOut: 200n * E,
    halfWorst: 100n * E,
    targetOutExp: 100n * E,
    rPair: 900n * E,
    rTarget: 1000n * E,
    totalSupply: 1000n * E,
  };

  it('derives minTargetOut and minLP against the worst-case legs', () => {
    const r = computeStep2(base);
    expect(r).not.toBeNull();
    expect(r!.minTargetOut).toBe(99n * E);
    expect(r!.minLP).toBe(99n * E);
  });

  it('returns null on an empty target pool (totalSupply 0)', () => {
    expect(computeStep2({ ...base, totalSupply: 0n })).toBeNull();
  });

  it('returns null when the pair->target quote is zero', () => {
    expect(computeStep2({ ...base, targetOutExp: 0n })).toBeNull();
  });

  it('returns null when the swap would drain the target reserve in the estimate', () => {
    // targetOutExp >= rTarget -> rTargetAfter <= 0
    expect(computeStep2({ ...base, targetOutExp: 1000n * E })).toBeNull();
  });

  it('minLP is a floor: never above the LP implied by the un-toleranced amounts', () => {
    const r = computeStep2(base)!;
    // Undiscounted expectedLP was 100E; minLP must sit at or below it.
    expect(r.minLP).toBeLessThanOrEqual(100n * E);
  });
});
