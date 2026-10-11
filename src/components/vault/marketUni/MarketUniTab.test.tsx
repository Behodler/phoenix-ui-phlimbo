import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import MarketUniTab from './MarketUniTab';
import { MOCK_STEP_MS } from '../../../data/uniMarketMockData';
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
  fireEvent.click(within(screen.getByRole('dialog', { name: /review|complete|added/i })).getByRole('button', { name: label }));
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

  it('Add liquidity defaults to USDS and links amounts by the pool ratio', () => {
    render(<MarketUniTab />);
    fireEvent.click(screen.getByRole('tab', { name: 'Add liquidity' }));
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
    fireEvent.click(screen.getByRole('tab', { name: 'Add liquidity' }));
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
});
