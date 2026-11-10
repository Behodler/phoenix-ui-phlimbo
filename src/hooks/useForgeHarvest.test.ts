import { describe, it, expect } from 'vitest';
import { harvestProfitability } from './useForgeHarvest';

// The quote is a zero-gas-price simulation; profitability is priced client-side.
// Figures mirror a real mainnet quote (2026-11-10): ~2.35M gas, 0.0588 gwei maxFee.
const GAS_UNITS = 2_345_378n;
const MAX_FEE = 58_803_791n; // wei per gas
const OVERHEAD = 60_000n; // SYAHarvester.GAS_OVERHEAD

describe('harvestProfitability', () => {
  it('prices the caller gas cost at maxFeePerGas', () => {
    const { gasCostWei } = harvestProfitability({ ethOutWei: 0n, gasUnits: GAS_UNITS, maxFeePerGas: MAX_FEE }, OVERHEAD);
    expect(gasCostWei).toBe(GAS_UNITS * MAX_FEE);
  });

  it('is unprofitable when the payout is below gas (the live mainnet case)', () => {
    const quote = { ethOutWei: 62_591_244_283_990n, gasUnits: GAS_UNITS, maxFeePerGas: MAX_FEE };
    expect(harvestProfitability(quote, OVERHEAD).profitable).toBe(false);
  });

  it('is profitable when the payout clears gas plus the contract overhead', () => {
    const threshold = (GAS_UNITS + OVERHEAD) * MAX_FEE;
    const quote = { ethOutWei: threshold + 1n, gasUnits: GAS_UNITS, maxFeePerGas: MAX_FEE };
    expect(harvestProfitability(quote, OVERHEAD).profitable).toBe(true);
  });

  it('stays unprofitable when the payout covers the caller gas but not the contract guard', () => {
    // Between gasUnits*fee and (gasUnits+GAS_OVERHEAD)*fee the contract would
    // still revert Unprofitable, so the UI must not offer the harvest.
    const quote = { ethOutWei: GAS_UNITS * MAX_FEE + 1n, gasUnits: GAS_UNITS, maxFeePerGas: MAX_FEE };
    expect(harvestProfitability(quote, OVERHEAD).profitable).toBe(false);
  });

  it('is unprofitable at exactly the threshold', () => {
    const quote = { ethOutWei: (GAS_UNITS + OVERHEAD) * MAX_FEE, gasUnits: GAS_UNITS, maxFeePerGas: MAX_FEE };
    expect(harvestProfitability(quote, OVERHEAD).profitable).toBe(false);
  });
});
