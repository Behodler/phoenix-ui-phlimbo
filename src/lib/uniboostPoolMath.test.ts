import { describe, it, expect } from 'vitest';
import { computeStep1, computeStep2, TOL_NUM, TOL_DEN } from './uniboostPoolMath';

const E = 10n ** 18n; // 1 token, 18 decimals
// Mirror of the module's slippage haircut so these checks track the configured
// tolerance instead of a hardcoded percentage.
const tol = (x: bigint): bigint => (x * TOL_NUM) / TOL_DEN;

describe('uniboostPoolMath.computeStep1', () => {
  it('applies the configured tolerance to the prime->pair quote and halves the worst-case pair balance', () => {
    // pairOutExp 1000, plus 10 pre-existing pair dust.
    const pairPre = 10n * E;
    const pairOutExp = 1000n * E;
    const r = computeStep1({ pairPre, pairOutExp });
    expect(r).not.toBeNull();
    // minPairOut = pairOutExp * TOL
    expect(r!.minPairOut).toBe(tol(pairOutExp));
    // pairBalWorst = pairPre + minPairOut; halfWorst = pairBalWorst / 2
    expect(r!.halfWorst).toBe((pairPre + tol(pairOutExp)) / 2n);
  });

  it('returns null when there is no prime->pair output to pool', () => {
    expect(computeStep1({ pairPre: 5n * E, pairOutExp: 0n })).toBeNull();
  });
});

describe('uniboostPoolMath.computeStep2', () => {
  // Hand-worked scenario, written against the tolerance haircut tol() so it
  // holds for any configured tolerance in the realistic 0–10% band:
  //   minTargetOut = tol(100)
  //   targetBalWorst = 0 + minTargetOut      = tol(100)
  //   pairRemainingWorst = 200 - 100          = 100
  //   rPairAfter   = 900 + 100                = 1000
  //   rTargetAfter = 1000 - 100               = 900
  //   lpFromTarget = tol(100) * 1000 / 900   (>= 100 while tolerance <= 10%)
  //   lpFromPair   = 100 * 1000 / 1000        = 100  (the limiting side here)
  //   expectedLP   = min(lpFromTarget, 100)   = 100
  //   minLP        = tol(100)
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
    // minTargetOut = targetOutExp * TOL
    expect(r!.minTargetOut).toBe(tol(base.targetOutExp));
    // The pair side limits at expectedLP = 100E for any tolerance in the
    // realistic 0–10% band, so minLP = 100E * TOL.
    expect(r!.minLP).toBe(tol(100n * E));
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
