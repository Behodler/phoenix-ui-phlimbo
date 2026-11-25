import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useUserMintPrices, mintPriceStorageKey } from './useUserMintPrices';

const MINTER = '0x39af088408e815844c567037c157b31d48d2e10f';
const OTHER_MINTER = '0x00000000000000000000000000000000000000ee';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const USDS = '0xdc035d45d973e3ec169d2276ddab16f1e407384f';
const ALICE = '0x00000000000000000000000000000000000000a1';
const BOB = '0x00000000000000000000000000000000000000b2';
const SNAPSHOT_BLOCK = 1_000;

const state = vi.hoisted(() => ({
  wallet: undefined as string | undefined,
  chainId: 1,
  minter: '' as string,
  latest: 0n,
}));

const fns = vi.hoisted(() => ({
  getLogs: vi.fn(),
  getBlockNumber: vi.fn(),
}));

vi.mock('../data/nftMintPriceSnapshot.mainnet.json', () => ({
  default: {
    chainId: 1,
    minter: '0x39af088408e815844c567037c157b31d48d2e10f',
    fromBlock: 900,
    snapshotBlock: 1_000,
    users: {
      '0x00000000000000000000000000000000000000a1': [
        // $10 in USDC, $20 in USDS.
        { index: 4, token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', pricePaid: '10000000' },
        { index: 7, token: '0xdc035d45d973e3ec169d2276ddab16f1e407384f', pricePaid: '20000000000000000000' },
      ],
    },
  },
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: state.wallet }),
  useChainId: () => state.chainId,
  usePublicClient: () => publicClient,
}));

// Stable reference, as wagmi returns for a fixed chain.
const publicClient = { getLogs: fns.getLogs, getBlockNumber: fns.getBlockNumber };

vi.mock('../contexts/ContractAddressContext', () => ({
  useContractAddresses: () => ({
    addresses: { NFTMinter: state.minter, USDC, USDS },
  }),
}));

vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

function claimLog(recipient: string, index: number, token: string, pricePaid: bigint, block: number, logIndex = 0) {
  return {
    args: { recipient, dispatcherIndex: BigInt(index), token, pricePaid },
    blockNumber: BigInt(block),
    logIndex,
  };
}

async function settle(result: { current: ReturnType<typeof useUserMintPrices> }) {
  await waitFor(() => expect(result.current.isLoading).toBe(false));
}

beforeEach(() => {
  localStorage.clear();
  fns.getLogs.mockReset();
  fns.getBlockNumber.mockReset();
  state.wallet = ALICE;
  state.chainId = 1;
  state.minter = MINTER;
  state.latest = 1_100n;
  fns.getBlockNumber.mockImplementation(async () => state.latest);
  fns.getLogs.mockResolvedValue([]);
});

describe('useUserMintPrices', () => {
  it('blob only: no new logs → blob prices, one tail getLogs from B+1', async () => {
    const { result } = renderHook(() => useUserMintPrices());
    await waitFor(() => expect(result.current.pricesByIndex.get(4)).toEqual([10]));
    await settle(result);
    expect(result.current.pricesByIndex.get(7)).toEqual([20]);
    expect(result.current.isUnavailable).toBe(false);

    expect(fns.getLogs).toHaveBeenCalledTimes(1);
    const call = fns.getLogs.mock.calls[0][0];
    expect(call.address).toBe(MINTER);
    expect(call.args).toEqual({ recipient: ALICE });
    expect(call.fromBlock).toBe(BigInt(SNAPSHOT_BLOCK + 1));
    expect(call.toBlock).toBe(1_100n);
  });

  it('appends the tail and caches only entries up to latest − 12', async () => {
    fns.getLogs.mockResolvedValue([
      claimLog(ALICE, 4, USDC, 12_000_000n, 1_050),
      claimLog(ALICE, 4, USDC, 14_000_000n, 1_095), // within 12 blocks of 1_100 → memory only
    ]);
    const { result } = renderHook(() => useUserMintPrices());
    await waitFor(() => expect(result.current.pricesByIndex.get(4)).toEqual([10, 12, 14]));

    const stored = JSON.parse(localStorage.getItem(mintPriceStorageKey(1, MINTER, ALICE))!);
    expect(stored.lastBlock).toBe(1_088);
    expect(stored.entries).toEqual([
      { index: 4, token: USDC, pricePaid: '12000000', blockNumber: 1_050, logIndex: 0 },
    ]);
  });

  it('a second run starts from the cached lastBlock + 1 and keeps cached entries', async () => {
    localStorage.setItem(
      mintPriceStorageKey(1, MINTER, ALICE),
      JSON.stringify({
        lastBlock: 1_088,
        entries: [{ index: 4, token: USDC, pricePaid: '12000000', blockNumber: 1_050, logIndex: 0 }],
      }),
    );
    state.latest = 1_200n;
    fns.getLogs.mockResolvedValue([claimLog(ALICE, 4, USDC, 14_000_000n, 1_095)]);

    const { result } = renderHook(() => useUserMintPrices());
    await waitFor(() => expect(result.current.pricesByIndex.get(4)).toEqual([10, 12, 14]));
    expect(fns.getLogs.mock.calls[0][0].fromBlock).toBe(1_089n);

    const stored = JSON.parse(localStorage.getItem(mintPriceStorageKey(1, MINTER, ALICE))!);
    expect(stored.lastBlock).toBe(1_188);
    expect(stored.entries).toHaveLength(2);
  });

  it('getLogs throws → isUnavailable, still returns blob + cache', async () => {
    localStorage.setItem(
      mintPriceStorageKey(1, MINTER, ALICE),
      JSON.stringify({
        lastBlock: 1_088,
        entries: [{ index: 4, token: USDC, pricePaid: '12000000', blockNumber: 1_050, logIndex: 0 }],
      }),
    );
    fns.getLogs.mockRejectedValue(new Error('range too wide'));

    const { result } = renderHook(() => useUserMintPrices());
    await waitFor(() => expect(result.current.isUnavailable).toBe(true));
    expect(result.current.pricesByIndex.get(4)).toEqual([10, 12]);
    expect(result.current.pricesByIndex.get(7)).toEqual([20]);
  });

  it('ignores the blob on a chain mismatch (same minter address) and scans from earliest off mainnet', async () => {
    state.chainId = 11155111;
    const { result } = renderHook(() => useUserMintPrices());
    await settle(result);
    expect(result.current.pricesByIndex.size).toBe(0);
    expect(fns.getLogs.mock.calls[0][0].fromBlock).toBe('earliest');
    expect(fns.getLogs.mock.calls[0][0].address).toBe(MINTER);
  });

  it('ignores the blob on a minter mismatch and falls back to the mainnet deploy block', async () => {
    state.minter = OTHER_MINTER; // chain 1, but a different minter
    state.latest = 30_000_000n;
    const { result } = renderHook(() => useUserMintPrices());
    await settle(result);
    expect(result.current.pricesByIndex.size).toBe(0);
    expect(fns.getLogs.mock.calls[0][0].fromBlock).toBe(24_923_934n);
  });

  it('wallet change re-keys the cache and reruns once', async () => {
    fns.getLogs.mockResolvedValue([claimLog(ALICE, 4, USDC, 12_000_000n, 1_050)]);
    const { result, rerender } = renderHook(() => useUserMintPrices());
    await waitFor(() => expect(result.current.pricesByIndex.get(4)).toEqual([10, 12]));
    expect(localStorage.getItem(mintPriceStorageKey(1, MINTER, ALICE))).not.toBeNull();

    fns.getLogs.mockResolvedValue([claimLog(BOB, 4, USDC, 30_000_000n, 1_060)]);
    state.wallet = BOB;
    rerender();
    await waitFor(() => expect(result.current.pricesByIndex.get(4)).toEqual([30]));
    expect(result.current.pricesByIndex.get(7)).toBeUndefined();
    expect(fns.getLogs).toHaveBeenCalledTimes(2);
    expect(fns.getLogs.mock.calls[1][0].args).toEqual({ recipient: BOB });
    const bob = JSON.parse(localStorage.getItem(mintPriceStorageKey(1, MINTER, BOB))!);
    expect(bob.entries[0].pricePaid).toBe('30000000');
  });

  it('calls getLogs once per mount — not on re-render or a timer — and again on refresh()', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result, rerender } = renderHook(() => useUserMintPrices());
      await settle(result);
      rerender();
      rerender();
      await act(async () => {
        vi.advanceTimersByTime(60_000); // five 12 s poll intervals
      });
      expect(fns.getLogs).toHaveBeenCalledTimes(1);

      await act(async () => {
        result.current.refresh();
      });
      await settle(result);
      expect(fns.getLogs).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing without a wallet', async () => {
    state.wallet = undefined;
    const { result } = renderHook(() => useUserMintPrices());
    await settle(result);
    expect(fns.getLogs).not.toHaveBeenCalled();
    expect(result.current.pricesByIndex.size).toBe(0);
  });
});
