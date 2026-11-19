import { describe, it, expect } from 'vitest';
import { computeNextDiscountNft, formatCountdown, type NextDiscountNftInputs } from './nextDiscountNft';

const ONE = 10n ** 18n;
const USDC = 10n ** 6n;
const WAD = 10n ** 18n;

/** 50 USDC per NFT, 12 h per NFT: rate = 50e6 · 1e18 / 43,200 s. */
const P0 = 50n * ONE;
const RATE = (50n * USDC * WAD) / 43_200n;

/** The on-chain rate is floored, so a ceil'd ETA may run up to 1 s over the exact figure. */
function expectSeconds(actual: number | null, exact: number) {
  expect(actual).not.toBeNull();
  expect(actual!).toBeGreaterThanOrEqual(exact);
  expect(actual!).toBeLessThanOrEqual(exact + 1);
}

function inputs(over: Partial<NextDiscountNftInputs> = {}): NextDiscountNftInputs {
  return {
    potUsdRaw: 8n * P0 + 30n * ONE, // 30 of 50 into the 9th NFT → 60 %
    nextStepUsdcRaw: 20n * USDC,
    p0Raw: P0,
    rewardPerSecondRaw: RATE,
    bufferRaw: 400n * USDC,
    pendingRaw: 5n * USDC,
    isStreaming: true,
    elapsedSec: 0,
    ...over,
  };
}

describe('computeNextDiscountNft', () => {
  it('mid-fill: fill from potUSD mod P0, ETA from nextStepUSDC / rate', () => {
    const r = computeNextDiscountNft(inputs());
    expect(r.paused).toBe(false);
    expect(r.fillPct).toBeCloseTo(60, 9);
    // 20 USDC at 50 USDC / 12 h → 4.8 h = 17,280 s (+1 s: the floored on-chain rate, ceil'd).
    expectSeconds(r.secondsLeft, 17_280);
  });

  it('right after a mint the whole pot is reserved: pot < P0 near 0 → fill ≈ 0', () => {
    const r = computeNextDiscountNft(inputs({ potUsdRaw: 10n ** 12n, nextStepUsdcRaw: 50n * USDC }));
    expect(r.fillPct).toBeLessThan(0.001);
    expectSeconds(r.secondsLeft, 43_200);
  });

  it('extrapolates over elapsed time', () => {
    // 1 h of 4.8 h elapsed: remaining 20·(3.8/4.8) USDC; fill = 1 − 0.4·(3.8/4.8).
    const r = computeNextDiscountNft(inputs({ elapsedSec: 3600 }));
    expect(r.fillPct).toBeCloseTo(100 * (1 - 0.4 * (3.8 / 4.8)), 4);
    expectSeconds(r.secondsLeft, 17_280 - 3600);
  });

  it('remaining reaches 0 → fill 100 and 0 s (shown as 00:00:00)', () => {
    const r = computeNextDiscountNft(inputs({ elapsedSec: 20_000 }));
    expect(r.fillPct).toBe(100);
    expect(r.secondsLeft).toBe(0);
    expect(formatCountdown(r.secondsLeft ?? -1)).toBe('00:00:00');
  });

  it('negative elapsed (clock behind the read) is treated as 0', () => {
    expect(computeNextDiscountNft(inputs({ elapsedSec: -5 })).fillPct).toBeCloseTo(60, 9);
  });

  it.each([
    ['no stream', { rewardPerSecondRaw: undefined, bufferRaw: undefined, pendingRaw: undefined, isStreaming: undefined }],
    ['not streaming', { isStreaming: false }],
    ['rate 0', { rewardPerSecondRaw: 0n }],
    ['buffer short of the step', { bufferRaw: 24n * USDC, pendingRaw: 5n * USDC }],
  ] as const)('paused: %s → holds at fill0, no ETA', (_, over) => {
    const r = computeNextDiscountNft(inputs({ ...over, elapsedSec: 3600 }));
    expect(r.paused).toBe(true);
    expect(r.secondsLeft).toBeNull();
    expect(r.fillPct).toBeCloseTo(60, 9);
  });

  it('undrained buffer exactly covering the step is not paused', () => {
    const r = computeNextDiscountNft(inputs({ bufferRaw: 25n * USDC, pendingRaw: 5n * USDC }));
    expect(r.paused).toBe(false);
  });

  it('bigint precision with realistic mainnet-sized values', () => {
    // P0 ≈ 51.2345… USDS; pot ≈ 18.762794 USD; step 34.47 USDC; rate from a 30-day stream of 1,000 USDC.
    const p0Raw = 51_234_567_890_123_456_789n;
    const potUsdRaw = 18_762_794_000_000_000_000n;
    const rate = (1_000n * USDC * WAD) / (30n * 86_400n);
    const r = computeNextDiscountNft(
      inputs({ p0Raw, potUsdRaw, nextStepUsdcRaw: 34_471_773n, rewardPerSecondRaw: rate, bufferRaw: 900n * USDC }),
    );
    expect(r.fillPct).toBeCloseTo((18.762794 / 51.23456789012346) * 100, 9);
    // ceil(34.471773e6 · 1e18 / rate)
    const expected = (34_471_773n * WAD + rate - 1n) / rate;
    expect(r.secondsLeft).toBe(Number(expected));
    // ≈ 34.47 / (1,000 / 30 d) days ≈ 89,350 s.
    expectSeconds(r.secondsLeft, 89_350);
  });

  it('clamps when the price and the batch read disagree (pot mod P0 past nextStep geometry)', () => {
    const r = computeNextDiscountNft(inputs({ p0Raw: 0n }));
    expect(r.fillPct).toBeGreaterThanOrEqual(0);
    expect(r.fillPct).toBeLessThanOrEqual(100);
  });
});

describe('formatCountdown', () => {
  it.each([
    [0, '00:00:00'],
    [-3, '00:00:00'],
    [59, '00:00:59'],
    [3_661, '01:01:01'],
    [86_399, '23:59:59'],
    [86_400, '1d 00:00:00'],
    [2 * 86_400 + 7 * 3600 + 4 * 60 + 12, '2d 07:04:12'],
    [12.9, '00:00:12'],
  ])('%s → %s', (sec, text) => {
    expect(formatCountdown(sec)).toBe(text);
  });
});
