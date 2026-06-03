import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import StakeTab from './StakeTab';
import type { StableStakeRow, UseStableStakerPools } from '../../../hooks/useStableStakerPools';
import phUSDIcon from '../../../assets/phUSD.png';
import usdcIcon from '../../../assets/usdc-logo.svg';
import usdeIcon from '../../../assets/USDe.png';
import dolaIcon from '../../../assets/sDOLA.png';

// ---------------------------------------------------------------------------
// Both Stake-tab pool layers are real on-chain hooks (wagmi + several contexts).
// For the rendering / interaction assertions we stub them with static
// snapshots: the phUSD panel (usePhUsdStakePool) and the three stable pools
// (useStableStakerPools, story 069). Mocks mirror each hook's real interface.
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

// Stable-pool hook fixture. The default state needs USDC approval (so the
// approve→stake gating test can assert the button flips). USDe is underwater.
const stableFixture = vi.hoisted(() => ({
  stake: vi.fn().mockResolvedValue(undefined),
  withdraw: vi.fn().mockResolvedValue(undefined),
  claim: vi.fn().mockResolvedValue(undefined),
  approve: vi.fn().mockResolvedValue(undefined),
}));

function makeRow(over: Partial<StableStakeRow> & Pick<StableStakeRow, 'id' | 'stakeToken' | 'stakeIcon'>): StableStakeRow {
  return {
    earnToken: 'phUSD',
    earnIcon: phUSDIcon,
    walletBalance: 1000,
    stakedBalance: 500,
    pendingRewards: 0,
    ratePerSecond: 0,
    apy: 6.5,
    pendingDecimals: 18,
    stakePriceUSD: 1.0,
    earnPriceUSD: 1.0,
    liveTicker: true,
    isLegacy: false,
    disabled: false,
    withdrawDisabled: false,
    needsApproval: () => false,
    tagline: 'test pool',
    ...over,
  };
}

let stableReturn: UseStableStakerPools;

vi.mock('../../../hooks/useStableStakerPools', () => ({
  useStableStakerPools: () => stableReturn,
}));

function renderStakeTab() {
  return render(
    <ToastProvider>
      <StakeTab />
    </ToastProvider>
  );
}

describe('StakeTab (Story 069 — real stable pools)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stableReturn = {
      pools: [
        // USDC needs approval (so the approve→stake gating test works).
        makeRow({ id: 'usdc', stakeToken: 'USDC', stakeIcon: usdcIcon, needsApproval: (amt) => parseFloat(amt) > 0 }),
        // USDe is underwater — withdrawals paused.
        makeRow({ id: 'usde', stakeToken: 'USDe', stakeIcon: usdeIcon, withdrawDisabled: true, stakedBalance: 300 }),
        makeRow({ id: 'dola', stakeToken: 'DOLA', stakeIcon: dolaIcon }),
      ],
      pendingAction: null,
      stake: stableFixture.stake,
      withdraw: stableFixture.withdraw,
      claim: stableFixture.claim,
      approve: stableFixture.approve,
      isLoading: false,
    };
  });

  it('renders the phUSD framed section and 3 real stable rows', () => {
    renderStakeTab();

    expect(screen.getByText('Stake phUSD · earn USDC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'phUSD pool' })).toBeInTheDocument();

    expect(screen.getByText('Stake stables · earn phUSD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'USDC pool' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'USDe pool' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DOLA pool' })).toBeInTheDocument();
  });

  it('shows an approve button that flips the stake CTA until approved', async () => {
    const user = userEvent.setup();
    renderStakeTab();

    // Collapse phUSD, expand USDC.
    await user.click(screen.getByRole('button', { name: 'phUSD pool' }));
    await user.click(screen.getByRole('button', { name: 'USDC pool' }));

    const stakeInput = await screen.findByPlaceholderText('0.00');
    await user.type(stakeInput, '100');

    // Because USDC needsApproval(amount) returns true, the CTA reads "Approve".
    const approveBtn = await screen.findByRole('button', { name: /Approve USDC/ });
    await user.click(approveBtn);
    expect(stableFixture.approve).toHaveBeenCalledWith('usdc');
    // Approval path does NOT call stake.
    expect(stableFixture.stake).not.toHaveBeenCalled();
  });

  it('underwater pool: shows the paused status, disables Withdraw, keeps Stake/Claim enabled', async () => {
    const user = userEvent.setup();
    renderStakeTab();

    // The header pill renders for the underwater USDe pool.
    expect(screen.getByText('Withdrawals paused')).toBeInTheDocument();

    // Collapse phUSD, expand USDe.
    await user.click(screen.getByRole('button', { name: 'phUSD pool' }));
    await user.click(screen.getByRole('button', { name: 'USDe pool' }));

    // Withdraw sub-tab: explanatory note + disabled Withdraw button. The
    // sub-tab switcher is a SegmentedControl (role="tab"), so target by tab.
    await user.click(screen.getByRole('tab', { name: 'Withdraw' }));
    expect(screen.getByText(/Withdrawals temporarily paused/i)).toBeInTheDocument();
    const withdrawBtn = screen.getByRole('button', { name: /Withdrawals paused/ });
    expect(withdrawBtn).toBeDisabled();

    // Stake sub-tab control stays enabled (USDe has a wallet balance, no approval).
    await user.click(screen.getByRole('tab', { name: 'Stake' }));
    const stakeInput = await screen.findByPlaceholderText('0.00');
    await user.type(stakeInput, '50');
    const stakeBtn = screen.getByRole('button', { name: /Stake USDe → Earn phUSD/ });
    expect(stakeBtn).not.toBeDisabled();
  });
});
