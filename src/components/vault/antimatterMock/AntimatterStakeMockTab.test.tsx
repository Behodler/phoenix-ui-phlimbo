import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AntimatterStakeMockTab from './AntimatterStakeMockTab';
import { ToastProvider } from '../../ui/ToastProvider';
import { ANTIMATTER_MOCK_POOLS } from '../../../data/antimatterMockData';

// ---------------------------------------------------------------------------
// The Antimatter tab is a pure mock — no wagmi, no contexts to stub beyond the
// toast provider the annihilate action posts into.
//
// Freezing the clock is the point of the setup: the accrual counter advances
// off `Date.now()`, so with it pinned every figure is exactly its literal from
// `antimatterMockData.ts` and assertions can name real numbers instead of
// matching loose ranges.
//
// `vi.useFakeTimers()` would be the obvious way to do that, but it deadlocks
// `user-event` here — every click hangs until the 5 s test timeout — so the
// clock is frozen with a `Date.now` stub instead and the timers stay real. The
// ticking interval then re-renders with an unchanged elapsed time, which is
// exactly the stability the assertions need.
// ---------------------------------------------------------------------------

const FROZEN_NOW = new Date('2026-01-01T00:00:00Z').getTime();

const renderTab = () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <AntimatterStakeMockTab />
    </ToastProvider>,
  );
  return user;
};

/** Open a pool row and return its enclosing card. */
const openRow = async (user: ReturnType<typeof renderTab>, symbol: string) => {
  const header = screen.getByRole('button', { name: `${symbol} pool` });
  if (header.getAttribute('aria-expanded') === 'false') await user.click(header);
  // The row card is the header button's parent.
  return header.parentElement as HTMLElement;
};

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AntimatterStakeMockTab', () => {
  it('renders the three stable pool rows plus the legacy phUSD row', () => {
    renderTab();

    for (const pool of ANTIMATTER_MOCK_POOLS) {
      expect(screen.getByRole('button', { name: `${pool.symbol} pool` })).toBeInTheDocument();
    }

    // The legacy row is a plain div, not a button — it is deliberately inert.
    const legacy = screen.getByLabelText('phUSD legacy pool');
    expect(legacy).toBeInTheDocument();
    expect(legacy.tagName).not.toBe('BUTTON');
  });

  it('labels the surface as a mock', () => {
    renderTab();
    expect(screen.getByText(/Mock preview/i)).toBeInTheDocument();
    expect(screen.getByText(/no on-chain transactions/i)).toBeInTheDocument();
  });

  it('toggles a row open and closed on click', async () => {
    const user = renderTab();

    // USDC opens by default; USDe starts closed.
    const usde = screen.getByRole('button', { name: 'USDe pool' });
    expect(usde).toHaveAttribute('aria-expanded', 'false');

    await user.click(usde);
    expect(usde).toHaveAttribute('aria-expanded', 'true');
    // Opening one row closes the other — a single open row keeps it calm.
    expect(screen.getByRole('button', { name: 'USDC pool' })).toHaveAttribute('aria-expanded', 'false');

    await user.click(usde);
    expect(usde).toHaveAttribute('aria-expanded', 'false');
  });

  it('surfaces the mock Antimatter wallet balance inside the panel', () => {
    // The header balance strip is hidden below lg, so the panel must show it.
    renderTab();
    expect(screen.getByText(/aUSD in wallet/i)).toBeInTheDocument();
  });

  it('opens on the Annihilate sub-tab', async () => {
    const user = renderTab();
    const row = await openRow(user, 'USDC');
    expect(within(row).getByRole('tab', { name: 'Annihilate' })).toHaveAttribute('aria-selected', 'true');
  });

  it('staking debits the wallet and credits the stake', async () => {
    const user = renderTab();
    const row = await openRow(user, 'USDC');

    await user.click(within(row).getByRole('tab', { name: 'Stake' }));
    // Wallet USDC starts at 2450.32, staked at 100.
    expect(within(row).getByText('2,450.32')).toBeInTheDocument();

    await user.type(within(row).getByLabelText('Stake amount'), '50');
    await user.click(within(row).getByRole('button', { name: /^Stake USDC/ }));

    // 2450.32 - 50 and 100 + 50.
    expect(within(row).getByText('2,400.32')).toBeInTheDocument();
    expect(within(row).getByText('150')).toBeInTheDocument();
    // The input is cleared by the transition.
    expect(within(row).getByLabelText('Stake amount')).toHaveValue(null);
  });

  it('withdrawing credits the wallet and debits the stake', async () => {
    const user = renderTab();
    const row = await openRow(user, 'USDC');

    await user.click(within(row).getByRole('tab', { name: 'Withdraw' }));
    await user.type(within(row).getByLabelText('Withdraw amount'), '40');
    await user.click(within(row).getByRole('button', { name: 'Withdraw USDC' }));

    // 100 - 40 staked (read off the collapsed header, which the form's own
    // "Staked:" label would otherwise make ambiguous), 2450.32 + 40 in wallet.
    const header = within(row).getByRole('button', { name: 'USDC pool' });
    expect(within(header).getByText('60')).toBeInTheDocument();
    await user.click(within(row).getByRole('tab', { name: 'Stake' }));
    expect(within(row).getByText('2,490.32')).toBeInTheDocument();
  });

  it('annihilates a capped pool, paying phUSD for both sides and the surplus to the wallet', async () => {
    const user = renderTab();
    // DOLA starts with 1643.901244 aUSD accrued against 1500 staked, so it is
    // the pool that exercises the surplus branch on load.
    const row = await openRow(user, 'DOLA');

    await user.click(within(row).getByRole('button', { name: /^Annihilate 1,500/ }));

    // matched = 1500, so 3000 phUSD on top of the starting 1240.5. The figure
    // appears both in the wallet strip and in the (now no-op) summary, hence
    // getAllByText.
    expect(screen.getAllByText('4,240.5').length).toBeGreaterThan(0);
    // The surplus 143.901244 aUSD lands in the wallet (displayed to 4 dp).
    expect(screen.getAllByText('143.9012').length).toBeGreaterThan(0);
    // Stake fully consumed, and the accrued figure reset to zero.
    expect(within(row).getByRole('button', { name: /^Stake DOLA to accrue aUSD/ })).toBeDisabled();

    // The confirmation toast reports all three legs.
    expect(screen.getByText('Annihilation confirmed')).toBeInTheDocument();
    expect(screen.getByText(/1,500 aUSD annihilated with 1,500 DOLA from your stake/)).toBeInTheDocument();
    expect(screen.getByText(/Surplus 143.901244 aUSD paid out to your wallet/)).toBeInTheDocument();
  });

  it('shows the surplus notice only for a pool that has out-accrued its stake', async () => {
    const user = renderTab();

    const dola = await openRow(user, 'DOLA');
    expect(within(dola).getByText(/You hold more aUSD than staked DOLA/)).toBeInTheDocument();

    const usdc = await openRow(user, 'USDC');
    // USDC has 12.481922 aUSD against 100 staked — well under the cap.
    expect(within(usdc).queryByText(/You hold more aUSD than staked/)).not.toBeInTheDocument();
  });
});
