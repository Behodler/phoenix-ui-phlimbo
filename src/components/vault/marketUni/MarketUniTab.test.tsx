import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { parseUnits } from 'viem';
import MarketUniTab from './MarketUniTab';
import type { UniMarket } from '../../../hooks/useUniMarket';
import { mainnetAddresses } from '../../../lib/contracts';
import {
  addQuote,
  addSteps,
  positionView,
  removeQuote,
  swapQuote,
  swapSteps,
  type PoolState,
} from '../../../lib/uniV2Math';
import { SLIPPAGE_OPTIONS, UNISWAP_TRADE_URL } from '../../../data/uniMarketConfig';

// ---------------------------------------------------------------------------
// The tab is a pure renderer of `useUniMarket()`. The hook's chain logic is
// covered in useUniMarket.test.tsx and uniV2Math.test.ts; here it is replaced
// by a fully populated fixture so these tests assert rendering, mode switching,
// the picker, CTA states and the review modal.
// ---------------------------------------------------------------------------

const e18 = (n: string) => parseUnits(n, 18);
const POOL: PoolState = { rPh: e18('2000'), rS: e18('1850'), totalSupply: e18('1900'), spx: e18('1.0735') };

let market: UniMarket;
vi.mock('../../../hooks/useUniMarket', () => ({ useUniMarket: () => market }));

const swap = swapQuote({
  tok: 'USDC', dir: 'buy', inWei: parseUnits('100', 6), quoteOut: e18('93.5'), quoteLoading: false, quoteError: false,
  slip: 0.5, pool: POOL, inBal: parseUnits('10000', 6), allowance: 0n, ethUsd: 0,
});
const add = addQuote({
  depositSym: 'USDS', edited: 'tok', tokWei: e18('100'), phWei: 0n, previewShares: e18('93'), slip: 0.5, pool: POOL,
  tokBal: e18('10000'), phBal: e18('10000'), tokAllowance: 0n, phAllowance: 0n,
});
const remove = removeQuote({ burnWei: e18('5'), lpBal: e18('10'), out: 'sUSDS', previewUsds: undefined, slip: 0.5, pool: POOL, allowance: 0n });

function makeMarket(over: Partial<UniMarket> = {}): UniMarket {
  const fn = () => vi.fn();
  const base = {
    tickerPair: 'phUSD/sUSDS pool · 2.0k phUSD / 1.9k sUSDS',
    tickerPrice: '$0.992987',
    priceAtOrAboveDollar: false,
    uniswapUrl: UNISWAP_TRADE_URL,
    etherscanUrl: '',
    available: true,
    connected: true,
    slippageOptions: SLIPPAGE_OPTIONS,
    deadlineMinutes: 20,
    mode: 'swap',
    topMode: 'swap',
    slip: 0.5,
    settingsOpen: false,
    dir: 'buy',
    token: 'USDC',
    swap,
    payStr: '100',
    recvStr: '93.5',
    payBalText: '10,000.00',
    recvBalText: '10,000.00',
    payUsd: '≈ $100.00',
    recvUsd: '≈ $92.84',
    routeSummary: '3 hops · 1 transaction',
    pickerOpen: false,
    tokenRows: [
      { sym: 'DOLA', name: 'Dola USD Stablecoin', hint: 'via USDC → USDS → sUSDS', balText: '0.00', selected: false },
      { sym: 'USDC', name: 'USD Coin', hint: 'via USDS → sUSDS', balText: '10,000.00', selected: true },
      { sym: 'sUSDS', name: 'Savings USDS', hint: 'direct pair', balText: '10,000.00', selected: false },
    ],
    addSym: 'USDS',
    add,
    addTokens: ['USDS', 'sUSDS'],
    aTokStr: '100',
    aPhStr: '100.54',
    addTokBalText: '10,000.00',
    phBalText: '10,000.00',
    aTokUsd: '≈ $100.00',
    aPhUsd: '≈ $99.83',
    addPickerOpen: false,
    lpSymbol: 'UNI-V2',
    hasPosition: true,
    positionLp: '10.0000',
    positionShare: '0.53%',
    positionS: '9.7368',
    positionPh: '10.52',
    positionValue: '≈ $20.89',
    remove,
    rLpStr: '5',
    lpBalText: '10.0000',
    pctOptions: [
      { p: 0.25, label: '25%', selected: false },
      { p: 0.5, label: '50%', selected: true },
      { p: 0.75, label: '75%', selected: false },
      { p: 1, label: 'Max', selected: false },
    ],
    outOptions: [
      { sym: 'sUSDS', selected: true },
      { sym: 'USDS', selected: false },
    ],
    receiveRows: [
      { sym: 'sUSDS', amount: '4.8684' },
      { sym: 'phUSD', amount: '5.26' },
    ],
    removeNote: 'Paid out at the pool ratio',
    removeUsd: '≈ $10.45',
    cta: { label: 'Review swap', enabled: true },
    modal: null,
    steps: [],
    stepIdx: 0,
    currentStep: undefined,
    pending: false,
    success: false,
    exactApprove: false,
    exactLabel: '',
    legs: [
      { caption: 'You pay', sym: 'USDC', amount: '100.00' },
      { caption: 'You receive (estimated)', sym: 'phUSD', amount: '93.50' },
    ],
    modalTitle: 'Review swap',
    modalActionLabel: 'Approve USDC',
    successText: 'Swapped 100.00 USDC for 93.50 phUSD',
    modalStats: [],
    setTopMode: fn(),
    toSwap: fn(),
    toLiquidity: fn(),
    setLiqAction: fn(),
    setRemoveLp: fn(),
    pickRemovePct: fn(),
    setRemoveOut: fn(),
    toggleSettings: fn(),
    setSlippage: fn(),
    openPicker: fn(),
    closePicker: fn(),
    selectToken: fn(),
    setPay: fn(),
    payMax: fn(),
    flip: fn(),
    toggleAddPicker: fn(),
    selectAddToken: fn(),
    setAddTok: fn(),
    setAddPh: fn(),
    addTokMax: fn(),
    addPhMax: fn(),
    startReview: fn(),
    advanceStep: fn(),
    cancel: fn(),
    done: fn(),
    toggleExactApprove: fn(),
  } as unknown as UniMarket;
  return { ...base, ...over } as UniMarket;
}

const cta = () => within(screen.getByRole('region', { name: 'Trade panel' })).getAllByRole('button').at(-1) as HTMLButtonElement;
const stepSubs = () =>
  within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem').map((li) => li.textContent ?? '');

beforeEach(() => {
  market = makeMarket();
});

describe('MarketUniTab (story 087, live hook mocked)', () => {
  it('no longer renders the mock-preview banner', () => {
    render(<MarketUniTab />);
    expect(screen.queryByText(/Mock preview/)).toBeNull();
    expect(screen.queryByText(/balances, prices and transactions are simulated; nothing is sent on-chain/)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders the official Uniswap logo in the info card', () => {
    render(<MarketUniTab />);
    const svg = screen.getByRole('img', { name: 'Uniswap logo' }).querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 168.3 193.8');
    expect(screen.getByText('phUSD trades on Uniswap')).toBeInTheDocument();
  });

  it('shows the live ticker; below $1 renders pink, at/above $1 green', () => {
    const { unmount } = render(<MarketUniTab />);
    expect(screen.getByText('phUSD/sUSDS pool · 2.0k phUSD / 1.9k sUSDS')).toBeInTheDocument();
    expect(screen.getByTestId('mku-ticker-price').className).toContain('text-pxusd-pink-400');
    unmount();
    market = makeMarket({ tickerPrice: '$1.000100', priceAtOrAboveDollar: true });
    render(<MarketUniTab />);
    expect(screen.getByTestId('mku-ticker-price').className).toContain('text-green-400');
  });

  it('swap: pay input is editable, receive input is read-only (exact-in only)', () => {
    render(<MarketUniTab />);
    const pay = screen.getByLabelText('You pay') as HTMLInputElement;
    const recv = screen.getByLabelText('You receive') as HTMLInputElement;
    expect(pay.readOnly).toBe(false);
    expect(recv.readOnly).toBe(true);
    expect(recv.value).toBe('93.5');
    fireEvent.change(pay, { target: { value: '5' } });
    expect(market.setPay).toHaveBeenCalledWith('5');
    expect(screen.queryByText(/Maximum sold/)).toBeNull();
  });

  it('swap stats and the real route labels render', () => {
    render(<MarketUniTab />);
    expect(screen.getByText('Price impact')).toBeInTheDocument();
    expect(screen.getByText('Minimum received (0.5% slippage)')).toBeInTheDocument();
    expect(screen.getByText('Approve USDC first')).toBeInTheDocument();
    const route = screen.getByRole('list', { name: 'Swap route' });
    expect(within(route).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'USDCSky PSM',
      'USDSsUSDS deposit',
      'sUSDSUniswap V2 · 0.30%',
      'phUSD',
    ]);
    expect(screen.getByText('3 hops · 1 transaction')).toBeInTheDocument();
  });

  it('CTA: enabled starts the review; disabled states render their label', () => {
    const { unmount } = render(<MarketUniTab />);
    expect(cta()).toHaveTextContent('Review swap');
    fireEvent.click(cta());
    expect(market.startReview).toHaveBeenCalled();
    unmount();

    market = makeMarket({ available: false, cta: { label: 'Not available on this network', enabled: false } });
    render(<MarketUniTab />);
    expect(cta()).toHaveTextContent('Not available on this network');
    expect(cta()).toBeDisabled();
  });

  it('flip and MAX call through to the hook', () => {
    render(<MarketUniTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Flip direction: currently buying phUSD' }));
    expect(market.flip).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'MAX' }));
    expect(market.payMax).toHaveBeenCalled();
  });

  it('token picker lists rows and selects', () => {
    market = makeMarket({ pickerOpen: true });
    render(<MarketUniTab />);
    const picker = screen.getByRole('dialog', { name: 'Select a token' });
    expect(within(picker).getByRole('button', { name: /^USDC/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(picker).getByText(/USD Coin · via USDS → sUSDS/)).toBeInTheDocument();
    fireEvent.click(within(picker).getByRole('button', { name: /^sUSDS/ }));
    expect(market.selectToken).toHaveBeenCalledWith('sUSDS');
  });

  it('settings popover selects slippage', () => {
    market = makeMarket({ settingsOpen: true });
    render(<MarketUniTab />);
    expect(screen.getByText('20 min')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0.5%' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '1%' }));
    expect(market.setSlippage).toHaveBeenCalledWith(1);
  });

  it('mode switch: Liquidity tab calls setTopMode', () => {
    render(<MarketUniTab />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Swap', 'Liquidity']);
    fireEvent.click(screen.getByRole('tab', { name: 'Liquidity' }));
    expect(market.setTopMode).toHaveBeenCalledWith('liquidity');
  });

  it('add liquidity: position card, deposit boxes, "up to" deposit and wrap stats', () => {
    market = makeMarket({ mode: 'add', topMode: 'liquidity', cta: { label: 'Review supply', enabled: true } });
    render(<MarketUniTab />);
    const card = screen.getByRole('region', { name: 'Your position' });
    expect(within(card).getByText('0.53% of pool')).toBeInTheDocument();
    expect(screen.getByTestId('mku-pos-lp').textContent).toBe('10.0000');
    expect(screen.getByRole('button', { name: 'Select deposit token, currently USDS' })).toBeInTheDocument();
    expect(screen.getByText('Deposited (up to)')).toBeInTheDocument();
    expect(screen.getByText('Wrapped to sUSDS')).toBeInTheDocument();
    const [tok, ph] = screen.getAllByLabelText('Deposit') as HTMLInputElement[];
    fireEvent.change(tok, { target: { value: '7' } });
    expect(market.setAddTok).toHaveBeenCalledWith('7');
    fireEvent.change(ph, { target: { value: '8' } });
    expect(market.setAddPh).toHaveBeenCalledWith('8');
    expect(cta()).toHaveTextContent('Review supply');
  });

  it('no position: dashed empty card', () => {
    market = makeMarket({ mode: 'add', topMode: 'liquidity', hasPosition: false });
    render(<MarketUniTab />);
    expect(screen.queryByRole('region', { name: 'Your position' })).toBeNull();
    expect(screen.getByText('No liquidity in this pool yet')).toBeInTheDocument();
  });

  it('remove liquidity: chips, receive toggle, rows and burn input', () => {
    market = makeMarket({ mode: 'remove', topMode: 'liquidity', cta: { label: 'Review removal', enabled: true } });
    render(<MarketUniTab />);
    expect(screen.getByText('Balance: 10.0000 UNI-V2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '50%' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    expect(market.pickRemovePct).toHaveBeenCalledWith(1);
    const rows = within(screen.getByRole('list', { name: 'You receive' })).getAllByRole('listitem').map((li) => li.textContent);
    expect(rows).toEqual(['4.8684sUSDS', '5.26phUSD']);
    fireEvent.click(within(screen.getByRole('group', { name: 'Receive the sUSDS side as' })).getByRole('button', { name: 'USDS' }));
    expect(market.setRemoveOut).toHaveBeenCalledWith('USDS');
    fireEvent.change(screen.getByLabelText('Burn LP tokens'), { target: { value: '3' } });
    expect(market.setRemoveLp).toHaveBeenCalledWith('3');
    expect(screen.getByText('Approve UNI-V2 first')).toBeInTheDocument();
  });

  it('review modal: real helper method names, exact-approve checkbox, advance + cancel', () => {
    const steps = swapSteps(swap);
    market = makeMarket({
      modal: 'swap', steps, currentStep: steps[0],
      exactLabel: 'Approve exact amount only (100.00 USDC) instead of unlimited',
    });
    render(<MarketUniTab />);
    const dialog = screen.getByRole('dialog', { name: 'Review swap' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(stepSubs()[0]).toContain('USDC.approve(UniswapHelper)');
    expect(stepSubs()[1]).toContain('UniswapHelper.swapToPhUSD');
    expect(stepSubs().join(' ')).not.toMatch(/zap\.|router\./);
    fireEvent.click(within(dialog).getByRole('checkbox'));
    expect(market.toggleExactApprove).toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve USDC' }));
    expect(market.advanceStep).toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(market.cancel).toHaveBeenCalled();
  });

  it('review modal pending: action and cancel disabled', () => {
    const steps = addSteps(add);
    market = makeMarket({
      modal: 'add', mode: 'add', topMode: 'liquidity', steps, currentStep: steps[0], pending: true,
      modalTitle: 'Review supply', modalActionLabel: 'Confirm in wallet…',
    });
    render(<MarketUniTab />);
    const dialog = screen.getByRole('dialog', { name: 'Review supply' });
    expect(within(dialog).getByRole('button', { name: /Confirm in wallet/ })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(stepSubs()[2]).toContain('UniswapHelper.addLiquidityUSDS');
  });

  it('success: explorer link hidden on Anvil (empty URL), shown with a per-tx URL elsewhere', () => {
    const { unmount } = render(<MarketUniTab />);
    unmount();
    market = makeMarket({ modal: 'swap', success: true, modalTitle: 'Swap complete', etherscanUrl: '' });
    const r = render(<MarketUniTab />);
    const done = screen.getByRole('dialog', { name: 'Swap complete' });
    expect(within(done).getByText('Swapped 100.00 USDC for 93.50 phUSD')).toBeInTheDocument();
    expect(within(done).queryByRole('link', { name: /View on Etherscan/ })).toBeNull();
    fireEvent.click(within(done).getByRole('button', { name: 'Done' }));
    expect(market.done).toHaveBeenCalled();
    r.unmount();

    market = makeMarket({ modal: 'swap', success: true, modalTitle: 'Swap complete', etherscanUrl: 'https://etherscan.io/tx/0xabc' });
    render(<MarketUniTab />);
    const link = screen.getByRole('link', { name: /View on Etherscan/ });
    expect(link).toHaveAttribute('href', 'https://etherscan.io/tx/0xabc');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders the "Or trade directly on Uniswap" link with real mainnet addresses', () => {
    render(<MarketUniTab />);
    const link = screen.getByRole('link', { name: /Or trade directly on Uniswap/ });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute(
      'href',
      `https://app.uniswap.org/swap?chain=mainnet&inputCurrency=${mainnetAddresses.SUSDS}&outputCurrency=${mainnetAddresses.PhUSD}`,
    );
  });

  it('fixture sanity: position maths come from the real totalSupply', () => {
    const p = positionView(e18('10'), POOL);
    expect(p.s).toBe((e18('10') * POOL.rS) / POOL.totalSupply);
  });
});
