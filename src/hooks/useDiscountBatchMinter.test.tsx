import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { encodeAbiParameters, encodeEventTopics, zeroAddress } from 'viem';
import { batchNftMinterNudgeDiscountAbi } from '@behodler/phase2-wagmi-hooks';
import { useDiscountBatchMinter, maxPaymentFor } from './useDiscountBatchMinter';

const WALLET = '0x00000000000000000000000000000000000000a1';
const MINTER = '0x4914000000000000000000000000000000089c1a';
const USDS = '0x00000000000000000000000000000000000000d5';
const BONUS = [
  '0x00000000000000000000000000000000000000b1',
  '0x00000000000000000000000000000000000000b2',
] as const;
const ONE = 10n ** 18n;

type Reads = readonly unknown[];

/** previewBatch, previewBoost, discountPercent, cap, perPoint, maxBoost, dispatcherIndex, paused, bonusTokens. */
function reads({
  free = 12n,
  total = 24n,
  paid = 12n,
  paidCost = 1_200n * ONE,
  boost = 0,
  effective = 50,
  discountPercent = 50,
  cap = 50n,
  perPoint = 3n,
  maxBoost = 0,
  dispatcherIndex = 4n,
  paused = false,
  bonus = BONUS as readonly string[],
} = {}): Reads {
  return [
    [free, total, paid, paidCost, 0n, 999n * ONE, 7_000_000n],
    [0n, boost, effective, 1_000_000n],
    discountPercent,
    cap,
    perPoint,
    maxBoost,
    dispatcherIndex,
    paused,
    bonus,
  ];
}

const state = vi.hoisted(() => ({
  minter: '' as string,
  wallet: '' as string | undefined,
  reads: undefined as Reads | undefined,
  freshReads: undefined as Reads | undefined,
  readsEnabled: [] as (boolean | undefined)[],
  balance: undefined as bigint | undefined,
  allowance: 0n,
  receiptLogs: [] as unknown[],
  receiptStatus: 'success',
}));

const fns = vi.hoisted(() => ({
  writeContractAsync: vi.fn(),
  approve: vi.fn(),
  addToast: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  refetchMinterView: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: state.wallet }),
  usePublicClient: () => ({ waitForTransactionReceipt: fns.waitForTransactionReceipt }),
  useWriteContract: () => ({ writeContractAsync: fns.writeContractAsync }),
  useReadContracts: ({ query }: { query?: { enabled?: boolean } }) => {
    state.readsEnabled.push(query?.enabled);
    // Mirrors wagmi: a disabled query never resolves data.
    if (query?.enabled === false) return { data: undefined, refetch: vi.fn() };
    return {
      data: state.reads,
      refetch: vi.fn(async () => {
        if (state.freshReads) state.reads = state.freshReads;
        return { data: state.reads };
      }),
    };
  },
}));

vi.mock('../contexts/ContractAddressContext', () => ({
  useContractAddresses: () => ({
    addresses: { NudgeDiscountBatchMinter: state.minter, USDS, USDC: '0x00000000000000000000000000000000000000c6' },
    networkType: 'local',
  }),
}));
vi.mock('../contexts/PollingContext', () => ({ usePolling: () => ({ isPollingEnabled: true }) }));
vi.mock('../components/ui/ToastProvider', () => ({ useToast: () => ({ addToast: fns.addToast }) }));
vi.mock('./useMinterPageView', () => ({
  useMinterPageView: () => ({
    data: {
      // A decoy row on a different index: matching must be by dispatcherIndex.
      USDC: { priceRaw: 5n * 10n ** 6n, growthBasisPoints: 0, dispatcherIndex: 5, decimals: 6 },
      USDS: { priceRaw: 100n * ONE, growthBasisPoints: 10, dispatcherIndex: 4, decimals: 18 },
    },
    refetch: fns.refetchMinterView,
  }),
}));
vi.mock('./useContractInteractions', () => ({
  useTokenBalance: () => ({ balance: state.balance, refetch: vi.fn() }),
  useTokenAllowance: () => ({
    allowance: state.allowance,
    refetch: vi.fn(async () => ({ data: state.allowance })),
  }),
  useTokenApproval: () => ({ approve: fns.approve }),
}));
vi.mock('../utils/logger', () => ({
  log: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function batchMintedLog(free: bigint, paid: bigint) {
  return {
    address: MINTER,
    topics: encodeEventTopics({
      abi: batchNftMinterNudgeDiscountAbi,
      eventName: 'BatchMinted',
      args: { recipient: WALLET },
    }),
    data: encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
      [free, paid, 1n, 2n, 3n]
    ),
    blockHash: '0x' + '11'.repeat(32),
    blockNumber: 1n,
    logIndex: 0,
    transactionHash: '0x' + '22'.repeat(32),
    transactionIndex: 0,
    removed: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.minter = MINTER;
  state.wallet = WALLET;
  state.reads = reads();
  state.freshReads = undefined;
  state.readsEnabled = [];
  state.balance = 10_000n * ONE;
  state.allowance = 0n;
  state.receiptLogs = [batchMintedLog(12n, 12n)];
  fns.approve.mockResolvedValue('0xa99');
  fns.writeContractAsync.mockResolvedValue('0xb99');
  fns.waitForTransactionReceipt.mockImplementation(async ({ hash }: { hash: string }) => ({
    status: state.receiptStatus,
    logs: hash === '0xb99' ? state.receiptLogs : [],
  }));
  state.receiptStatus = 'success';
});

describe('useDiscountBatchMinter — reads', () => {
  it('zero address → unavailable, reads disabled', () => {
    state.minter = zeroAddress;
    const { result } = renderHook(() => useDiscountBatchMinter());
    expect(result.current.status).toBe('unavailable');
    expect(result.current.quote).toBeUndefined();
    expect(state.readsEnabled.every((e) => e === false)).toBe(true);
  });

  it('loading until the reads resolve', () => {
    state.reads = undefined;
    const { result } = renderHook(() => useDiscountBatchMinter());
    expect(result.current.status).toBe('loading');
  });

  it('ready: quote from previewBatch/previewBoost, payment matched by dispatcherIndex', () => {
    const { result } = renderHook(() => useDiscountBatchMinter());
    const r = result.current;
    expect(r.status).toBe('ready');
    expect(r.quote).toMatchObject({ total: 24, free: 12, paid: 12, totalRaw: 24n, boost: 0, paidCostRaw: 1_200n * ONE });
    // Boost 0 → effective % is the base discountPercent.
    expect(r.quote?.effectivePercent).toBe(50);
    expect(r.config).toMatchObject({ discountPercent: 50, maxFreePerBatch: 50, overflowNFTsPerBoostPoint: 3, maxBoost: 0, dispatcherIndex: 4, paused: false });
    expect(r.payment).toMatchObject({ address: USDS, symbol: 'USDS', decimals: 18, priceRaw: 100n * ONE, growthBps: 10 });
    expect(r.maxPaymentRaw).toBe(1_224n * ONE);
    expect(r.blocker).toBeNull();
  });

  it('boosted: effective % comes from previewBoost', () => {
    state.reads = reads({ free: 50n, total: 84n, paid: 34n, boost: 10, effective: 60, maxBoost: 10 });
    const { result } = renderHook(() => useDiscountBatchMinter());
    expect(result.current.quote).toMatchObject({ boost: 10, effectivePercent: 60, total: 84 });
  });

  it('free == 0 → no-discount', () => {
    state.reads = reads({ free: 0n, total: 0n, paid: 0n, paidCost: 0n, effective: 0 });
    const { result } = renderHook(() => useDiscountBatchMinter());
    expect(result.current.status).toBe('no-discount');
    expect(result.current.blocker).toBe('no-discount');
  });

  it('paused → paused blocker', () => {
    state.reads = reads({ paused: true });
    const { result } = renderHook(() => useDiscountBatchMinter());
    expect(result.current.blocker).toBe('paused');
  });

  it('disconnected → disconnected blocker', () => {
    state.wallet = undefined;
    const { result } = renderHook(() => useDiscountBatchMinter());
    expect(result.current.blocker).toBe('disconnected');
  });

  it('balance below maxPayment (not just paidCost) → insufficient-balance', () => {
    state.balance = 1_210n * ONE; // covers paidCost (1,200) but not the 1,224 budget
    const { result } = renderHook(() => useDiscountBatchMinter());
    expect(result.current.blocker).toBe('insufficient-balance');
  });

  it('maxPaymentFor adds 2%', () => {
    expect(maxPaymentFor(10_000n)).toBe(10_200n);
  });
});

describe('useDiscountBatchMinter — mint', () => {
  it('approves maxPayment when the allowance is short, then batchMints with live args', async () => {
    const { result } = renderHook(() => useDiscountBatchMinter());
    await act(async () => {
      await result.current.mint();
    });

    const maxPayment = maxPaymentFor(1_200n * ONE);
    expect(fns.approve).toHaveBeenCalledWith(USDS, MINTER, maxPayment);
    expect(fns.writeContractAsync).toHaveBeenCalledTimes(1);
    const call = fns.writeContractAsync.mock.calls[0][0];
    expect(call.address).toBe(MINTER);
    expect(call.functionName).toBe('batchMint');
    expect(call.args).toEqual([24n, 0, WALLET, maxPayment, BONUS, [0n, 0n]]);
    expect(fns.approve.mock.invocationCallOrder[0]).toBeLessThan(
      fns.writeContractAsync.mock.invocationCallOrder[0]
    );

    const success = fns.addToast.mock.calls.map((c) => c[0]).find((t) => t.type === 'success' && t.title === 'Discount Batch Minted');
    expect(success.description).toBe('24 NFTs minted: 12 covered by the discount fund, 12 paid.');
    expect(success.action.label).toBe('View Transaction');
    expect(fns.refetchMinterView).toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });

  it('skips the approval when the allowance already covers maxPayment', async () => {
    state.allowance = maxPaymentFor(1_200n * ONE);
    const { result } = renderHook(() => useDiscountBatchMinter());
    await act(async () => {
      await result.current.mint();
    });
    expect(fns.approve).not.toHaveBeenCalled();
    expect(fns.writeContractAsync).toHaveBeenCalledTimes(1);
  });

  it('passes the live boost as quotedBoost and the live bonus order', async () => {
    const bonus = [BONUS[1], BONUS[0], '0x00000000000000000000000000000000000000b3'];
    state.reads = reads({ free: 50n, total: 84n, paid: 34n, paidCost: 3_400n * ONE, boost: 10, effective: 60, maxBoost: 10, bonus });
    state.allowance = 10n ** 30n;
    const { result } = renderHook(() => useDiscountBatchMinter());
    await act(async () => {
      await result.current.mint();
    });
    expect(fns.writeContractAsync.mock.calls[0][0].args).toEqual([
      84n,
      10,
      WALLET,
      maxPaymentFor(3_400n * ONE),
      bonus,
      [0n, 0n, 0n],
    ]);
  });

  it('changed total on the pre-sign re-read → no transaction, warning toast', async () => {
    state.freshReads = reads({ free: 13n, total: 26n, paid: 13n });
    const { result } = renderHook(() => useDiscountBatchMinter());
    await act(async () => {
      await result.current.mint();
    });
    expect(fns.approve).not.toHaveBeenCalled();
    expect(fns.writeContractAsync).not.toHaveBeenCalled();
    expect(fns.addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning', title: 'Batch Updated' }));
  });

  it('changed boost (same total) on the pre-sign re-read → no transaction', async () => {
    state.freshReads = reads({ boost: 1, effective: 51 });
    const { result } = renderHook(() => useDiscountBatchMinter());
    await act(async () => {
      await result.current.mint();
    });
    expect(fns.writeContractAsync).not.toHaveBeenCalled();
    expect(fns.addToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Batch Updated' }));
  });

  it('does nothing while blocked', async () => {
    state.reads = reads({ paused: true });
    const { result } = renderHook(() => useDiscountBatchMinter());
    await act(async () => {
      await result.current.mint();
    });
    expect(fns.writeContractAsync).not.toHaveBeenCalled();
  });

  it('a reverted mint receipt raises an error toast, not success', async () => {
    state.allowance = 10n ** 30n;
    state.receiptStatus = 'reverted';
    const { result } = renderHook(() => useDiscountBatchMinter());
    await act(async () => {
      await result.current.mint();
    });
    const titles = fns.addToast.mock.calls.map((c) => c[0].title);
    expect(titles).toContain('Mint Failed');
    expect(titles).not.toContain('Discount Batch Minted');
  });
});
