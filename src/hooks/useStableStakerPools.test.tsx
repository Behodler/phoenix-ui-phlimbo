import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { zeroAddress } from 'viem';
import { useStableStakerPools, ANNIHILATE_PRICE_FLOOR } from './useStableStakerPools';

// ---------------------------------------------------------------------------
// The repo's convention is to `vi.mock` the wagmi surface rather than render
// real providers: these tests are about the hook's decision logic, not about
// RPC plumbing. `useReadContract` is dispatched on `functionName`, so each test
// states only the chain values it actually cares about.
//
// The annihilate price gate is the reason this file exists. It must read the
// RAW `useBalancerPrice()` result, never the repo's `?? 1.0` display clamp — a
// clamp would turn a price-feed failure into an OPEN gate, which is exactly the
// state that destroys user principal for no return. So the price is stubbed
// here rather than exercised against Anvil, where the absent Balancer pool
// always falls back to 1.0 and the disabled states are unreachable.
// ---------------------------------------------------------------------------

const STAKER = '0x00000000000000000000000000000000000000aa' as const;
const ANTIMATTER = '0x00000000000000000000000000000000000000bb' as const;
const WALLET = '0x00000000000000000000000000000000000000cc' as const;

/** Chain values the mocked `useReadContract` serves, per test. */
let chain: Record<string, unknown>;
let chainId: number;
let rawPrice: number | null;
let stakerAddress: string;

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: WALLET }),
  useChainId: () => chainId,
  useReadContract: ({ functionName, address, args, query }: {
    functionName: string;
    address?: string;
    args?: unknown[];
    query?: { enabled?: boolean };
  }) => {
    // Mirrors wagmi: a disabled query never resolves data. This is what the
    // zero-address guard relies on, so the mock must honour it.
    if (query?.enabled === false || !address) return { data: undefined, isLoading: false, refetch: vi.fn() };
    // A chain entry may be a function of the call's args. `toStableAmount` is
    // read twice per pool (pending reward, and the annual emission that feeds
    // the APY), so dispatching on functionName alone is not enough.
    const entry = chain[functionName];
    const data = typeof entry === 'function' ? (entry as (a: unknown[]) => unknown)(args ?? []) : entry;
    return { data, isLoading: false, refetch: vi.fn() };
  },
  useWriteContract: () => ({ data: undefined, writeContractAsync: vi.fn() }),
  useWaitForTransactionReceipt: () => ({ isSuccess: false }),
}));

vi.mock('../contexts/ContractAddressContext', () => ({
  useContractAddresses: () => ({
    addresses: {
      StableStakerV2: stakerAddress,
      Antimatter: ANTIMATTER,
      PhUSD: '0x00000000000000000000000000000000000000dd',
      USDC: '0x0000000000000000000000000000000000000101',
      USDe: '0x0000000000000000000000000000000000000102',
      Dola: '0x0000000000000000000000000000000000000103',
      YieldStrategyUSDe: zeroAddress,
    },
    networkType: 'mainnet',
  }),
}));

vi.mock('../components/ui/ToastProvider', () => ({ useToast: () => ({ addToast: vi.fn() }) }));
vi.mock('../contexts/WalletBalancesContext', () => ({
  useWalletBalances: () => ({ refreshWalletBalances: vi.fn() }),
}));
vi.mock('../contexts/PollingContext', () => ({ usePolling: () => ({ isPollingEnabled: true }) }));
vi.mock('./useContractInteractions', () => ({ useTokenApproval: () => ({ approve: vi.fn() }) }));
vi.mock('./useBalancerPrice', () => ({ useBalancerPrice: () => ({ price: rawPrice }) }));
vi.mock('../utils/logger', () => ({
  log: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/**
 * Renders the hook and exposes the USDC pool's decisions as data attributes,
 * which keeps the assertions free of a renderHook dependency.
 */
function Harness() {
  const { pools, antimatterSymbol } = useStableStakerPools(true);
  const usdc = pools[0];
  return (
    <div
      data-testid="usdc"
      data-annihilate-reason={usdc.annihilateDisabledReason ?? ''}
      data-apy={String(usdc.apy)}
      data-inactive={String(usdc.inactive)}
      data-claim-enabled={String(usdc.claimEnabled)}
      data-staked={String(usdc.stakedBalance)}
      data-pending={String(usdc.pendingAntimatter)}
      data-matched={String(usdc.matchedStable)}
      data-symbol={antimatterSymbol}
      data-pool-count={String(pools.length)}
    />
  );
}

const usdcRow = () => screen.getByTestId('usdc');

const USDC_TOKEN = '0x0000000000000000000000000000000000000101';

/**
 * `Antimatter.toStableAmount` as the contract implements it: an 18-dec
 * Antimatter amount rescaled to the stake token's decimals (USDC 6, the rest
 * 18). Stubbed faithfully rather than as a constant because the APY reads it
 * with a different amount than the annihilation preview does — and because a
 * broken 18→6 bridge is a 1e12 error, the one this conversion exists to avoid.
 */
const toStableAmountImpl = (args: unknown[]) => {
  const [token, amount] = args as [string, bigint];
  return token.toLowerCase() === USDC_TOKEN ? amount / 10n ** 12n : amount;
};

/**
 * Antimatter/sec that emits ~100 whole units a year, so against the 1000 USDC
 * pool total below the APY is a round 10% at phUSD = $1. Integer division
 * against SECONDS_PER_YEAR makes it approximate, hence `toBeCloseTo`.
 */
const RATE_FOR_100_PER_YEAR = 3_170_979_198_376n;

/** A funded, healthy USDC pool with 1000 USDC staked pool-wide, 100 staked by the user. */
const healthyChain = (): Record<string, unknown> => ({
  // antimatterPerSecond, accAntimatterPerShare, lastRewardTime, totalStaked
  poolInfo: [RATE_FOR_100_PER_YEAR, 0n, 0n, 1_000_000_000n],
  userInfo: [100_000_000n, 0n], // 100 USDC (6dp)
  pendingReward: 10n * 10n ** 18n, // 10 AM (18dp)
  unclaimedReward: 0n,
  withdrawDisabled: false,
  autoAnnihilateAvailable: true,
  paused: false,
  claimEnabled: true,
  symbol: 'AM',
  balanceOf: 500_000_000n,
  allowance: 0n,
  toStableAmount: toStableAmountImpl,
});

beforeEach(() => {
  chain = healthyChain();
  chainId = 1;
  rawPrice = 1.0;
  stakerAddress = STAKER;
});

describe('useStableStakerPools — the annihilate price gate', () => {
  it('enables annihilation above the floor (p = 0.51)', () => {
    rawPrice = 0.51;
    render(<Harness />);
    expect(usdcRow().dataset.annihilateReason).toBe('');
  });

  it('disables annihilation exactly AT the floor (p = 0.50)', () => {
    // `<=`, not `<`: at exactly $0.50 the user destroys principal for no gain.
    rawPrice = ANNIHILATE_PRICE_FLOOR;
    render(<Harness />);
    expect(usdcRow().dataset.annihilateReason).toContain('returns less value than it destroys');
  });

  it('disables annihilation below the floor (p = 0.49)', () => {
    rawPrice = 0.49;
    render(<Harness />);
    expect(usdcRow().dataset.annihilateReason).toContain('0.4900');
  });

  it('disables annihilation when the price is genuinely unknown on mainnet (p = null)', () => {
    // The repo's display clamp turns null into 1.0. Using it here would open
    // the gate during a price-feed failure — the bug this test pins down.
    rawPrice = null;
    render(<Harness />);
    expect(usdcRow().dataset.annihilateReason).toContain('phUSD price is currently unavailable');
  });

  it('leaves the gate open off mainnet, where the price feed has no pool to read', () => {
    chainId = 31337;
    rawPrice = null;
    render(<Harness />);
    expect(usdcRow().dataset.annihilateReason).toBe('');
  });

  it('respects the contract\'s own autoAnnihilateAvailable flag', () => {
    chain.autoAnnihilateAvailable = false;
    render(<Harness />);
    expect(usdcRow().dataset.annihilateReason).toContain('not available for this pool');
  });
});

describe('useStableStakerPools — reads', () => {
  it('renders three pools and reads the Antimatter symbol off the chain', () => {
    render(<Harness />);
    expect(usdcRow().dataset.poolCount).toBe('3');
    expect(usdcRow().dataset.symbol).toBe('AM');
  });

  it('scales staked balance by the token decimals and Antimatter by 18', () => {
    render(<Harness />);
    expect(usdcRow().dataset.staked).toBe('100');
    expect(usdcRow().dataset.pending).toBe('10');
  });

  it('caps the matched amount at the staked principal using toStableAmount', () => {
    // 5000 AM converts to 5000 USDC, far above the 100 staked.
    chain.pendingReward = 5_000n * 10n ** 18n;
    render(<Harness />);
    expect(usdcRow().dataset.matched).toBe('100');
  });

  it('reduces the APY to the ordinary yield at phUSD = $1', () => {
    // 100 AM/yr against 1000 USDC staked; (2p - 1) = 1 at p = 1.
    render(<Harness />);
    expect(Number(usdcRow().dataset.apy)).toBeCloseTo(10, 3);
  });

  it('applies the (2p - 1) net-yield factor above the break-even price', () => {
    rawPrice = 0.75;
    render(<Harness />);
    // 10% x (1.5 - 1) = 5%
    expect(Number(usdcRow().dataset.apy)).toBeCloseTo(5, 3);
  });

  it('bridges the 18-dec emission to 6-dec USDC — a 1e12 error would be obvious', () => {
    render(<Harness />);
    // The failure mode is 1e12-scale, so the useful assertion is the order of
    // magnitude, not the decimals.
    expect(Number(usdcRow().dataset.apy)).toBeLessThan(1_000);
    expect(Number(usdcRow().dataset.apy)).toBeGreaterThan(0.001);
  });

  it('reports APY as null — never 0 — when the mainnet price is unknown', () => {
    rawPrice = null;
    render(<Harness />);
    expect(usdcRow().dataset.apy).toBe('null');
  });

  it('reports APY as null when the mainnet price is out of the sanity band', () => {
    rawPrice = 5.0;
    render(<Harness />);
    expect(usdcRow().dataset.apy).toBe('null');
  });

  it('falls back to p = 1 off mainnet, where there is no Balancer pool to read', () => {
    chainId = 31337;
    rawPrice = null;
    render(<Harness />);
    expect(Number(usdcRow().dataset.apy)).toBeCloseTo(10, 3);
  });

  it('reports APY as null when the pool has no live staker', () => {
    stakerAddress = zeroAddress;
    render(<Harness />);
    expect(usdcRow().dataset.apy).toBe('null');
  });

  it('surfaces the closed claim gate rather than assuming rewards are claimable', () => {
    // `claimEnabled()` is false by default on StableStakerV2.
    chain.claimEnabled = false;
    render(<Harness />);
    expect(usdcRow().dataset.claimEnabled).toBe('false');
    // Annihilation is unaffected by the claim gate.
    expect(usdcRow().dataset.annihilateReason).toBe('');
  });
});

describe('useStableStakerPools — zero-address guard', () => {
  it('reports rows inactive and issues no reads when StableStakerV2 is the zero address', () => {
    stakerAddress = zeroAddress;
    render(<Harness />);
    const row = usdcRow();
    expect(row.dataset.inactive).toBe('true');
    // No reads issued: the staked/pending figures fall back to zero rather
    // than surfacing whatever the chain mock holds.
    expect(row.dataset.staked).toBe('0');
    expect(row.dataset.pending).toBe('0');
    expect(row.dataset.annihilateReason).toContain('not live on this network');
  });
});

describe('useStableStakerPools — the global pause', () => {
  it('blocks annihilation while the staker is paused', () => {
    chain.paused = true;
    render(<Harness />);
    expect(usdcRow().dataset.annihilateReason).toContain('paused');
  });
});

describe('useStableStakerPools — the APY and the annihilate gate agree', () => {
  // The whole point of the `<=` in the gate and of displaying a negative APY
  // honestly: the user may see the loss, but must never be able to act on it.
  it('never shows a negative APY beside an open annihilate action', () => {
    for (const price of [0.05, 0.25, 0.4, 0.49, 0.5, 0.51, 0.8, 1.0, 1.5]) {
      rawPrice = price;
      const { unmount } = render(<Harness />);
      const row = usdcRow();
      const apy = Number(row.dataset.apy);
      if (apy < 0) {
        expect(row.dataset.annihilateReason).not.toBe('');
      }
      unmount();
    }
  });

  it('shows the negative APY honestly rather than clamping it to zero', () => {
    rawPrice = 0.4;
    render(<Harness />);
    // 10% x (0.8 - 1) = -2%
    expect(Number(usdcRow().dataset.apy)).toBeCloseTo(-2, 3);
    expect(usdcRow().dataset.annihilateReason).toContain('returns less value than it destroys');
  });

  it('is exactly zero at the break-even price, where the gate is already shut', () => {
    rawPrice = ANNIHILATE_PRICE_FLOOR;
    render(<Harness />);
    expect(Number(usdcRow().dataset.apy)).toBe(0);
    expect(usdcRow().dataset.annihilateReason).not.toBe('');
  });
});
