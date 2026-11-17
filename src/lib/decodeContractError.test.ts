import { describe, it, expect } from 'vitest';
import { BaseError, ContractFunctionRevertedError, encodeErrorResult, zeroAddress } from 'viem';
import { batchNftMinterNudgeDiscountAbi } from '@behodler/phase2-wagmi-hooks';
import { decodeContractError } from './decodeContractError';

const abi = batchNftMinterNudgeDiscountAbi;

/** A wagmi-shaped failure: a BaseError chain with the decoded revert inside it. */
function revert(errorName: string, args: readonly unknown[] = []): BaseError {
  const data = encodeErrorResult({
    abi,
    errorName,
    args,
  } as unknown as Parameters<typeof encodeErrorResult>[0]);
  const inner = new ContractFunctionRevertedError({ abi, data, functionName: 'batchMint' });
  return new BaseError('Execution reverted', { cause: inner });
}

describe('decodeContractError — BatchNFTMinterNudgeDiscount', () => {
  const cases: [string, readonly unknown[], RegExp][] = [
    ['BatchMint__TotalMismatch', [10n, 12n], /batch changed while you were signing/i],
    ['BatchMint__BoostNotAvailable', [3, 1], /boost changed.*\+3%.*\+1%/i],
    ['BatchMint__MaxPaymentExceeded', [5n, 4n], /price moved/i],
    ['BatchMint__NoDiscountAvailable', [], /no discount batch is available/i],
    ['BatchMint__DiscountNotConfigured', [], /not configured/i],
    ['BatchMint__BonusTokenMismatch', [0n, zeroAddress, zeroAddress], /token list changed/i],
    ['EnforcedPause', [], /paused/i],
  ];

  for (const [name, args, message] of cases) {
    it(`maps ${name}`, () => {
      const decoded = decodeContractError(revert(name, args));
      expect(decoded.errorName).toBe(name);
      expect(decoded.userRejected).toBe(false);
      expect(decoded.message).toMatch(message);
      expect(decoded.message).not.toMatch(/^Reverted with/);
    });
  }

  it('falls back to the error name for an unmapped revert', () => {
    const decoded = decodeContractError(revert('BatchMint__ZeroCap'));
    expect(decoded.message).toBe('Reverted with BatchMint__ZeroCap.');
  });
});
