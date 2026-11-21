import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnnihilateBoostMockTool from './AnnihilateBoostMockTool';
import type { AnnihilateStableSymbol, ForgeAnnihilateState } from '../../../hooks/useForgeAnnihilate';
import type { ForgeAnnihilateBoostState } from '../../../hooks/useForgeAnnihilateBoost';

const approve = vi.fn(async () => {});
const annihilate = vi.fn(async () => {});
const approveAntimatter = vi.fn(async () => {});
const approveStable = vi.fn(async () => {});
const boostedAnnihilate = vi.fn(async () => {});

type Overrides = Partial<Omit<ForgeAnnihilateState, 'amount' | 'setAmount' | 'stable' | 'setStable'>> & {
  quote?: ((amt: number) => number) | null;
  /** Live booster inputs. */
  live?: boolean;
  boostPaused?: boolean;
  bps?: number;
  eligible?: readonly AnnihilateStableSymbol[];
  /** Overrides the amount-specific ineligibility (e.g. daily cap), null = eligible. */
  quoteReason?: string | null;
  boostQuoteLoading?: boolean;
  needsAmApproval?: boolean;
  needsStableApproval?: boolean;
};

/** Owns the pair/amount state as the row's own `useForgeAnnihilate` instance would, and fakes the booster hook. */
function Harness({
  quote = (a) => 2 * a,
  live = true,
  boostPaused = false,
  bps = 1000,
  eligible = ['USDe'],
  quoteReason = null,
  boostQuoteLoading = false,
  needsAmApproval = false,
  needsStableApproval = false,
  ...overrides
}: Overrides) {
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
    needsApproval: false,
    pendingAction: null,
    approve,
    annihilate,
    ...overrides,
  };
  const isEligible = (s: AnnihilateStableSymbol) => live && !boostPaused && eligible.includes(s);
  const reasonFor = (s: AnnihilateStableSymbol) =>
    !live ? 'Boost not live on this network' : boostPaused ? 'Boost paused' : isEligible(s) ? null : 'Not low on protocol-owned liquidity';
  const unavailableReason = reasonFor(stable) ?? (amt > 0 ? quoteReason : null);
  const quoted = isEligible(stable) && unavailableReason === null && out !== null && !boostQuoteLoading;
  const bonusOf = (b: number) => Math.floor((b * bps) / 10_000 * 1e6) / 1e6;
  const boost: ForgeAnnihilateBoostState = {
    live,
    paused: boostPaused,
    boostBps: bps,
    boostPct: bps / 100,
    eligibleStables: (['USDC', 'USDe', 'DOLA'] as const).filter(isEligible),
    isEligible,
    reasonFor,
    unavailableReason,
    quoteLoading: boostQuoteLoading,
    expectedBaseWei: quoted ? 1n : undefined,
    expectedBonusWei: quoted ? 1n : undefined,
    minOutWei: quoted ? 1n : undefined,
    expectedBase: quoted ? out : null,
    expectedBonus: quoted ? bonusOf(out) : null,
    minPhusdOut: quoted ? (out + bonusOf(out)) * 0.995 : null,
    needsAmApproval,
    needsStableApproval,
    pendingAction: null,
    approveAntimatter,
    approveStable,
    boostedAnnihilate,
  };
  return <AnnihilateBoostMockTool state={state} boost={boost} />;
}

const input = () => screen.getByPlaceholderText('ENTER AN AMOUNT') as HTMLInputElement;
const cell = (label: string) => screen.getByTestId(`preview-cell-${label}`);
const boostSwitch = () => screen.getByRole('switch', { name: 'Apply phUSD boost' });

async function pick(user: ReturnType<typeof userEvent.setup>, from: string, to: string) {
  await user.click(screen.getByRole('button', { name: `Pair with ${from}` }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: new RegExp(`^${to}`) }));
}

describe('AnnihilateBoostMockTool (live)', () => {
  beforeEach(() => {
    for (const f of [approve, annihilate, approveAntimatter, approveStable, boostedAnnihilate]) f.mockClear();
  });

  it('badges every eligible token with the live boost %', async () => {
    const user = userEvent.setup();
    render(<Harness eligible={['USDe', 'DOLA']} />);
    await user.click(screen.getByRole('button', { name: 'Pair with USDC' }));
    expect(screen.getByTestId('token-badge-USDe')).toHaveTextContent('+10% boost');
    expect(screen.getByTestId('token-badge-DOLA')).toHaveTextContent('+10% boost');
    expect(screen.queryByTestId('token-badge-USDC')).not.toBeInTheDocument();
  });

  it('formats a fractional boost without trailing zeros', async () => {
    const user = userEvent.setup();
    render(<Harness bps={1250} />);
    await user.click(screen.getByRole('button', { name: 'Pair with USDC' }));
    expect(screen.getByTestId('token-badge-USDe')).toHaveTextContent('+12.5% boost');
  });

  it('boost card: switch enabled for an eligible stable, disabled with the reason otherwise', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(boostSwitch()).toBeDisabled();
    expect(screen.getByTestId('boost-unavailable')).toHaveTextContent('Not low on protocol-owned liquidity');
    await pick(user, 'USDC', 'USDe');
    const card = screen.getByTestId('boost-card');
    expect(card).toHaveTextContent('+10%');
    expect(card).toHaveTextContent(
      'USDe is running low in protocol-owned liquidity. Pair with it now and receive 10% extra phUSD. Optional: the boosted route uses more gas.',
    );
    expect(boostSwitch()).toBeEnabled();
    expect(boostSwitch()).toHaveAttribute('aria-checked', 'false');
  });

  it('booster not live → switch disabled, "Boost not live on this network", no hint', () => {
    render(<Harness live={false} />);
    expect(boostSwitch()).toBeDisabled();
    expect(screen.getByTestId('boost-unavailable')).toHaveTextContent('Boost not live on this network');
    expect(screen.queryByTestId('boost-hint')).not.toBeInTheDocument();
  });

  it('booster paused → switch disabled, "Boost paused"', () => {
    render(<Harness boostPaused />);
    expect(boostSwitch()).toBeDisabled();
    expect(screen.getByTestId('boost-unavailable')).toHaveTextContent('Boost paused');
  });

  it('switch toggles the preview: 10 Antimatter → 20 phUSD, boosted 22 from the live quote', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await pick(user, 'USDC', 'USDe');
    await user.type(input(), '10');

    expect(within(cell('phUSD')).getByText('20.00')).toBeInTheDocument();
    expect(screen.getByTestId('boost-not-applied')).toHaveTextContent('Boost available, not applied+2.00 phUSD');
    expect(screen.getByText('19.90 phUSD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annihilate → receive 20.00 phUSD' })).toBeEnabled();

    await user.click(boostSwitch());
    expect(within(cell('phUSD')).getByText('22.00')).toBeInTheDocument();
    expect(screen.getByTestId('boost-out-badge')).toHaveTextContent('+10%');
    expect(screen.getByText('Base (2×)')).toBeInTheDocument();
    expect(screen.getByText('USDe boost (+10%)')).toBeInTheDocument();
    expect(screen.getByText('+2.00 phUSD')).toBeInTheDocument();
    // Minimum from the booster's minOutWei: 22 × 0.995 = 21.89.
    expect(screen.getByText('21.89 phUSD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annihilate with +10% boost → receive 22.00 phUSD' })).toBeEnabled();
    expect(screen.getByText('Irreversible. Boosted route: higher gas, 10% more phUSD.')).toBeInTheDocument();
  });

  it('floors the bonus in favour of the protocol', async () => {
    const user = userEvent.setup();
    // Quote 1.99 × amt: 1 → 1.99 base, 10% = 0.199 → 0.19 bonus, out 2.18.
    render(<Harness quote={(a) => 1.99 * a} />);
    await pick(user, 'USDC', 'USDe');
    await user.type(input(), '1');
    await user.click(boostSwitch());
    expect(screen.getByText('+0.19 phUSD')).toBeInTheDocument();
    expect(within(cell('phUSD')).getByText('2.18')).toBeInTheDocument();
  });

  it('hint targets the first eligible stable and turns the boost on', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const hint = screen.getByTestId('boost-hint');
    expect(hint).toHaveTextContent('USDe is boosted right now: pair with it for +10% phUSD');
    expect(hint).not.toHaveTextContent('on this amount');

    await user.type(input(), '100');
    // min(100, 142.38, 80 USDe) × 2 × 10% = 16.00
    expect(screen.getByTestId('boost-hint')).toHaveTextContent('(+16.00 on this amount)');

    await user.click(screen.getByTestId('boost-hint'));
    expect(screen.getByRole('button', { name: 'Pair with USDe' })).toBeInTheDocument();
    expect(boostSwitch()).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('boost-hint')).not.toBeInTheDocument();
  });

  it('switching to an ineligible stable resets the boost to off', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('boost-hint'));
    await pick(user, 'USDe', 'DOLA');
    expect(boostSwitch()).toHaveAttribute('aria-checked', 'false');
    expect(boostSwitch()).toBeDisabled();
  });

  it('boost on: approval steps run Antimatter first, then the stable', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness needsAmApproval needsStableApproval />);
    await user.click(screen.getByTestId('boost-hint'));
    await user.type(input(), '10');
    await user.click(screen.getByRole('button', { name: 'Approve Antimatter' }));
    expect(approveAntimatter).toHaveBeenCalledTimes(1);
    expect(approveStable).not.toHaveBeenCalled();

    rerender(<Harness needsStableApproval />);
    await user.click(screen.getByRole('button', { name: 'Approve USDe' }));
    expect(approveStable).toHaveBeenCalledTimes(1);
    expect(approve).not.toHaveBeenCalled();
  });

  it('boost on: "Fetching quote…" while the preview loads', async () => {
    const user = userEvent.setup();
    render(<Harness boostQuoteLoading />);
    await user.click(screen.getByTestId('boost-hint'));
    await user.type(input(), '10');
    expect(screen.getByRole('button', { name: 'Fetching quote…' })).toBeDisabled();
  });

  it('boost on: the CTA calls boostedAnnihilate, never the plain write', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('boost-hint'));
    await user.type(input(), '10');
    await user.click(screen.getByRole('button', { name: /^Annihilate with \+10% boost/ }));
    expect(boostedAnnihilate).toHaveBeenCalledTimes(1);
    expect(annihilate).not.toHaveBeenCalled();
  });

  it('boost off: the CTA is the real approve → Antimatter.annihilate path', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness needsApproval />);
    await user.type(input(), '10');
    await user.click(screen.getByRole('button', { name: 'Approve USDC' }));
    expect(approve).toHaveBeenCalledTimes(1);
    rerender(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Annihilate → receive 20.00 phUSD' }));
    expect(annihilate).toHaveBeenCalledTimes(1);
    expect(boostedAnnihilate).not.toHaveBeenCalled();
    expect(approveAntimatter).not.toHaveBeenCalled();
  });

  it('boost on but the amount became ineligible: no silent fallback, switch stays switch-off-able', async () => {
    const user = userEvent.setup();
    render(<Harness quoteReason="Daily phUSD mint cap reached" />);
    await user.click(screen.getByTestId('boost-hint'));
    await user.type(input(), '10');
    expect(screen.getByRole('button', { name: 'Boost unavailable: Daily phUSD mint cap reached' })).toBeDisabled();
    expect(boostSwitch()).toBeEnabled();
    await user.click(boostSwitch());
    expect(screen.getByRole('button', { name: 'Annihilate → receive 20.00 phUSD' })).toBeEnabled();
  });

  it('respects the real price gate, even with the boost on', async () => {
    const user = userEvent.setup();
    render(<Harness price={0.5} priceGated gateReason="Annihilation paused at phUSD ≤ $0.50" />);
    await user.click(screen.getByTestId('boost-hint'));
    await user.type(input(), '10');
    expect(screen.getByRole('button', { name: 'Annihilation paused at phUSD ≤ $0.50' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Annihilation disabled.');
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
