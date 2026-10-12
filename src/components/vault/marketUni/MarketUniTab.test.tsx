import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import MarketUniTab from './MarketUniTab';
import { MOCK_STEP_MS, POOL } from '../../../data/uniMarketMockData';
import { mainnetAddresses } from '../../../lib/contracts';

// No wagmi / context mocks: the tab is fully self-contained mock state.

const payInput = () => screen.getByLabelText('You pay') as HTMLInputElement;
const recvInput = () => screen.getByLabelText('You receive') as HTMLInputElement;
const cta = () => within(screen.getByRole('region', { name: 'Trade panel' })).getAllByRole('button').at(-1) as HTMLButtonElement;
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const stepSubs = () =>
  within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem').map((li) => li.textContent ?? '');

/** Click the modal's primary action and let the mocked wallet confirm. */
const confirmStep = (label: string | RegExp) => {
  fireEvent.click(within(screen.getByRole('dialog', { name: /review|complete|added|removed/i })).getByRole('button', { name: label }));
  act(() => {
    vi.advanceTimersByTime(MOCK_STEP_MS);
  });
};

afterEach(() => {
  vi.useRealTimers();
});

describe('MarketUniTab (story 084, mocked)', () => {
  it('renders the mock banner', () => {
    render(<MarketUniTab />);
    expect(screen.getByRole('status')).toHaveTextContent(/Mock preview — balances, prices and transactions are simulated; nothing is sent on-chain/);
  });

  it('renders the restored official Uniswap logo in the info card', () => {
    render(<MarketUniTab />);
    const logo = screen.getByRole('img', { name: 'Uniswap logo' });
    const svg = logo.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 168.3 193.8');
    expect(svg?.querySelectorAll('path')).toHaveLength(9);
    expect(screen.getByText('phUSD trades on Uniswap')).toBeInTheDocument();
  });

  it('shows the price ticker (mock price $0.9919 < $1 renders pink, not green)', () => {
    render(<MarketUniTab />);
    expect(screen.getByText('phUSD/sUSDS pool · 400.0k phUSD / 369.6k sUSDS')).toBeInTheDocument();
    const price = screen.getByTestId('mku-ticker-price');
    expect(price.textContent).toBe('$0.991914');
    expect(price.className).toContain('text-pxusd-pink-400');
  });

  it('defaults to swap/buy/USDC with an empty amount', () => {
    render(<MarketUniTab />);
    expect(screen.getByRole('tab', { name: 'Swap' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Select token to pay with, currently USDC' })).toBeInTheDocument();
    expect(cta()).toHaveTextContent('Enter an amount');
    expect(cta()).toBeDisabled();
  });

  it('quotes a USDC buy with stats and a 3-hop route', () => {
    render(<MarketUniTab />);
    type(payInput(), '1000');
    expect(recvInput().value).not.toBe('');
    expect(screen.getByText('Rate')).toBeInTheDocument();
    expect(screen.getByText('Price impact')).toBeInTheDocument();
    expect(screen.getByText('Allowance')).toBeInTheDocument();
    expect(screen.getByText('Approve USDC first')).toBeInTheDocument();
    expect(screen.getByText('3 hops · 1 transaction')).toBeInTheDocument();
    const route = screen.getByRole('list', { name: 'Swap route' });
    expect(within(route).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'USDCSky PSM 1:1',
      'USDSSky savings deposit',
      'sUSDSUniswap V2 · 0.30%',
      'phUSD',
    ]);
    expect(cta()).toHaveTextContent('Review swap');
    expect(cta()).toBeEnabled();
  });

  it('sanitises input (commas → dots, one dot)', () => {
    render(<MarketUniTab />);
    type(payInput(), '1,5.2x');
    expect(payInput().value).toBe('1.52');
  });

  it('token picker selects sUSDS → direct pair', () => {
    render(<MarketUniTab />);
    fireEvent.click(screen.getByRole('button', { name: /Select token to pay with/ }));
    const picker = screen.getByRole('dialog', { name: 'Select a token' });
    expect(within(picker).getByRole('button', { name: /^USDC/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(picker).getByText(/USD Coin · via USDS → sUSDS/)).toBeInTheDocument();
    fireEvent.click(within(picker).getByRole('button', { name: /^sUSDS/ }));
    expect(screen.queryByRole('dialog', { name: 'Select a token' })).toBeNull();
    type(payInput(), '100');
    expect(screen.getByText('Direct · 1 hop')).toBeInTheDocument();
  });

  it('flip switches to selling phUSD and carries the output amount over', () => {
    render(<MarketUniTab />);
    type(payInput(), '1000');
    const out = recvInput().value;
    fireEvent.click(screen.getByRole('button', { name: 'Flip direction: currently buying phUSD' }));
    expect(screen.getByRole('button', { name: 'Flip direction: currently selling phUSD' })).toBeInTheDocument();
    expect(payInput().value).toBe(out);
    expect(screen.getByRole('button', { name: 'Select token to receive, currently USDC' })).toBeInTheDocument();
  });

  it('exact-out editing back-computes the pay side', () => {
    render(<MarketUniTab />);
    type(recvInput(), '100');
    expect(payInput().value).not.toBe('');
    expect(screen.getByText('Maximum sold (0.5% slippage)')).toBeInTheDocument();
  });

  it('CTA reports insufficient balance above the USDC balance', () => {
    render(<MarketUniTab />);
    type(payInput(), '1200.01');
    expect(cta()).toHaveTextContent('Insufficient USDC balance');
    expect(cta()).toBeDisabled();
  });

  it('settings popover toggles and selects slippage', () => {
    render(<MarketUniTab />);
    const gear = screen.getByRole('button', { name: 'Transaction settings' });
    expect(gear).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(gear);
    expect(gear).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('20 min')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0.5%' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '1%' }));
    type(payInput(), '100');
    expect(screen.getByText('Minimum received (1% slippage)')).toBeInTheDocument();
  });

  it('Liquidity opens on Add, which defaults to USDS and links amounts by the pool ratio', () => {
    render(<MarketUniTab />);
    fireEvent.click(screen.getByRole('tab', { name: 'Liquidity' }));
    expect(screen.getByRole('button', { name: 'Select deposit token, currently USDS' })).toBeInTheDocument();
    const [tok, ph] = screen.getAllByLabelText('Deposit') as HTMLInputElement[];
    type(tok, '107.35'); // = 100 sUSDS → 100 × 400000 / 369600 phUSD
    expect(ph.value).toBe('108.23');
    expect(screen.getByText('Wrapped to sUSDS')).toBeInTheDocument();
    expect(screen.getByText('100.0000 sUSDS via Sky savings deposit')).toBeInTheDocument();
    type(ph, '400');
    expect(tok.value).toBe(String(parseFloat((369.6 * 1.0735).toFixed(6))));
    expect(cta()).toHaveTextContent('Review supply');
  });

  it('USDS path shows zap steps; switching to sUSDS changes the action to router.addLiquidity', () => {
    render(<MarketUniTab />);
    fireEvent.click(screen.getByRole('tab', { name: 'Liquidity' }));
    type(screen.getAllByLabelText('Deposit')[0], '100');
    fireEvent.click(cta());
    let subs = stepSubs();
    expect(subs[0]).toContain('USDS.approve([LIQUIDITY_ZAP])');
    expect(subs[1]).toContain('phUSD.approve([LIQUIDITY_ZAP])');
    expect(subs[2]).toContain('Supply USDS + phUSD (wraps to sUSDS)');
    expect(subs[2]).toContain('zap.addLiquidityWithUSDS');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Select deposit token, currently USDS' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Deposit token' })).getByRole('button', { name: /sUSDS/ }));
    expect(screen.queryByText('Wrapped to sUSDS')).toBeNull();
    fireEvent.click(cta());
    subs = stepSubs();
    expect(subs[0]).toContain('sUSDS.approve(UniswapV2Router02)');
    expect(subs[1]).toContain('phUSD.approve(UniswapV2Router02)');
    expect(subs[2]).toContain('router.addLiquidity');
  });

  it('review → approve → confirm reaches success; a second swap skips the approve step', () => {
    vi.useFakeTimers();
    render(<MarketUniTab />);
    type(payInput(), '100');
    fireEvent.click(cta());

    const dialog = screen.getByRole('dialog', { name: 'Review swap' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('Route')).toBeInTheDocument();
    expect(within(dialog).queryByText('Allowance')).toBeNull();
    expect(within(dialog).getByText(/Approve exact amount only \(100\.00 USDC\) instead of unlimited/)).toBeInTheDocument();
    expect(stepSubs()[0]).toContain('USDC.approve([ZAP_ROUTER])');

    // Pending state: spinner label + Cancel disabled
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve USDC' }));
    expect(within(dialog).getByRole('button', { name: /Confirm in wallet/ })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    act(() => {
      vi.advanceTimersByTime(MOCK_STEP_MS);
    });

    confirmStep('Confirm swap');
    const done = screen.getByRole('dialog', { name: 'Swap complete' });
    expect(within(done).getByText(/^Swapped 100\.00 USDC for .* phUSD$/)).toBeInTheDocument();
    const etherscan = within(done).getByRole('link', { name: /View on Etherscan/ });
    expect(etherscan).toHaveAttribute('target', '_blank');
    fireEvent.click(within(done).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(payInput().value).toBe('');

    // Approval persisted for the session: only the action step remains.
    type(payInput(), '50');
    expect(screen.getByText('USDC approved')).toBeInTheDocument();
    fireEvent.click(cta());
    expect(stepSubs()).toHaveLength(1);
    expect(stepSubs()[0]).toContain('zap.swapToPhUSD');
  });

  it('clears the step timer on unmount', () => {
    vi.useFakeTimers();
    const { unmount } = render(<MarketUniTab />);
    type(payInput(), '100');
    fireEvent.click(cta());
    fireEvent.click(screen.getByRole('button', { name: 'Approve USDC' }));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('renders the "Or trade directly on Uniswap" link with safe target/rel and real mainnet addresses', () => {
    render(<MarketUniTab />);
    const link = screen.getByRole('link', { name: /Or trade directly on Uniswap/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute(
      'href',
      `https://app.uniswap.org/swap?chain=mainnet&inputCurrency=${mainnetAddresses.SUSDS}&outputCurrency=${mainnetAddresses.PhUSD}`,
    );
  });

  // ---------------------------------------------------------------------------
  // Story 085 — Liquidity: position card, Add / Remove, remove liquidity
  // ---------------------------------------------------------------------------

  const TS = Math.sqrt(POOL.rS * POOL.rPh);
  const f = (n: number, d: number) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const toLiquidity = () => fireEvent.click(screen.getByRole('tab', { name: 'Liquidity' }));
  const liqToggle = () => screen.getByRole('group', { name: 'Liquidity action' });
  const toRemove = () => fireEvent.click(within(liqToggle()).getByRole('button', { name: 'Remove' }));
  const burnInput = () => screen.getByLabelText('Burn LP tokens') as HTMLInputElement;
  const outToggle = () => screen.getByRole('group', { name: 'Receive the sUSDS side as' });
  const pctChip = (name: string) => screen.getByRole('button', { name });
  const positionLp = () => screen.getByTestId('mku-pos-lp').textContent;

  /** Review → (approve) → confirm → Done for whatever is currently quoted. */
  const runFlow = (approveLabel: string | null, confirmLabel: string) => {
    fireEvent.click(cta());
    if (approveLabel) confirmStep(approveLabel);
    confirmStep(confirmLabel);
  };

  it('top control reads Swap / Liquidity; Liquidity shows the position card and an Add/Remove pressed toggle', () => {
    render(<MarketUniTab />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Swap', 'Liquidity']);
    toLiquidity();
    expect(screen.getByRole('tab', { name: 'Liquidity' })).toHaveAttribute('aria-selected', 'true');

    const card = screen.getByRole('region', { name: 'Your position' });
    expect(within(card).getByText(`${f(1200 / TS * 100, 2)}% of pool`)).toBeInTheDocument();
    expect(positionLp()).toBe('1,200.0000');
    expect(within(card).getByText('UNI-V2')).toBeInTheDocument();
    expect(within(card).getByText(f((1200 / TS) * POOL.rS, 4))).toBeInTheDocument();
    expect(within(card).getByText(f((1200 / TS) * POOL.rPh, 2))).toBeInTheDocument();
    expect(within(card).getByText(/^≈ \$/)).toBeInTheDocument();

    expect(within(liqToggle()).getByRole('button', { name: 'Add' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(liqToggle()).getByRole('button', { name: 'Remove' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Select deposit token, currently USDS' })).toBeInTheDocument();

    toRemove();
    expect(within(liqToggle()).getByRole('button', { name: 'Remove' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Select deposit token/ })).toBeNull();
    expect(screen.getByText('Balance: 1,200.0000 UNI-V2')).toBeInTheDocument();
  });

  it('Remove: % chips fill the burn amount and show as pressed', () => {
    render(<MarketUniTab />);
    toLiquidity();
    toRemove();
    expect(['25%', '50%', '75%', 'Max'].map((n) => pctChip(n).getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'false']);
    fireEvent.click(pctChip('50%'));
    expect(burnInput().value).toBe('600');
    expect(pctChip('50%')).toHaveAttribute('aria-pressed', 'true');
    expect(pctChip('25%')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pctChip('25%'));
    expect(burnInput().value).toBe('300');
    fireEvent.click(pctChip('Max'));
    expect(burnInput().value).toBe('1200');
    expect(pctChip('Max')).toHaveAttribute('aria-pressed', 'true');
    // typing an arbitrary amount deselects every chip
    type(burnInput(), '123');
    expect(screen.queryAllByRole('button', { pressed: true }).map((b) => b.textContent)).not.toContain('Max');
  });

  it('Remove: receive toggle switches sUSDS ↔ USDS, rows, note and stats', () => {
    render(<MarketUniTab />);
    toLiquidity();
    toRemove();
    type(burnInput(), '600');
    const sAmt = (600 / TS) * POOL.rS;
    const phAmt = (600 / TS) * POOL.rPh;

    expect(within(outToggle()).getByRole('button', { name: 'sUSDS' })).toHaveAttribute('aria-pressed', 'true');
    const rows = () => within(screen.getByRole('list', { name: 'You receive' })).getAllByRole('listitem').map((li) => li.textContent);
    expect(rows()).toEqual([`${f(sAmt, 4)}sUSDS`, `${f(phAmt, 2)}phUSD`]);
    expect(screen.getByText('Paid out at the pool ratio')).toBeInTheDocument();
    expect(screen.getByText('LP tokens burned')).toBeInTheDocument();
    expect(screen.getByText('600.0000 UNI-V2 (50.00% of position)')).toBeInTheDocument();
    expect(screen.queryByText('sUSDS redeemed to USDS')).toBeNull();
    expect(screen.getByText('Approve UNI-V2 for router first')).toBeInTheDocument();
    expect(cta()).toHaveTextContent('Review removal');

    fireEvent.click(within(outToggle()).getByRole('button', { name: 'USDS' }));
    expect(within(outToggle()).getByRole('button', { name: 'USDS' })).toHaveAttribute('aria-pressed', 'true');
    expect(rows()).toEqual([`${f(sAmt * 1.0735, 2)}USDS`, `${f(phAmt, 2)}phUSD`]);
    expect(screen.getByText('sUSDS redeemed to USDS in the same transaction')).toBeInTheDocument();
    expect(screen.getByText('sUSDS redeemed to USDS')).toBeInTheDocument();
    expect(screen.getByText('Approve UNI-V2 for zap first')).toBeInTheDocument();
  });

  it('Remove CTA states: enter amount → insufficient balance → review', () => {
    render(<MarketUniTab />);
    toLiquidity();
    toRemove();
    expect(cta()).toHaveTextContent('Enter an amount');
    expect(cta()).toBeDisabled();
    type(burnInput(), '1200.01');
    expect(cta()).toHaveTextContent('Insufficient UNI-V2 balance');
    expect(cta()).toBeDisabled();
    type(burnInput(), '1200');
    expect(cta()).toHaveTextContent('Review removal');
    expect(cta()).toBeEnabled();
  });

  it('removal to sUSDS: approve UNI-V2 for the router, confirm, LP balance drops and the burn input clears', () => {
    vi.useFakeTimers();
    render(<MarketUniTab />);
    toLiquidity();
    toRemove();
    fireEvent.click(pctChip('50%'));
    fireEvent.click(cta());

    const dialog = screen.getByRole('dialog', { name: 'Review removal' });
    expect(stepSubs()).toEqual([
      expect.stringContaining('UNI-V2.approve(UniswapV2Router02)'),
      expect.stringContaining('router.removeLiquidity'),
    ]);
    expect(stepSubs()[1]).toContain('Remove liquidity');
    expect(within(dialog).getAllByText('You receive (estimated)')).toHaveLength(2);
    expect(within(dialog).getByText('+')).toBeInTheDocument();
    expect(within(dialog).queryByText('Allowance')).toBeNull();
    expect(within(dialog).queryByText('Pool price')).toBeNull();
    expect(within(dialog).getByText('Remaining position')).toBeInTheDocument();
    expect(within(dialog).getByText(/Approve exact amount only \(600\.0000 UNI-V2\) instead of unlimited/)).toBeInTheDocument();

    confirmStep('Approve UNI-V2');
    confirmStep('Confirm removal');
    const done = screen.getByRole('dialog', { name: 'Liquidity removed' });
    const sAmt = (600 / TS) * POOL.rS;
    const phAmt = (600 / TS) * POOL.rPh;
    expect(within(done).getByText(`Burned 600.0000 UNI-V2 · received ${f(sAmt, 4)} sUSDS + ${f(phAmt, 2)} phUSD`)).toBeInTheDocument();
    fireEvent.click(within(done).getByRole('button', { name: 'Done' }));

    expect(positionLp()).toBe('600.0000');
    expect(burnInput().value).toBe('');
    expect(screen.getByText('Balance: 600.0000 UNI-V2')).toBeInTheDocument();

    // Router allowance persisted: the next sUSDS removal skips approval…
    type(burnInput(), '100');
    expect(screen.getByText('UNI-V2 approved')).toBeInTheDocument();
    // …but the zap is a separate spender, still unapproved.
    fireEvent.click(within(outToggle()).getByRole('button', { name: 'USDS' }));
    expect(screen.getByText('Approve UNI-V2 for zap first')).toBeInTheDocument();
  });

  it('removal to USDS: approve UNI-V2 for the liquidity zap, then zap.removeLiquidityToUSDS', () => {
    vi.useFakeTimers();
    render(<MarketUniTab />);
    toLiquidity();
    toRemove();
    fireEvent.click(within(outToggle()).getByRole('button', { name: 'USDS' }));
    type(burnInput(), '300');
    fireEvent.click(cta());
    const subs = stepSubs();
    expect(subs[0]).toContain('UNI-V2.approve([LIQUIDITY_ZAP])');
    expect(subs[1]).toContain('Remove liquidity & redeem sUSDS → USDS');
    expect(subs[1]).toContain('zap.removeLiquidityToUSDS');
    expect(within(screen.getByRole('dialog')).getByText('sUSDS redeemed to USDS')).toBeInTheDocument();
    confirmStep('Approve UNI-V2');
    confirmStep('Confirm removal');
    expect(screen.getByText(/^Burned 300\.0000 UNI-V2 · received .* USDS \+ .* phUSD$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(positionLp()).toBe('900.0000');
  });

  it('removing Max empties the position: dashed empty card and "No liquidity to remove"', () => {
    vi.useFakeTimers();
    render(<MarketUniTab />);
    toLiquidity();
    toRemove();
    fireEvent.click(pctChip('Max'));
    runFlow('Approve UNI-V2', 'Confirm removal');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('region', { name: 'Your position' })).toBeNull();
    expect(screen.getByText('No liquidity in this pool yet')).toBeInTheDocument();
    expect(screen.getByText(/Add sUSDS and phUSD at the pool ratio to earn 0\.30% of every trade\. Your position will show here\./)).toBeInTheDocument();
    expect(cta()).toHaveTextContent('No liquidity to remove');
    expect(cta()).toBeDisabled();
    type(burnInput(), '5');
    expect(cta()).toHaveTextContent('No liquidity to remove');
    expect(['25%', '50%', '75%', 'Max'].every((n) => pctChip(n).getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('a completed add increments the LP balance by the quoted LP', () => {
    vi.useFakeTimers();
    render(<MarketUniTab />);
    toLiquidity();
    fireEvent.click(screen.getByRole('button', { name: 'Select deposit token, currently USDS' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Deposit token' })).getByRole('button', { name: /sUSDS/ }));
    type(screen.getAllByLabelText('Deposit')[0], '100');
    runFlow('Approve sUSDS', 'Approve phUSD');
    confirmStep('Confirm supply');
    expect(screen.getByRole('dialog', { name: 'Liquidity added' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(positionLp()).toBe(f(1200 + (100 * TS) / POOL.rS, 4));
  });

  it('cancelling a review leaves the LP balance alone', () => {
    vi.useFakeTimers();
    render(<MarketUniTab />);
    toLiquidity();
    toRemove();
    fireEvent.click(pctChip('50%'));
    fireEvent.click(cta());
    confirmStep('Approve UNI-V2');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(positionLp()).toBe('1,200.0000');
    expect(burnInput().value).toBe('600');
  });

  it('Swap → Liquidity returns to the last-used liquidity action', () => {
    render(<MarketUniTab />);
    toLiquidity();
    toRemove();
    fireEvent.click(screen.getByRole('tab', { name: 'Swap' }));
    expect(screen.queryByRole('group', { name: 'Liquidity action' })).toBeNull();
    expect(screen.getByLabelText('You pay')).toBeInTheDocument();
    toLiquidity();
    expect(within(liqToggle()).getByRole('button', { name: 'Remove' })).toHaveAttribute('aria-pressed', 'true');
    expect(burnInput()).toBeInTheDocument();

    fireEvent.click(within(liqToggle()).getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Swap' }));
    toLiquidity();
    expect(within(liqToggle()).getByRole('button', { name: 'Add' })).toHaveAttribute('aria-pressed', 'true');
  });
});
