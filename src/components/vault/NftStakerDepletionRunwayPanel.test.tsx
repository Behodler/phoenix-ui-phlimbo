import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The depletion panel drives every stat off a per-functionName useReadContract
// call, so the fixture is just a functionName → value map that each scenario
// tweaks before rendering.

const STAKER = '0xStaker00000000000000000000000000000000000';
const PHUSD = '0xPhUSD000000000000000000000000000000000000';
const WALLET = '0xWallet0000000000000000000000000000000000';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

// A fixed "now" so the windowEnd countdown is deterministic.
const NOW_SECONDS = 1_800_000_000;

const fixture = vi.hoisted(() => ({
  reads: {} as Record<string, unknown>,
  reset() {
    this.reads = {
      runwaySeconds: 864_000n, // 10 days
      currentRewardRate: 1_000_000_000_000_000n, // 0.001 phUSD/sec
      rewardBudget: 500_000_000_000_000_000_000n, // 500 phUSD
      committedDebt: 25_000_000_000_000_000_000n, // 25 phUSD
      totalBudget: 525_000_000_000_000_000_000n, // 525 phUSD
      totalDebt: 30_000_000_000_000_000_000n, // 30 phUSD
      totalStaked: 7n,
      depletionWindowMonths: 12n,
      windowEnd: BigInt(1_800_000_000 + 5 * 86_400), // 5 days out
      poolState: 0,
      owner: '0xWallet0000000000000000000000000000000000',
      allowance: 0n,
    };
  },
}));

const addToastMock = vi.fn();
vi.mock('../ui/ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

const writeContractAsyncMock = vi.fn();

vi.mock('wagmi', async () => {
  const actual = await vi.importActual<typeof import('wagmi')>('wagmi');
  return {
    ...actual,
    useAccount: () => ({ address: WALLET, isConnected: true }),
    useReadContract: (config: { functionName?: string }) => ({
      data: config?.functionName ? fixture.reads[config.functionName] : undefined,
      refetch: vi.fn(),
    }),
    useWriteContract: () => ({ writeContractAsync: writeContractAsyncMock }),
    useWaitForTransactionReceipt: () => ({ isSuccess: false }),
  };
});

import NftStakerDepletionRunwayPanel from './NftStakerDepletionRunwayPanel';

const renderPanel = (stakerAddress: string | undefined = STAKER) =>
  render(
    <NftStakerDepletionRunwayPanel
      title="EYE NFT Staker — Runway"
      stakerAddress={stakerAddress as `0x${string}` | undefined}
      phUsdAddress={PHUSD as `0x${string}`}
      stakerLabel="UniboostStakerEYE"
      idPrefix="eye-nft-staker"
    />,
  );

describe('NftStakerDepletionRunwayPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.reset();
    vi.spyOn(Date, 'now').mockReturnValue(NOW_SECONDS * 1000);
  });

  it('renders the depletion stats and omits the fixed-staker-only rows', () => {
    renderPanel();

    expect(screen.getByText('10.00 days')).toBeInTheDocument(); // runway
    expect(screen.getByText('5.00 days')).toBeInTheDocument(); // window ends in
    expect(screen.getByText('12 months')).toBeInTheDocument();
    expect(screen.getByText('500.00 phUSD')).toBeInTheDocument(); // reward budget
    expect(screen.getByText('25.00 phUSD')).toBeInTheDocument(); // committed debt
    expect(screen.getByText('Active')).toBeInTheDocument();

    // A depletion staker has no target APY, and no separate minimum runway:
    // the rate does not scale with stake, so the runway above is the worst case.
    expect(screen.queryByText('Target APY:')).not.toBeInTheDocument();
    expect(screen.queryByText('Minimum Runway:')).not.toBeInTheDocument();
  });

  it('shows Depleted once windowEnd has passed', () => {
    fixture.reads.windowEnd = BigInt(NOW_SECONDS - 60);
    renderPanel();

    expect(screen.getByText('Depleted')).toBeInTheDocument();
  });

  it('flags a migrating pool', () => {
    fixture.reads.poolState = 1;
    renderPanel();

    expect(screen.getByText('Migrating')).toBeInTheDocument();
  });

  it('reports an undeployed staker instead of rendering stats', () => {
    renderPanel(ZERO_ADDR);

    expect(screen.getByText(/not deployed on this chain/)).toBeInTheDocument();
    expect(screen.queryByTestId('eye-nft-staker-topup-amount')).not.toBeInTheDocument();
  });

  it('asks for approval first when allowance is short of the entered amount', async () => {
    renderPanel();

    await userEvent.type(screen.getByTestId('eye-nft-staker-topup-amount'), '100');

    const button = screen.getByRole('button', { name: /Approve phUSD/ });
    await userEvent.click(button);

    expect(writeContractAsyncMock).toHaveBeenCalledTimes(1);
    const call = writeContractAsyncMock.mock.calls[0][0];
    expect(call.functionName).toBe('approve');
    expect(call.address).toBe(PHUSD);
    // Approve is for the exact entered amount, at 18dp.
    expect(call.args).toEqual([STAKER, 100_000_000_000_000_000_000n]);
  });

  it('tops up the staker once allowance covers the amount', async () => {
    fixture.reads.allowance = 10_000_000_000_000_000_000_000n;
    renderPanel();

    await userEvent.type(screen.getByTestId('eye-nft-staker-topup-amount'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Top Up' }));

    expect(writeContractAsyncMock).toHaveBeenCalledTimes(1);
    const call = writeContractAsyncMock.mock.calls[0][0];
    expect(call.functionName).toBe('topUp');
    expect(call.address).toBe(STAKER);
    expect(call.args).toEqual([100_000_000_000_000_000_000n]);
  });

  it('disables Top Up and warns when the wallet is not the staker owner', async () => {
    fixture.reads.owner = '0xSomeoneElse00000000000000000000000000000';
    fixture.reads.allowance = 10_000_000_000_000_000_000_000n;
    renderPanel();

    await userEvent.type(screen.getByTestId('eye-nft-staker-topup-amount'), '100');

    expect(screen.getByRole('button', { name: 'Top Up' })).toBeDisabled();
    expect(screen.getByText(/is not the UniboostStakerEYE owner/)).toBeInTheDocument();
  });
});
