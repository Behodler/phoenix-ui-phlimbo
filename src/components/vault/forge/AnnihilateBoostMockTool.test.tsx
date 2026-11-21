import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnnihilateBoostMockTool, { BOOST_MOCK_TOAST } from './AnnihilateBoostMockTool';
import type { AnnihilateStableSymbol, ForgeAnnihilateState } from '../../../hooks/useForgeAnnihilate';

const { addToast } = vi.hoisted(() => ({ addToast: vi.fn() }));
vi.mock('../../ui/ToastProvider', () => ({ useToast: () => ({ addToast }) }));

const approve = vi.fn(async () => {});
const annihilate = vi.fn(async () => {});

type Overrides = Partial<Omit<ForgeAnnihilateState, 'amount' | 'setAmount' | 'stable' | 'setStable'>> & {
  quote?: ((amt: number) => number) | null;
};

/** Owns the pair/amount state as the mock row's own `useForgeAnnihilate` instance would. */
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
    // The mock has no Approve step even when the real allowance is short.
    needsApproval: true,
    pendingAction: null,
    approve,
    annihilate,
    ...overrides,
  };
  return <AnnihilateBoostMockTool state={state} />;
}

const input = () => screen.getByPlaceholderText('ENTER AN AMOUNT') as HTMLInputElement;
const cell = (label: string) => screen.getByTestId(`preview-cell-${label}`);
const boostSwitch = () => screen.getByRole('switch', { name: 'Apply phUSD boost' });

async function pick(user: ReturnType<typeof userEvent.setup>, from: string, to: string) {
  await user.click(screen.getByRole('button', { name: `Pair with ${from}` }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: new RegExp(`^${to}`) }));
}

describe('AnnihilateBoostMockTool', () => {
  beforeEach(() => {
    approve.mockClear();
    annihilate.mockClear();
    addToast.mockClear();
  });

  it('badges only the boost-eligible token in the selector', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Pair with USDC' }));
    expect(screen.getByTestId('token-badge-USDe')).toHaveTextContent('+20% boost');
    expect(screen.queryByTestId('token-badge-USDC')).not.toBeInTheDocument();
    expect(screen.queryByTestId('token-badge-DOLA')).not.toBeInTheDocument();
  });

  it('shows the boost card only for USDe, with the switch off by default', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByTestId('boost-card')).not.toBeInTheDocument();
    await pick(user, 'USDC', 'USDe');
    const card = screen.getByTestId('boost-card');
    expect(card).toHaveTextContent('phUSD boost');
    expect(card).toHaveTextContent('+20%');
    expect(card).toHaveTextContent(
      'USDe is running low in protocol-owned liquidity. Pair with it now and receive 20% extra phUSD. Optional: the boosted route uses more gas.',
    );
    expect(boostSwitch()).toHaveAttribute('aria-checked', 'false');
    await pick(user, 'USDe', 'DOLA');
    expect(screen.queryByTestId('boost-card')).not.toBeInTheDocument();
  });

  it('switch toggles the preview: 10 Antimatter → 20 phUSD, boosted 24', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await pick(user, 'USDC', 'USDe');
    await user.type(input(), '10');

    expect(within(cell('phUSD')).getByText('20.00')).toBeInTheDocument();
    expect(screen.getByTestId('boost-not-applied')).toHaveTextContent('Boost available, not applied+4.00 phUSD');
    // Off: net = 20 × 0.98 − 10 = 9.60 (= 10 × (2·0.98 − 1)); min = 19.90.
    expect(screen.getByText('+$9.60')).toBeInTheDocument();
    expect(screen.getByText('19.90 phUSD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annihilate → receive 20.00 phUSD' })).toBeEnabled();

    await user.click(boostSwitch());
    expect(boostSwitch()).toHaveAttribute('aria-checked', 'true');
    expect(within(cell('phUSD')).getByText('24.00')).toBeInTheDocument();
    expect(screen.getByTestId('boost-out-badge')).toHaveTextContent('+20%');
    expect(screen.getByText('Base (2×)')).toBeInTheDocument();
    expect(screen.getByText('20.00 phUSD')).toBeInTheDocument();
    expect(screen.getByText('USDe boost (+20%)')).toBeInTheDocument();
    expect(screen.getByText('+4.00 phUSD')).toBeInTheDocument();
    expect(screen.queryByTestId('boost-not-applied')).not.toBeInTheDocument();
    // On: net = 24 × 0.98 − 10 = 13.52; min = floor2(19.90 × 1.2) = 23.88.
    expect(screen.getByText('+$13.52')).toBeInTheDocument();
    expect(screen.getByText('23.88 phUSD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annihilate with +20% boost' })).toBeEnabled();
    expect(screen.getByText('Irreversible. Boosted route: higher gas, 20% more phUSD.')).toBeInTheDocument();

    await user.click(boostSwitch());
    expect(within(cell('phUSD')).getByText('20.00')).toBeInTheDocument();
    expect(screen.getByText('Irreversible. Both halves are consumed in one transaction.')).toBeInTheDocument();
  });

  it('floors the bonus in favour of the protocol', async () => {
    const user = userEvent.setup();
    // Quote 1.99 × amt: 1 → 1.99 base, 20% = 0.398 → 0.39 bonus, out 2.38.
    render(<Harness quote={(a) => 1.99 * a} />);
    await pick(user, 'USDC', 'USDe');
    await user.type(input(), '1');
    await user.click(boostSwitch());
    expect(screen.getByText('+0.39 phUSD')).toBeInTheDocument();
    expect(within(cell('phUSD')).getByText('2.38')).toBeInTheDocument();
  });

  it('hint under the selector selects USDe and turns the boost on', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const hint = screen.getByTestId('boost-hint');
    // Nothing entered yet: the parenthetical is omitted.
    expect(hint).toHaveTextContent('USDe is boosted right now: pair with it for +20% phUSD');
    expect(hint).not.toHaveTextContent('on this amount');
    expect(hint).toHaveTextContent('Switch →');

    await user.type(input(), '100');
    // min(100, 142.38, 80 USDe) × 2 × 20% = 32.00
    expect(screen.getByTestId('boost-hint')).toHaveTextContent(
      'USDe is boosted right now: pair with it for +20% phUSD (+32.00 on this amount)',
    );

    await user.click(screen.getByTestId('boost-hint'));
    expect(screen.getByRole('button', { name: 'Pair with USDe' })).toBeInTheDocument();
    expect(boostSwitch()).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('boost-hint')).not.toBeInTheDocument();
  });

  it('hides the hint while USDe is selected; picking USDe from the dropdown leaves the boost off', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await pick(user, 'USDC', 'USDe');
    expect(screen.queryByTestId('boost-hint')).not.toBeInTheDocument();
    expect(boostSwitch()).toHaveAttribute('aria-checked', 'false');
  });

  it('switching away from USDe resets the boost to off', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('boost-hint'));
    expect(boostSwitch()).toHaveAttribute('aria-checked', 'true');
    await pick(user, 'USDe', 'DOLA');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    await pick(user, 'DOLA', 'USDe');
    expect(boostSwitch()).toHaveAttribute('aria-checked', 'false');
  });

  it('CTA makes no write calls and shows the mock toast', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('boost-hint'));
    await user.type(input(), '10');
    await user.click(screen.getByRole('button', { name: 'Annihilate with +20% boost' }));
    await pick(user, 'USDe', 'USDC');
    await user.click(screen.getByRole('button', { name: 'Annihilate → receive 20.00 phUSD' }));

    expect(approve).not.toHaveBeenCalled();
    expect(annihilate).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledTimes(2);
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ description: BOOST_MOCK_TOAST }));
    expect(BOOST_MOCK_TOAST).toBe('Boosted annihilation is mocked on this page. Nothing was sent.');
    // No Approve step in the mock.
    expect(screen.queryByRole('button', { name: /^Approve/ })).not.toBeInTheDocument();
  });

  it('respects the real price gate, even with the boost on', async () => {
    const user = userEvent.setup();
    render(<Harness price={0.5} priceGated gateReason="Annihilation paused at phUSD ≤ $0.50" />);
    await user.click(screen.getByTestId('boost-hint'));
    await user.type(input(), '10');
    expect(screen.getByRole('button', { name: 'Annihilation paused at phUSD ≤ $0.50' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Annihilation disabled.');
    expect(addToast).not.toHaveBeenCalled();
  });

  it('keeps the real label chain: Enter Amount and Insufficient Balance', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Enter Amount' })).toBeDisabled();
    await user.type(input(), '200');
    expect(screen.getByRole('button', { name: 'Insufficient Balance' })).toBeDisabled();
    expect(screen.getByText('Insufficient Antimatter')).toBeInTheDocument();
  });
});
