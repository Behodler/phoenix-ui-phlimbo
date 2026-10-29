import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnnihilateTool from './AnnihilateTool';
import type { AnnihilateStableSymbol, ForgeAnnihilateState } from '../../../hooks/useForgeAnnihilate';

const approve = vi.fn(async () => {});
const annihilate = vi.fn(async () => {});

type Overrides = Partial<Omit<ForgeAnnihilateState, 'amount' | 'setAmount' | 'stable' | 'setStable'>> & {
  /** Stand-in for the minter quote: total phUSD as a function of the amount. Defaults to 2× (1:1 rate). */
  quote?: ((amt: number) => number) | null;
};

/**
 * AnnihilateTool is presentational; amount and stable selection live in
 * `useForgeAnnihilate`. This harness owns that state so typing and picking
 * behave as they do in the tab.
 */
function Harness({ quote = (a) => 2 * a, ...overrides }: Overrides) {
  const [amount, setAmount] = useState('');
  const [stable, setStable] = useState<AnnihilateStableSymbol>('USDC');
  const amt = Number.parseFloat(amount) || 0;
  const out = amt > 0 && quote ? quote(amt) : null;
  const state: ForgeAnnihilateState = {
    active: true,
    paused: false,
    walletAntimatter: 142.38,
    stableBalances: { USDC: 1250, USDe: 80, DOLA: 410.25 },
    price: 0.98,
    gateReason: null,
    priceGated: false,
    stable,
    setStable,
    amount,
    setAmount,
    phusdOut: out,
    minPhusdOut: out === null ? null : out * 0.995,
    needsApproval: amt > 0,
    pendingAction: null,
    approve,
    annihilate,
    ...overrides,
  };
  return <AnnihilateTool state={state} />;
}

const priceGate = (price: number): Overrides => ({
  price,
  priceGated: true,
  gateReason: 'Annihilation paused at phUSD ≤ $0.50',
});

const input = () => screen.getByPlaceholderText('ENTER AN AMOUNT') as HTMLInputElement;
const cell = (label: string) => screen.getByTestId(`preview-cell-${label}`);

describe('AnnihilateTool', () => {
  beforeEach(() => {
    approve.mockClear();
    annihilate.mockClear();
  });

  it('starts empty with a disabled "Enter Amount" button and 0.00 preview', () => {
    render(<Harness />);
    expect(input().value).toBe('');
    expect(screen.getByRole('button', { name: 'Enter Amount' })).toBeDisabled();
    expect(within(cell('Antimatter')).getByText('0.00')).toBeInTheDocument();
    expect(within(cell('phUSD')).getByText('0.00')).toBeInTheDocument();
  });

  it('shows Max as min(Antimatter, USDC) by default', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Max: 142.38' })).toBeInTheDocument();
  });

  it('over balance → "Insufficient Balance" + insufficient message + red border', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(input(), '200');
    expect(screen.getByRole('button', { name: 'Insufficient Balance' })).toBeDisabled();
    expect(screen.getByText('Insufficient Antimatter')).toBeInTheDocument();
    expect(input()).toHaveAttribute('aria-invalid', 'true');
  });

  it('names the stablecoin when only the stable side is short', async () => {
    const user = userEvent.setup();
    render(<Harness walletAntimatter={500} />);
    await user.click(screen.getByRole('button', { name: 'Pair with USDC' }));
    await user.click(screen.getByRole('button', { name: /USDe/ }));
    await user.type(input(), '100');
    expect(screen.getByText('Insufficient USDe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insufficient Balance' })).toBeDisabled();
  });

  it('valid amount: preview from the quote, Approve calls the hook', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(input(), '100');

    expect(within(cell('Antimatter')).getByText('100.00')).toBeInTheDocument();
    expect(within(cell('USDC')).getByText('100.00')).toBeInTheDocument();
    expect(within(cell('phUSD')).getByText('200.00')).toBeInTheDocument();
    expect(screen.getByText('≈ $100.00 of USDC leaves your wallet')).toBeInTheDocument();
    // Net = 100 × (2·0.98 − 1) = +96.00; min = 200 × 0.995 = 199.00
    expect(screen.getByText('+$96.00')).toBeInTheDocument();
    expect(screen.getByText('199.00 phUSD')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve USDC' }));
    expect(approve).toHaveBeenCalledOnce();
  });

  it('approved: the button annihilates for the quoted phUSD, not a hard-coded 2×', async () => {
    const user = userEvent.setup();
    // The minter pays 0.98 phUSD per stable unit: 100 Antimatter + 98 = 198.
    render(<Harness needsApproval={false} quote={(a) => a + a * 0.98} />);
    await user.type(input(), '100');
    expect(within(cell('phUSD')).getByText('198.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annihilate → receive 198.00 phUSD' }));
    expect(annihilate).toHaveBeenCalledOnce();
  });

  it('waits for the minter quote before allowing the annihilation', async () => {
    const user = userEvent.setup();
    render(<Harness needsApproval={false} quote={null} />);
    await user.type(input(), '10');
    expect(screen.getByRole('button', { name: 'Fetching quote…' })).toBeDisabled();
  });

  it('lists the three stables in the selector and switches the max', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Pair with USDC' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Only stablecoins registered with the phUSD minter can be annihilated.')).toBeInTheDocument();
    const options = within(dialog).getAllByRole('button');
    expect(options.map((b) => b.querySelector('span')?.textContent)).toEqual(['USDC', 'USDe', 'DOLA']);
    expect(options[1]).toHaveTextContent('80.00');
    expect(options[2]).toHaveTextContent('410.25');
    await user.click(within(dialog).getByRole('button', { name: /USDe/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Max: 80.00' }));
    expect(input().value).toBe('80');
    expect(screen.getByRole('button', { name: 'Approve USDe' })).toBeEnabled();
  });

  it('rejects more than 4 decimals, like Mint', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(input(), '1.123456');
    expect(input().value).toBe('1.1234');
  });

  it('gated price shows the disabled callout and paused button', async () => {
    const user = userEvent.setup();
    render(<Harness {...priceGate(0.5)} />);
    expect(screen.getByText('Annihilation disabled.')).toBeInTheDocument();
    expect(screen.getByText(/phUSD is at \$0\.50\. At \$0\.50 or less/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annihilation paused at phUSD ≤ $0.50' })).toBeDisabled();

    await user.type(input(), '10');
    expect(screen.getByRole('button', { name: 'Annihilation paused at phUSD ≤ $0.50' })).toBeDisabled();
    expect(annihilate).not.toHaveBeenCalled();
  });

  it('below the floor shows a negative net value with a real minus sign', async () => {
    const user = userEvent.setup();
    render(<Harness {...priceGate(0.4)} />);
    await user.type(input(), '10');
    // 10 × (0.8 − 1) = −2.00
    expect(screen.getByText('−$2.00')).toBeInTheDocument();
  });

  it('a non-price gate disables the button without the price callout', () => {
    render(<Harness active={false} gateReason="Annihilation is not live on this network yet." />);
    expect(screen.getByRole('button', { name: 'Annihilation is not live on this network yet.' })).toBeDisabled();
    expect(screen.queryByText('Annihilation disabled.')).not.toBeInTheDocument();
  });

  it('shows an em dash when the price is unknown', () => {
    render(<Harness price={null} gateReason="The phUSD price is unavailable." />);
    const row = screen.getByText('phUSD price').parentElement!;
    expect(within(row).getByText('—')).toBeInTheDocument();
  });
});
