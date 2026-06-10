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
    withdrawBuffer: 0,
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
        // USDe is underwater — withdrawals paused. Its ERC4626Market strategy
        // has a 0.50% max slippage (50 bps) → conversion-cost UI.
        makeRow({ id: 'usde', stakeToken: 'USDe', stakeIcon: usdeIcon, withdrawDisabled: true, stakedBalance: 300, conversionBps: 50 }),
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

    // The header pill renders for the underwater USDe pool, and its info tip
    // explains why on tap — without toggling the accordion (USDe must still
    // be collapsed for the expand click below to work).
    expect(screen.getByText('Withdrawals paused')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More info' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/rebalancing/i);

    // Collapse phUSD, expand USDe.
    await user.click(screen.getByRole('button', { name: 'phUSD pool' }));
    await user.click(screen.getByRole('button', { name: 'USDe pool' }));

    // Withdraw sub-tab: explanatory note + disabled Withdraw button. The
    // sub-tab switcher is a SegmentedControl (role="tab"), so target by tab.
    await user.click(screen.getByRole('tab', { name: 'Withdraw' }));
    expect(screen.getByText(/Withdrawals temporarily paused/i)).toBeInTheDocument();
    const withdrawBtn = screen.getByRole('button', { name: /Withdrawals paused/ });
    expect(withdrawBtn).toBeDisabled();

    // The form stays interactive as a what-if preview: typing an amount shows
    // the outcome plus a preview-only note, while the button stays disabled.
    const withdrawInput = await screen.findByPlaceholderText('0.00');
    await user.type(withdrawInput, '10');
    expect(screen.getByText(/Preview only/i)).toBeInTheDocument();
    expect(withdrawBtn).toBeDisabled();

    // Stake sub-tab control stays enabled (USDe has a wallet balance, no approval).
    await user.click(screen.getByRole('tab', { name: 'Stake' }));
    const stakeInput = await screen.findByPlaceholderText('0.00');
    await user.type(stakeInput, '50');
    const stakeBtn = screen.getByRole('button', { name: /Stake USDe → Earn phUSD/ });
    expect(stakeBtn).not.toBeDisabled();
  });

  it('underwater pool with a buffer: withdrawals within the buffer stay enabled, larger amounts pause', async () => {
    // Underwater but with a 26.68-token set-aside buffer — the contract still
    // pays withdrawals that fit entirely within it.
    stableReturn.pools = [
      makeRow({ id: 'usdc', stakeToken: 'USDC', stakeIcon: usdcIcon, withdrawDisabled: true, withdrawBuffer: 26.68, stakedBalance: 500 }),
    ];
    const user = userEvent.setup();
    renderStakeTab();

    // Header pill reads "limited", not "paused".
    expect(screen.getByText('Withdrawals limited')).toBeInTheDocument();

    // Collapse phUSD, expand USDC.
    await user.click(screen.getByRole('button', { name: 'phUSD pool' }));
    await user.click(screen.getByRole('button', { name: 'USDC pool' }));
    await user.click(screen.getByRole('tab', { name: 'Withdraw' }));
    expect(screen.getByText(/set-aside buffer of/i)).toBeInTheDocument();

    // Within the buffer: the normal withdraw CTA, enabled.
    const withdrawInput = await screen.findByPlaceholderText('0.00');
    await user.type(withdrawInput, '20');
    const withdrawBtn = screen.getByRole('button', { name: /Withdraw USDC/ });
    expect(withdrawBtn).not.toBeDisabled();
    await user.click(withdrawBtn);
    expect(stableFixture.withdraw).toHaveBeenCalledWith('usdc', '20');

    // Beyond the buffer: paused with an explicit over-buffer label.
    await user.type(withdrawInput, '30');
    const pausedBtn = screen.getByRole('button', { name: /Amount exceeds buffer/ });
    expect(pausedBtn).toBeDisabled();
    expect(screen.getByText(/Preview only/i)).toBeInTheDocument();
  });

  it('1:1 pool (USDC): typing an amount reveals an exact outcome line, no cost rows', async () => {
    const user = userEvent.setup();
    renderStakeTab();

    await user.click(screen.getByRole('button', { name: 'phUSD pool' }));
    await user.click(screen.getByRole('button', { name: 'USDC pool' }));

    // Hidden until an amount is typed.
    expect(screen.queryByText("You'll stake")).not.toBeInTheDocument();

    const stakeInput = await screen.findByPlaceholderText('0.00');
    await user.type(stakeInput, '100');

    expect(screen.getByText("You'll stake")).toBeInTheDocument();
    expect(screen.getByText('100 USDC')).toBeInTheDocument();
    expect(screen.queryByText('Conversion cost')).not.toBeInTheDocument();
  });

  it('AMM-routed pool (USDe): stake shows the guaranteed haircut, withdraw shows the zero-to-max range', async () => {
    const user = userEvent.setup();
    renderStakeTab();

    await user.click(screen.getByRole('button', { name: 'phUSD pool' }));
    await user.click(screen.getByRole('button', { name: 'USDe pool' }));

    // Stake: 100 USDe at 50 bps → 99.5 staked, −0.5 fixed conversion cost.
    const stakeInput = await screen.findByPlaceholderText('0.00');
    await user.type(stakeInput, '100');
    expect(screen.getByText("You'll stake")).toBeInTheDocument();
    expect(screen.getByText('99.5 USDe')).toBeInTheDocument();
    expect(screen.getByText('Conversion cost')).toBeInTheDocument();
    expect(screen.getByText('−0.5 USDe (0.50%)')).toBeInTheDocument();

    // The themed tooltip opens on tap/click (native title is unusable on touch).
    // USDe is underwater, so its header pill carries an info tip too — the
    // conversion-cost tip is the last one in DOM order (inside the panel).
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    const infoTips = screen.getAllByRole('button', { name: 'More info' });
    await user.click(infoTips[infoTips.length - 1]);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/fixed 0\.50% conversion cost/i);

    // Withdraw: 100 USDe → between 99.5 (max slippage) and 100 (buffer hit).
    await user.click(screen.getByRole('tab', { name: 'Withdraw' }));
    const withdrawInput = await screen.findByPlaceholderText('0.00');
    await user.type(withdrawInput, '100');
    expect(screen.getByText("You'll receive")).toBeInTheDocument();
    expect(screen.getByText('99.5 – 100 USDe')).toBeInTheDocument();
    expect(screen.getByText('Exit cost')).toBeInTheDocument();
    expect(screen.getByText('0% – 0.50%')).toBeInTheDocument();
  });
});
