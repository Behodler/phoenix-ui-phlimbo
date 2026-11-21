import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { maxUint256, zeroAddress } from 'viem';
import { useForgeAnnihilateBoost, BOOST_NOT_LIVE, BOOST_PAUSED, BOOSTER_WRITE_ABI } from './useForgeAnnihilateBoost';
import type { AnnihilateStableSymbol, ForgeAnnihilateState } from './useForgeAnnihilate';

const WALLET = '0x00000000000000000000000000000000000000a1';
const BOOSTER = '0x930b00000000000000000000000000000000d5b7';
const ANTIMATTER = '0x00000000000000000000000000000000000000a7';
const USDC = '0x00000000000000000000000000000000000000c6';
const USDE = '0x00000000000000000000000000000000000000e5';
const DOLA = '0x00000000000000000000000000000000000000d0';
const ONE = 10n ** 18n;

type Preview = readonly [boolean, number, bigint, bigint, bigint, bigint];
const eligible = (base = 0n, bonus = 0n): Preview => [true, 0, 1n, 10n, base, bonus];
const ineligible = (reason: number): Preview => [false, reason, 9n, 10n, 0n, 0n];

const state = vi.hoisted(() => ({
  booster: '' as string,
  bps: 1000n as bigint | undefined,
  paused: false,
  /** previewBoost(stable, 0) per stable, in ANNIHILATE_STABLE_ORDER (USDC, USDe, DOLA). */
  eligibility: [] as unknown[],
  quote: undefined as unknown,
  freshQuote: undefined as unknown,
  amAllowance: 0n,
  stableAllowance: 0n,
  enabled: {} as Record<string, boolean | undefined>,
  quoteArgs: undefined as unknown,
  receipt: undefined as unknown,
  receiptSuccess: false,
}));

const fns = vi.hoisted(() => ({
  writeContractAsync: vi.fn(),
  approve: vi.fn(),
  addToast: vi.fn(),
  refreshWalletBalances: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: WALLET }),
  useReadContract: ({ functionName, args, query }: { functionName: string; args?: unknown; query?: { enabled?: boolean } }) => {
    const key = functionName === 'previewBoost' ? 'quote' : functionName;
    state.enabled[key] = query?.enabled;
    if (query?.enabled === false) return { data: undefined, refetch: vi.fn(async () => ({ data: undefined })) };
    if (functionName === 'boostBps') return { data: state.bps, refetch: vi.fn() };
    if (functionName === 'paused') return { data: state.paused, refetch: vi.fn() };
    state.quoteArgs = args;
    return {
      data: state.quote,
      refetch: vi.fn(async () => {
        if (state.freshQuote !== undefined) state.quote = state.freshQuote;
        return { data: state.quote };
      }),
    };
  },
  useReadContracts: ({ contracts, query }: { contracts: { functionName: string }[]; query?: { enabled?: boolean } }) => {
    const key = contracts[0].functionName === 'previewBoost' ? 'eligibility' : 'allowances';
    state.enabled[key] = query?.enabled;
    if (query?.enabled === false) return { data: undefined, refetch: vi.fn() };
    const data =
      key === 'eligibility'
        ? state.eligibility.map((result) => ({ status: 'success', result }))
        : [
            { status: 'success', result: state.amAllowance },
            { status: 'success', result: state.stableAllowance },
          ];
    return { data, refetch: vi.fn() };
  },
  useWriteContract: () => ({ data: undefined, writeContractAsync: fns.writeContractAsync }),
  useWaitForTransactionReceipt: () => ({ data: undefined, isSuccess: false, isError: false }),
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: fns.invalidateQueries }) }));
vi.mock('../contexts/ContractAddressContext', () => ({
  useContractAddresses: () => ({
    addresses: { AntimatterBooster: state.booster, Antimatter: ANTIMATTER, USDC, USDe: USDE, Dola: DOLA },
    networkType: 'local',
  }),
}));
vi.mock('../contexts/PollingContext', () => ({ usePolling: () => ({ isPollingEnabled: true }) }));
vi.mock('../contexts/WalletBalancesContext', () => ({
  useWalletBalances: () => ({ refreshWalletBalances: fns.refreshWalletBalances }),
}));
vi.mock('../components/ui/ToastProvider', () => ({ useToast: () => ({ addToast: fns.addToast }) }));
vi.mock('./useContractInteractions', () => ({ useTokenApproval: () => ({ approve: fns.approve }) }));
vi.mock('../utils/logger', () => ({ log: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

function baseState(stable: AnnihilateStableSymbol = 'USDe', amount = '10'): ForgeAnnihilateState {
  return {
    active: true,
    paused: false,
    walletAntimatter: 100,
    stableBalances: { USDC: 100, USDe: 100, DOLA: 100 },
    price: 1,
    gateReason: null,
    priceGated: false,
    stable,
    setStable: vi.fn(),
    amount,
    setAmount: vi.fn(),
    phusdOut: 20,
    minPhusdOut: 19.9,
    needsApproval: false,
    pendingAction: null,
    approve: vi.fn(),
    annihilate: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.booster = BOOSTER;
  state.bps = 1000n;
  state.paused = false;
  // Anvil wiring: USDe eligible, USDC and DOLA AboveThreshold (reason 3).
  state.eligibility = [ineligible(3), eligible(), ineligible(3)];
  state.quote = eligible(20n * ONE, 2n * ONE);
  state.freshQuote = undefined;
  state.amAllowance = 0n;
  state.stableAllowance = 0n;
  state.enabled = {};
  state.quoteArgs = undefined;
  fns.approve.mockResolvedValue('0xa99');
  fns.writeContractAsync.mockResolvedValue('0xb99');
});

describe('useForgeAnnihilateBoost — reads', () => {
  it('booster not live → every read disabled, boost unavailable', () => {
    state.booster = zeroAddress;
    const { result } = renderHook(() => useForgeAnnihilateBoost(baseState()));
    expect(result.current.live).toBe(false);
    expect(result.current.unavailableReason).toBe(BOOST_NOT_LIVE);
    expect(result.current.eligibleStables).toEqual([]);
    expect(result.current.isEligible('USDe')).toBe(false);
    expect(Object.values(state.enabled).every((e) => e === false)).toBe(true);
  });

  it('boostBps 1000 → 10%; fractional bps stay fractional', () => {
    const { result, rerender } = renderHook(() => useForgeAnnihilateBoost(baseState()));
    expect(result.current.boostBps).toBe(1000);
    expect(result.current.boostPct).toBe(10);
    state.bps = 1250n;
    rerender();
    expect(result.current.boostPct).toBe(12.5);
  });

  it('eligibility per stable comes from previewBoost(stable, 0)', () => {
    const { result } = renderHook(() => useForgeAnnihilateBoost(baseState('USDC')));
    expect(result.current.eligibleStables).toEqual(['USDe']);
    expect(result.current.isEligible('USDC')).toBe(false);
    expect(result.current.reasonFor('USDC')).toBe('Not low on protocol-owned liquidity');
    expect(result.current.reasonFor('USDe')).toBeNull();
    expect(result.current.unavailableReason).toBe('Not low on protocol-owned liquidity');
  });

  it('paused booster → unavailable with "Boost paused"', () => {
    state.paused = true;
    const { result } = renderHook(() => useForgeAnnihilateBoost(baseState()));
    expect(result.current.unavailableReason).toBe(BOOST_PAUSED);
    expect(result.current.eligibleStables).toEqual([]);
  });

  it('an amount-specific ineligible quote surfaces its reason', () => {
    state.quote = ineligible(11);
    const { result } = renderHook(() => useForgeAnnihilateBoost(baseState()));
    expect(result.current.unavailableReason).toBe('Daily phUSD mint cap reached');
    expect(result.current.minOutWei).toBeUndefined();
  });

  it('quotes previewBoost(selectedStable, amountWei); minOutWei is (base + bonus) less 50 bps', () => {
    const { result } = renderHook(() => useForgeAnnihilateBoost(baseState('USDe', '10')));
    expect(state.quoteArgs).toEqual([USDE, 10n * ONE]);
    expect(result.current.expectedBase).toBe(20);
    expect(result.current.expectedBonus).toBe(2);
    // (20 + 2) × 9950 / 10000 = 21.89
    expect(result.current.minOutWei).toBe((22n * ONE * 9950n) / 10_000n);
    expect(result.current.minPhusdOut).toBeCloseTo(21.89, 10);
  });
});

describe('useForgeAnnihilateBoost — approvals', () => {
  it('both allowances short → both approvals needed', () => {
    const { result } = renderHook(() => useForgeAnnihilateBoost(baseState()));
    expect(result.current.needsAmApproval).toBe(true);
    expect(result.current.needsStableApproval).toBe(true);
  });

  it('USDC allowance is compared in 6 decimals, Antimatter in 18', () => {
    state.amAllowance = 10n * ONE;
    state.stableAllowance = 10_000_000n; // 10 USDC
    const { result } = renderHook(() => useForgeAnnihilateBoost(baseState('USDC', '10')));
    expect(result.current.needsAmApproval).toBe(false);
    expect(result.current.needsStableApproval).toBe(false);
    state.stableAllowance = 9_999_999n;
    const { result: short } = renderHook(() => useForgeAnnihilateBoost(baseState('USDC', '10')));
    expect(short.current.needsStableApproval).toBe(true);
  });

  it('approveAntimatter / approveStable max-approve to the booster', async () => {
    const { result } = renderHook(() => useForgeAnnihilateBoost(baseState()));
    await act(async () => {
      await result.current.approveAntimatter();
    });
    expect(fns.approve).toHaveBeenLastCalledWith(ANTIMATTER, BOOSTER, maxUint256);
    await act(async () => {
      await result.current.approveStable();
    });
    expect(fns.approve).toHaveBeenLastCalledWith(USDE, BOOSTER, maxUint256);
  });
});

describe('useForgeAnnihilateBoost — boostedAnnihilate', () => {
  it('calls boostedAnnihilate(stable, wallet, amountWei, minOutWei) on the booster with the merged ABI', async () => {
    state.amAllowance = maxUint256;
    state.stableAllowance = maxUint256;
    const { result } = renderHook(() => useForgeAnnihilateBoost(baseState('USDe', '10')));
    await act(async () => {
      await result.current.boostedAnnihilate();
    });
    expect(fns.writeContractAsync).toHaveBeenCalledTimes(1);
    expect(fns.writeContractAsync).toHaveBeenCalledWith({
      address: BOOSTER,
      abi: BOOSTER_WRITE_ABI,
      functionName: 'boostedAnnihilate',
      args: [USDE, WALLET, 10n * ONE, (22n * ONE * 9950n) / 10_000n],
    });
  });

  it('pre-sign re-check: an ineligible refetch blocks the write and names the reason', async () => {
    state.freshQuote = ineligible(3);
    const { result } = renderHook(() => useForgeAnnihilateBoost(baseState('USDe', '10')));
    await act(async () => {
      await result.current.boostedAnnihilate();
    });
    expect(fns.writeContractAsync).not.toHaveBeenCalled();
    expect(fns.addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Boost No Longer Available',
        description: expect.stringContaining('Not low on protocol-owned liquidity'),
      }),
    );
    expect(result.current.pendingAction).toBeNull();
  });

  it('pre-sign re-check signs the refreshed minimum, not the stale one', async () => {
    state.freshQuote = eligible(20n * ONE, 1n * ONE);
    const { result } = renderHook(() => useForgeAnnihilateBoost(baseState('USDe', '10')));
    await act(async () => {
      await result.current.boostedAnnihilate();
    });
    expect(fns.writeContractAsync.mock.calls[0][0].args[3]).toBe((21n * ONE * 9950n) / 10_000n);
  });

  it('does nothing while the base gate is closed', async () => {
    const { result } = renderHook(() =>
      useForgeAnnihilateBoost({ ...baseState(), gateReason: 'Annihilation is paused.' }),
    );
    await act(async () => {
      await result.current.boostedAnnihilate();
    });
    expect(fns.writeContractAsync).not.toHaveBeenCalled();
  });
});
