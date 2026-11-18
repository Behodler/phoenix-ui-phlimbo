import { describe, it, expect } from 'vitest';
import { liveAddress } from './liveAddress';

describe('liveAddress', () => {
  it('returns undefined for undefined / null / empty', () => {
    expect(liveAddress(undefined)).toBeUndefined();
    expect(liveAddress(null)).toBeUndefined();
    expect(liveAddress('')).toBeUndefined();
  });

  it('returns undefined for the zero address in any case', () => {
    expect(liveAddress('0x0000000000000000000000000000000000000000')).toBeUndefined();
    expect(liveAddress('0X0000000000000000000000000000000000000000')).toBeUndefined();
  });

  it('returns a real address unchanged (checksum case preserved)', () => {
    const addr = '0x3f4979F4B69CA913E6bc33111331CAd3A6983297';
    expect(liveAddress(addr)).toBe(addr);
  });
});
