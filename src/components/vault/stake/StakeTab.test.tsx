import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import StakeTab from './StakeTab';

// ---------------------------------------------------------------------------
// Mock the real phUSD pool hook. StakeTab's phUSD section is wired to on-chain
// contracts via usePhUsdStakePool, which depends on wagmi + several contexts.
// For the Stake-surface rendering/interaction assertions we stub it with a
// static pool snapshot; the mock stable pools (useMockStablePools) use only
// local state + the real toast provider, so they run unmocked.
// ---------------------------------------------------------------------------
const phUsdFixture = vi.hoisted(() => ({
  stake: vi.fn().mockResolvedValue(undefined),
  withdraw: vi.fn().mockResolvedValue(undefined),
  claim: vi.fn().mockResolvedValue(undefined),
  approve: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../hooks/usePhUsdStakePool', () => ({
  usePhUsdStakePool: () => ({
    walletBalance: 580.42,
    stakedBalance: 1250,
    pendingRewards: 3.214,
    ratePerSecond: 0.0000087,
    apy: 8.42,
    needsApproval: () => false,
    isPaused: false,
    phUsdMarketPrice: 1.0,
    stake: phUsdFixture.stake,
    withdraw: phUsdFixture.withdraw,
    claim: phUsdFixture.claim,
    approve: phUsdFixture.approve,
    txPending: null,
    isLoading: false,
  }),
}));

function renderStakeTab() {
  return render(
    <ToastProvider>
      <StakeTab />
    </ToastProvider>
  );
}

describe('StakeTab (Story 068)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the phUSD framed section and 3 stable rows', () => {
    renderStakeTab();

    // phUSD framed section header (stake phUSD → earn USDC).
    expect(screen.getByText('Stake phUSD · earn USDC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'phUSD pool' })).toBeInTheDocument();

    // Stable pool group + the three stable rows (targeted by row aria-label).
    expect(screen.getByText('Stake stables · earn phUSD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'USDC pool' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'USDe pool' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DOLA pool' })).toBeInTheDocument();
  });

  it('expanding a stable row and submitting a mock stake updates its balance', async () => {
    const user = userEvent.setup();
    renderStakeTab();

    // Collapse the default-open phUSD row first so only the USDC row's
    // expanded panel is present, then expand the USDC row.
    await user.click(screen.getByRole('button', { name: 'phUSD pool' }));
    await user.click(screen.getByRole('button', { name: 'USDC pool' }));

    // The expanded panel shows a Stake amount field. Enter an amount.
    const stakeInput = await screen.findByPlaceholderText('0.00');
    await user.type(stakeInput, '100');

    // The USDC starting staked balance is 5,000. Submit the stake.
    const stakeButton = screen.getByRole('button', { name: /Stake USDC → Earn phUSD/ });
    await user.click(stakeButton);

    // After the simulated tx (~1.4s) + optimistic update, staked balance
    // becomes 5,100. Assert the new staked value renders in the row header.
    const newStaked = await screen.findByText('5,100', {}, { timeout: 3000 });
    expect(newStaked).toBeInTheDocument();
  });
});
