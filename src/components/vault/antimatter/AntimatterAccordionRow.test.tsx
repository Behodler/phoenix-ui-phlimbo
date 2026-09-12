import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AntimatterAccordionRow from './AntimatterAccordionRow';
import type { AntimatterAccordionRowProps } from './AntimatterAccordionRow';

// ---------------------------------------------------------------------------
// `AntimatterAccordionRow` is deliberately hook-free — it is rendered inside a
// `.map()` over the pools, so every figure arrives as a prop already read from
// the chain by `useStableStakerPools`. That makes it testable with no wagmi
// mock at all: these tests fix the *presentation* contract (em-dash APY, the
// gate's visible explanation, the closed-claim notice), while the gate's
// decision logic is pinned in `src/hooks/useStableStakerPools.test.tsx`.
//
// Rows are queried as `getByRole('button', { name: '<SYMBOL> pool' })` with
// `aria-expanded`, matching the rest of the staking surface.
// ---------------------------------------------------------------------------

const baseProps: AntimatterAccordionRowProps = {
  symbol: 'USDC',
  icon: 'usdc.svg',
  apy: null,
  staked: 100,
  pendingBase: 10,
  ratePerSecond: 0.001,
  pending: 10,
  unclaimed: 0,
  matchedStable: 10,
  surplusAntimatter: 0,
  antimatterSymbol: 'AM',
  expanded: true,
  onToggle: () => {},
  tagline: 'Stake USDC into the yield-bearing TVL pool, accrue Antimatter.',
  tab: 'annihilate',
  onTabChange: () => {},
  walletBalance: 500,
  walletPhusd: 1_000,
  walletAntimatter: 0,
  phUsdDisplayPrice: 1.0,
  disabled: false,
  inactive: false,
  withdrawDisabled: false,
  withdrawBuffer: 0,
  claimEnabled: true,
  annihilateDisabledReason: null,
  pendingAction: null,
  needsApproval: () => false,
  stakeAmt: '',
  wdAmt: '',
  onStakeAmtChange: () => {},
  onWdAmtChange: () => {},
  onStake: () => {},
  onWithdraw: () => {},
  onAnnihilate: () => {},
  onClaim: () => {},
  onApprove: () => {},
};

const renderRow = (overrides: Partial<AntimatterAccordionRowProps> = {}) =>
  render(<AntimatterAccordionRow {...baseProps} {...overrides} />);

const annihilateButton = () =>
  screen.getByRole('button', { name: /Annihilate|Stake USDC to accrue|Not live/ });

describe('AntimatterAccordionRow', () => {
  it('exposes the row header with aria-expanded', () => {
    renderRow({ expanded: false });
    const header = screen.getByRole('button', { name: 'USDC pool' });
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders an em dash for an unknown APY — never a number and never 0', () => {
    renderRow();
    // Two em dashes: the sm+ APY column and the inline mobile chip.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText(/0\.00%/)).not.toBeInTheDocument();
  });

  it('renders a real APY once one is supplied (story 083)', () => {
    renderRow({ apy: 14.2 });
    expect(screen.getAllByText(/14\.20%/).length).toBeGreaterThan(0);
  });

  it('offers annihilation when the gate is open', () => {
    renderRow();
    expect(annihilateButton()).toBeEnabled();
    expect(screen.queryByTestId('annihilate-blocked-USDC')).not.toBeInTheDocument();
  });

  it('disables annihilation WITH a visible explanation — never a silently dead button', () => {
    const reason = 'phUSD is trading at $0.4900, so annihilation returns less value than it destroys.';
    renderRow({ annihilateDisabledReason: reason });
    expect(annihilateButton()).toBeDisabled();
    expect(screen.getByTestId('annihilate-blocked-USDC')).toHaveTextContent(reason);
  });

  it('keeps withdraw enabled while annihilation is gated — a user must always be able to exit', () => {
    renderRow({
      tab: 'withdraw',
      wdAmt: '50',
      annihilateDisabledReason: 'phUSD price too low.',
    });
    expect(screen.getByRole('button', { name: /Withdraw USDC/ })).toBeEnabled();
  });

  it('keeps stake enabled while annihilation is gated', () => {
    renderRow({
      tab: 'stake',
      stakeAmt: '50',
      annihilateDisabledReason: 'phUSD price too low.',
    });
    expect(screen.getByRole('button', { name: /Stake USDC/ })).toBeEnabled();
  });

  it('says rewards are accruing but not claimable when the claim gate is closed', () => {
    renderRow({ claimEnabled: false });
    expect(screen.getByText(/Claiming is not open yet/)).toBeInTheDocument();
  });

  it('hides the claim button entirely while the claim gate is closed', () => {
    renderRow({ tab: 'withdraw', claimEnabled: false });
    expect(screen.queryByRole('button', { name: /Claim/ })).not.toBeInTheDocument();
  });

  it('offers a claim button once the gate is open', () => {
    renderRow({ tab: 'withdraw', claimEnabled: true, pending: 10, unclaimed: 2 });
    expect(screen.getByRole('button', { name: /Claim 12 AM/ })).toBeEnabled();
  });

  it('asks for an approval before staking when the allowance is short', () => {
    renderRow({ tab: 'stake', stakeAmt: '50', needsApproval: () => true });
    expect(screen.getByRole('button', { name: 'Approve USDC' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Stake USDC →/ })).not.toBeInTheDocument();
  });

  it('renders inactive when StableStakerV2 is not deployed on this network', () => {
    renderRow({ inactive: true, annihilateDisabledReason: 'Antimatter staking is not live on this network yet.' });
    expect(screen.getByText(/Not live on this network\./)).toBeInTheDocument();
    expect(annihilateButton()).toBeDisabled();
  });

  it('surfaces the surplus notice only when Antimatter exceeds the staked principal', () => {
    renderRow({ surplusAntimatter: 0 });
    expect(screen.queryByText(/Surplus AM\./)).not.toBeInTheDocument();
  });

  it('explains the surplus when accrual has outrun the stake', () => {
    renderRow({ matchedStable: 100, surplusAntimatter: 25 });
    expect(screen.getByText(/Surplus AM\./)).toBeInTheDocument();
  });

  it('limits withdrawals to the set-aside buffer while the strategy is rebalancing', () => {
    renderRow({ tab: 'withdraw', withdrawDisabled: true, withdrawBuffer: 20, wdAmt: '50' });
    expect(screen.getByRole('button', { name: /Withdraw USDC/ })).toBeDisabled();
    expect(screen.getByText(/limited to the set-aside buffer of 20 USDC/)).toBeInTheDocument();
  });

  it('allows a withdrawal that fits inside the buffer even while rebalancing', () => {
    renderRow({ tab: 'withdraw', withdrawDisabled: true, withdrawBuffer: 20, wdAmt: '10' });
    expect(screen.getByRole('button', { name: /Withdraw USDC/ })).toBeEnabled();
  });

  it('blocks every action while the staker is globally paused', () => {
    renderRow({ tab: 'stake', stakeAmt: '10', disabled: true });
    expect(screen.getByRole('button', { name: /Stake USDC/ })).toBeDisabled();
  });
});
