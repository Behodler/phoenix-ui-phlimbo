import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import AntimatterAccordionRow from './AntimatterAccordionRow';
import type { AntimatterAccordionRowProps } from './AntimatterAccordionRow';

// ---------------------------------------------------------------------------
// `AntimatterAccordionRow` is deliberately hook-free — it is rendered inside a
// `.map()` over the pools, so every figure arrives as a prop already read from
// the chain by `useStableStakerPools`. That makes it testable with no wagmi
// mock at all: these tests fix the *presentation* contract (em-dash APY, the
// gate's visible explanation, the surplus notice), while the gate's
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
  matchedStable: 10,
  surplusAntimatter: 0,
  annihilationCount: 0,
  antimatterSymbol: 'Antimatter',
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

/** The numeric value rendered in one annihilation-preview cell. */
const figure = (testId: string) => Number(screen.getByTestId(testId).textContent);

const annihilateButton = () =>
  screen.getByRole('button', { name: /Annihilate|Stake USDC to accrue|Not live/ });

describe('AntimatterAccordionRow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('hides the claim button entirely while the claim gate is closed', () => {
    renderRow({ tab: 'withdraw', claimEnabled: false });
    expect(screen.queryByRole('button', { name: /Claim/ })).not.toBeInTheDocument();
  });

  it('offers a claim button once the gate is open', () => {
    // `pending` is `claimableReward` — the banked backlog plus the live
    // projection — so the button states the whole figure, with nothing added
    // to it here.
    renderRow({ tab: 'withdraw', claimEnabled: true, pending: 12 });
    expect(screen.getByRole('button', { name: /Claim 12 Antimatter/ })).toBeEnabled();
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

  it('puts only the phUSD figure on the annihilate button', () => {
    renderRow({ staked: 100, pending: 10, ratePerSecond: 0, matchedStable: 10 });
    expect(annihilateButton()).toHaveTextContent('Annihilate Antimatter with USDC → receive 20 phUSD');
  });

  it('shows the net value to four decimals instead of rounding it to $0.00', () => {
    renderRow({ staked: 100, pending: 0.0012, ratePerSecond: 0, matchedStable: 0.0012 });
    expect(screen.getByText('+$0.0012')).toBeInTheDocument();
  });

  it('lays the outcome out as a Now / After table, without repeating the Antimatter the preview already shows', () => {
    renderRow({ staked: 100, pending: 10, ratePerSecond: 0, matchedStable: 10, walletPhusd: 1_000 });
    expect(screen.getByRole('columnheader', { name: 'Now' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'After' })).toBeInTheDocument();
    const staked = screen.getByRole('rowheader', { name: 'USDC staked' }).closest('tr')!;
    expect(Array.from(staked.cells).map((c) => c.textContent)).toEqual(['USDC staked', '100', '90(−10)']);
    const phusd = screen.getByRole('rowheader', { name: 'phUSD in wallet' }).closest('tr')!;
    expect(Array.from(phusd.cells).map((c) => c.textContent)).toEqual(['phUSD in wallet', '1,000', '1,020(+20)']);
    expect(screen.queryByRole('rowheader', { name: 'Antimatter in wallet' })).not.toBeInTheDocument();
  });

  it('shows a sub-cent phUSD gain instead of rounding it away', () => {
    renderRow({ staked: 100, pending: 0.0015, ratePerSecond: 0, matchedStable: 0.0015, walletPhusd: 5 });
    const phusd = screen.getByRole('rowheader', { name: 'phUSD in wallet' }).closest('tr')!;
    expect(phusd.cells[2].textContent).toBe('5.003(+0.003)');
  });

  it('leaves the change off a row that does not move', () => {
    renderRow({ staked: 100, pending: 0, ratePerSecond: 0, matchedStable: 0, walletPhusd: 1_000 });
    const staked = screen.getByRole('rowheader', { name: 'USDC staked' }).closest('tr')!;
    expect(staked.cells[2].textContent).toBe('100');
  });

  it('surfaces the surplus notice only when Antimatter exceeds the staked principal', () => {
    renderRow({ surplusAntimatter: 0 });
    expect(screen.queryByText(/Surplus Antimatter\./)).not.toBeInTheDocument();
  });

  it('explains the surplus when accrual has outrun the stake', () => {
    // The panel derives the split from the accrued total against the staked
    // principal, the same `max(accrued - staked, 0)` the contract uses, so
    // that it can keep deriving it between chain reads. The attested
    // `surplusAntimatter` still gates the button.
    renderRow({ staked: 100, pending: 125, matchedStable: 100, surplusAntimatter: 25 });
    expect(screen.getByText(/Surplus Antimatter\./)).toBeInTheDocument();
  });

  it('ticks the preview forward between chain reads rather than sitting still for 12s', () => {
    // Antimatter accrues every second on chain but is only READ every 12s, so
    // the panel extrapolates from `ratePerSecond` the way the pool's own
    // pending counter does. Costs nothing on the network: the rate is already
    // read for the row header.
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    renderRow({ staked: 1_000, pending: 10, ratePerSecond: 1, matchedStable: 10 });
    expect(figure('preview-accrued')).toBe(10);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    // Three seconds at 1/s, give or take the frame the RAF clock lands on. The
    // matched stake follows the accrual exactly (1:1, under the 1000 cap) and
    // the phUSD payout is both sides together.
    expect(figure('preview-accrued')).toBeCloseTo(13, 1);
    expect(figure('preview-matched')).toBeCloseTo(13, 1);
    expect(figure('preview-receive')).toBeCloseTo(26, 1);
  });

  it('caps the ticking match at the staked principal and spills the rest into surplus', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    renderRow({ staked: 12, pending: 10, ratePerSecond: 1, matchedStable: 10 });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    // Accrual reached 15 against a stake of 12, so the match pins at the stake
    // and the excess 3 becomes the surplus the contract pays out raw.
    expect(figure('preview-matched')).toBe(12);
    expect(screen.getByText(/Surplus Antimatter\./)).toBeInTheDocument();
  });

  it('holds the figures still when the rate is zero, which is what a paused Live toggle means', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    renderRow({ staked: 1_000, pending: 10, ratePerSecond: 0, matchedStable: 10 });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(figure('preview-accrued')).toBe(10);
  });

  it('plays no annihilation burst before an annihilation has ever been confirmed', () => {
    renderRow({ annihilationCount: 0 });
    expect(screen.queryAllByTestId('am-burst')).toHaveLength(0);
  });

  it('detonates both destroyed operands and blooms the phUSD cell once a tx confirms', () => {
    const { rerender } = renderRow({ annihilationCount: 0 });
    rerender(<AntimatterAccordionRow {...baseProps} annihilationCount={1} />);
    const bursts = screen.getAllByTestId('am-burst');
    // The accrued Antimatter and the matched stake are what is destroyed, so
    // both flash white; the phUSD cell is what is created, and blooms orange
    // behind them on a CSS delay.
    expect(bursts.map((b) => b.dataset.burst)).toEqual(['annihilate', 'annihilate', 'create']);
  });

  it('keys the burst on the confirmed count, so a second annihilation replays it', () => {
    const { rerender } = renderRow({ annihilationCount: 0 });
    rerender(<AntimatterAccordionRow {...baseProps} annihilationCount={1} />);
    const first = screen.getAllByTestId('am-burst')[0];
    rerender(<AntimatterAccordionRow {...baseProps} annihilationCount={2} />);
    // A remounted node is what restarts a CSS animation that has already run.
    expect(screen.getAllByTestId('am-burst')[0]).not.toBe(first);
  });

  it('does not replay an earlier annihilation when the panel is reopened', () => {
    // Reopening the accordion (or returning to this sub-tab) remounts the
    // panel with a count that is already non-zero; a fresh node would play the
    // keyframes for a flash the user has already seen.
    const { rerender } = renderRow({ annihilationCount: 0 });
    rerender(<AntimatterAccordionRow {...baseProps} annihilationCount={1} />);
    rerender(<AntimatterAccordionRow {...baseProps} annihilationCount={1} expanded={false} />);
    rerender(<AntimatterAccordionRow {...baseProps} annihilationCount={1} expanded />);
    expect(screen.queryAllByTestId('am-burst')).toHaveLength(0);
  });

  it('plays the "combine these" cue on all three preview cells while annihilation is available', () => {
    const { container } = renderRow();
    const cells = container.querySelectorAll('[data-cue]');
    expect(Array.from(cells).map((c) => c.getAttribute('data-cue'))).toEqual(['left', 'right', 'result']);
    cells.forEach((c) => expect(c).toHaveAttribute('data-cue-on', 'true'));
  });

  it('holds the cue still for the whole of a pending annihilation', () => {
    const { container } = renderRow({ pendingAction: 'annihilate' });
    container.querySelectorAll('[data-cue]').forEach((c) => expect(c).toHaveAttribute('data-cue-on', 'false'));
  });

  it('does not encourage an annihilation the gate refuses', () => {
    const { container } = renderRow({ annihilateDisabledReason: 'phUSD is below $0.50.' });
    container.querySelectorAll('[data-cue]').forEach((c) => expect(c).toHaveAttribute('data-cue-on', 'false'));
  });

  it('shows no burst outside the annihilate panel', () => {
    renderRow({ tab: 'withdraw', annihilationCount: 1 });
    expect(screen.queryAllByTestId('am-burst')).toHaveLength(0);
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
