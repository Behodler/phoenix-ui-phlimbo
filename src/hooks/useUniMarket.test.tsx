import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { maxUint256, parseUnits, zeroAddress } from 'viem';
import { useUniMarket, QUOTE_DEBOUNCE_MS, deadlineFromNow, liveAddress, type UniMarket } from './useUniMarket';

// ---------------------------------------------------------------------------
// Repo convention (useStableStakerPools.test.tsx): `vi.mock` the wagmi
// surface, dispatching reads on `functionName`. These tests cover the hook's
// decision logic — zero-address gating, min-out flooring, deadline, and steps
// derived from live allowances — not RPC plumbing.
// ---------------------------------------------------------------------------

const HELPER = '0x00000000000000000000000000000000000000a1' as const;
const PAIR = '0x00000000000000000000000000000000000000a2' as const;
const PHUSD = '0x00000000000000000000000000000000000000d1' as const;
const SUSDS = '0x00000000000000000000000000000000000000d2' as const;
const USDS = '0x00000000000000000000000000000000000000d3' as const;
const USDC = '0x00000000000000000000000000000000000000d4' as const;
const USDE = '0x00000000000000000000000000000000000000d5' as const;
const DOLA = '0x00000000000000000000000000000000000000d6' as const;
const WALLET = '0x00000000000000000000000000000000000000cc' as const;

const e18 = (n: string) => parseUnits(n, 18);

interface ReadCall { functionName: string; address?: string; enabled: boolean }

let reads: ReadCall[];
let helperAddress: string;
let allowanceByToken: Record<string, bigint>;
/** USDC → phUSD quote returned by quoteToPhUSD (any amount). */
let quotePhusd: bigint;

const writeContractAsync = vi.fn();
const approve = vi.fn();
const addToast = vi.fn();

const chainValue = (functionName: string, address: string | undefined, args: unknown[]): unknown => {
  switch (functionName) {
    // phUSD is token1 here, so the hook must orient the reserves by token0.
    case 'getReserves': return [e18('1850'), e18('2000'), 0];
    case 'token0': return SUSDS;
    case 'totalSupply': return e18('1900');
    case 'convertToAssets': return e18('1.0735');
    case 'balanceOf': return address === USDC ? parseUnits('10000', 6) : e18('10000');
    case 'allowance': return allowanceByToken[address ?? ''] ?? 0n;
    case 'quoteToPhUSD': return quotePhusd;
    case 'quoteFromPhUSD': return e18('1');
    case 'previewDeposit': return ((args[0] as bigint) * 10n ** 18n) / e18('1.0735');
    case 'previewRedeem': return ((args[0] as bigint) * e18('1.0735')) / 10n ** 18n;
    default: return undefined;
  }
};

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: WALLET }),
  useChainId: () => 31337,
  useReadContract: ({ functionName, address, args, query }: {
    functionName: string; address?: string; args?: unknown[]; query?: { enabled?: boolean };
  }) => {
    const enabled = query?.enabled !== false && !!address;
    reads.push({ functionName, address, enabled });
    if (!enabled) return { data: undefined, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() };
    return { data: chainValue(functionName, address, args ?? []), isLoading: false, isFetching: false, isError: false, refetch: vi.fn() };
  },
  useSimulateContract: ({ functionName, address, query }: { functionName: string; address?: string; query?: { enabled?: boolean } }) => {
    const enabled = query?.enabled !== false && !!address;
    reads.push({ functionName: `sim:${functionName}`, address, enabled });
    return { data: enabled ? { result: e18('2000') } : undefined, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() };
  },
  useBalance: ({ query }: { query?: { enabled?: boolean } }) => {
    const enabled = query?.enabled !== false;
    reads.push({ functionName: 'eth:balance', enabled });
    return { data: enabled ? { value: e18('5') } : undefined, refetch: vi.fn() };
  },
  useWriteContract: () => ({ writeContractAsync }),
  // Every submitted hash confirms immediately.
  useWaitForTransactionReceipt: ({ hash }: { hash?: string }) =>
    hash ? { isSuccess: true, isError: false, data: { status: 'success' } } : { isSuccess: false, isError: false, data: undefined },
}));

vi.mock('../contexts/ContractAddressContext', () => ({
  useContractAddresses: () => ({
    addresses: {
      UniswapHelper: helperAddress,
      PhusdSusdsPair: PAIR,
      PhUSD: PHUSD, SUSDS, USDS, USDC, USDe: USDE, Dola: DOLA,
    },
    networkType: 'local',
  }),
}));
vi.mock('../components/ui/ToastProvider', () => ({ useToast: () => ({ addToast }) }));
vi.mock('../contexts/WalletBalancesContext', () => ({ useWalletBalances: () => ({ refreshWalletBalances: vi.fn() }) }));
vi.mock('./useContractInteractions', () => ({ useTokenApproval: () => ({ approve }) }));
vi.mock('../utils/logger', () => ({ log: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

let m: UniMarket;
function Harness() {
  m = useUniMarket();
  return null;
}

/** Type an amount into "You pay" and let the quote debounce elapse. */
const typePay = (v: string) => {
  act(() => m.setPay(v));
  act(() => {
    vi.advanceTimersByTime(QUOTE_DEBOUNCE_MS);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
  reads = [];
  helperAddress = HELPER;
  allowanceByToken = {};
  quotePhusd = 93_123_456_789_012_345_678n;
  writeContractAsync.mockReset().mockResolvedValue('0xbeef');
  approve.mockReset().mockResolvedValue('0xa11');
  addToast.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('helpers', () => {
  it('liveAddress drops missing and zero addresses', () => {
    expect(liveAddress(undefined)).toBeUndefined();
    expect(liveAddress(zeroAddress)).toBeUndefined();
    expect(liveAddress(HELPER)).toBe(HELPER);
  });

  it('deadlineFromNow = now (s) + minutes × 60', () => {
    expect(deadlineFromNow(20, 1_000_000_500)).toBe(1_000_000n + 1200n);
  });
});

describe('useUniMarket — zero-address gating', () => {
  it('a zero UniswapHelper disables every read and simulation, and nothing is ever sent', async () => {
    helperAddress = zeroAddress;
    render(<Harness />);
    typePay('100');
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.filter((r) => r.enabled)).toEqual([]);
    expect(m.available).toBe(false);
    expect(m.cta).toEqual({ label: 'Not available on this network', enabled: false });

    act(() => m.startReview());
    expect(m.modal).toBeNull();
    await act(async () => {
      await m.advanceStep();
    });
    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(approve).not.toHaveBeenCalled();
    expect(m.tickerPrice).toBe('—');
  });

  it('with live addresses, the pair, sUSDS and token reads are enabled and the ticker is oriented by token0', () => {
    render(<Harness />);
    expect(m.available).toBe(true);
    expect(reads.find((r) => r.functionName === 'getReserves')?.enabled).toBe(true);
    // rPh = 2000, rS = 1850 → (1850/2000) × 1.0735
    expect(m.tickerPrice).toBe(`$${((1850 / 2000) * 1.0735).toFixed(6)}`);
    expect(m.tickerPair).toBe('phUSD/sUSDS pool · 2.0k phUSD / 1.9k sUSDS');
  });
});

describe('useUniMarket — quotes, min-out and the write', () => {
  it('debounces the quote: CTA shows "Fetching quote…" until the debounce elapses', () => {
    render(<Harness />);
    act(() => m.setPay('100'));
    expect(m.cta.label).toBe('Fetching quote…');
    act(() => {
      vi.advanceTimersByTime(QUOTE_DEBOUNCE_MS);
    });
    expect(m.cta).toEqual({ label: 'Review swap', enabled: true });
    expect(m.recvStr).not.toBe('');
  });

  it('floors the min-out and sends swapToPhUSD with it and a submit-time deadline', async () => {
    allowanceByToken[USDC] = maxUint256;
    render(<Harness />);
    typePay('100');
    const expectedMin = (quotePhusd * 9950n) / 10000n;
    expect(m.swap.minOutWei).toBe(expectedMin);

    act(() => m.startReview());
    expect(m.steps.map((s) => s.sub)).toEqual(['UniswapHelper.swapToPhUSD']);

    // Submit 5 minutes after the review opened: the deadline is taken at submit time.
    vi.setSystemTime(new Date('2026-10-17T12:05:00Z'));
    await act(async () => {
      await m.advanceStep();
    });
    expect(writeContractAsync).toHaveBeenCalledTimes(1);
    const call = writeContractAsync.mock.calls[0][0];
    expect(call.address).toBe(HELPER);
    expect(call.functionName).toBe('swapToPhUSD');
    const nowS = BigInt(Math.floor(new Date('2026-10-17T12:05:00Z').getTime() / 1000));
    expect(call.args).toEqual([USDC, parseUnits('100', 6), expectedMin, WALLET, nowS + 1200n]);
    expect(m.success).toBe(true);
    expect(m.etherscanUrl).toBe(''); // Anvil: link hidden
  });
});

describe('useUniMarket — step derivation from allowances', () => {
  it('allowance below the amount adds an approve step to UniswapHelper; exactApprove approves the exact amount', async () => {
    allowanceByToken[USDC] = parseUnits('99', 6);
    render(<Harness />);
    typePay('100');
    act(() => m.startReview());
    expect(m.steps.map((s) => s.kind)).toEqual(['approve', 'action']);
    expect(m.steps[0].sub).toBe('USDC.approve(UniswapHelper)');
    expect(m.exactLabel).toBe('Approve exact amount only (100.00 USDC) instead of unlimited');

    act(() => m.toggleExactApprove());
    await act(async () => {
      await m.advanceStep();
    });
    expect(approve).toHaveBeenCalledWith(USDC, HELPER, parseUnits('100', 6));
    // Receipt confirmed → advanced to the action step.
    expect(m.stepIdx).toBe(1);
    expect(m.success).toBe(false);
  });

  it('unlimited approval by default (maxUint256)', async () => {
    render(<Harness />);
    typePay('100');
    act(() => m.startReview());
    await act(async () => {
      await m.advanceStep();
    });
    expect(approve).toHaveBeenCalledWith(USDC, HELPER, maxUint256);
  });

  it('an allowance covering the amount skips approval', () => {
    allowanceByToken[USDC] = parseUnits('100', 6);
    render(<Harness />);
    typePay('100');
    act(() => m.startReview());
    expect(m.steps.map((s) => s.kind)).toEqual(['action']);
  });

  it('add liquidity (sUSDS): approve sUSDS and phUSD, then addLiquiditySUSDS with floored mins', async () => {
    render(<Harness />);
    act(() => m.setLiqAction('add'));
    act(() => m.selectAddToken('sUSDS'));
    act(() => m.setAddTok('10'));
    act(() => m.startReview());
    expect(m.steps.map((s) => s.sub)).toEqual([
      'sUSDS.approve(UniswapHelper)',
      'phUSD.approve(UniswapHelper)',
      'UniswapHelper.addLiquiditySUSDS',
    ]);
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await m.advanceStep();
      });
    }
    const call = writeContractAsync.mock.calls[0][0];
    const a = e18('10');
    const b = (a * e18('2000')) / e18('1850');
    expect(call.functionName).toBe('addLiquiditySUSDS');
    expect(call.args.slice(0, 5)).toEqual([a, b, (a * 9950n) / 10000n, (b * 9950n) / 10000n, WALLET]);
  });

  it('remove liquidity: the LP approval targets the pair token, spender UniswapHelper', async () => {
    render(<Harness />);
    act(() => m.setLiqAction('remove'));
    act(() => m.pickRemovePct(0.5));
    act(() => m.startReview());
    expect(m.steps.map((s) => s.sub)).toEqual(['UNI-V2.approve(UniswapHelper)', 'UniswapHelper.removeLiquiditySUSDS']);
    await act(async () => {
      await m.advanceStep();
    });
    expect(approve).toHaveBeenCalledWith(PAIR, HELPER, maxUint256);
  });
});

describe('useUniMarket — errors', () => {
  it('a wallet rejection is a quiet info toast and keeps the modal on the same step', async () => {
    allowanceByToken[USDC] = maxUint256;
    writeContractAsync.mockRejectedValueOnce(new Error('User rejected the request.'));
    render(<Harness />);
    typePay('100');
    act(() => m.startReview());
    await act(async () => {
      await m.advanceStep();
    });
    expect(m.modal).toBe('swap');
    expect(m.stepIdx).toBe(0);
    expect(m.pending).toBe(false);
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info', title: 'Transaction Cancelled' }));
    expect(addToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});
