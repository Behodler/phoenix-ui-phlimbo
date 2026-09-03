import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AntimatterStakeMockTab from './AntimatterStakeMockTab';
import { ANTIMATTER_MOCK_POOLS } from '../../../data/antimatterMockData';

// ---------------------------------------------------------------------------
// The Antimatter tab is a pure mock — no wagmi, no contexts, no hooks to stub.
// These tests assert the shell story 079 delivers: the three stable rows, the
// inert legacy row, the "this is not real" banner, and click-to-expand.
// ---------------------------------------------------------------------------

describe('AntimatterStakeMockTab', () => {
  it('renders the three stable pool rows plus the legacy phUSD row', () => {
    render(<AntimatterStakeMockTab />);

    for (const pool of ANTIMATTER_MOCK_POOLS) {
      expect(screen.getByRole('button', { name: `${pool.symbol} pool` })).toBeInTheDocument();
    }

    // The legacy row is a plain div, not a button — it is deliberately inert.
    const legacy = screen.getByLabelText('phUSD legacy pool');
    expect(legacy).toBeInTheDocument();
    expect(legacy.tagName).not.toBe('BUTTON');
  });

  it('labels the surface as a mock', () => {
    render(<AntimatterStakeMockTab />);
    expect(screen.getByText(/Mock preview/i)).toBeInTheDocument();
    expect(screen.getByText(/no on-chain transactions/i)).toBeInTheDocument();
  });

  it('toggles a row open and closed on click', async () => {
    const user = userEvent.setup();
    render(<AntimatterStakeMockTab />);

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
    render(<AntimatterStakeMockTab />);
    expect(screen.getByText(/aUSD in wallet/i)).toBeInTheDocument();
  });
});
