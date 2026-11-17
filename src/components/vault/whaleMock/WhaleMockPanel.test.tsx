import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import WhaleMockPanel from './WhaleMockPanel';

// ---------------------------------------------------------------------------
// The mock's only chain input is the index-4 USDS row from useMinterPageView,
// so that hook is the only seam stubbed. wagmi is stubbed defensively so a
// stray write hook would be caught by the "no wallet call" assertion.
// ---------------------------------------------------------------------------
const minterResult = vi.hoisted(() => ({ value: null as unknown }));
const wagmiWrite = vi.hoisted(() => ({ writeContract: vi.fn() }));

vi.mock('../../../hooks/useMinterPageView', () => ({
  useMinterPageView: () => minterResult.value,
}));

vi.mock('wagmi', () => ({
  useWriteContract: () => ({ writeContract: wagmiWrite.writeContract }),
  useAccount: () => ({ address: undefined }),
}));

const ONE = 10n ** 18n;

function usdsRow(priceRaw: bigint, growthBasisPoints = 0) {
  return {
    allowanceRaw: 0n,
    priceRaw,
    balanceRaw: 0n,
    allowance: '0',
    price: '0',
    growthBasisPoints,
    balance: '0',
    nftBalance: 0,
    dispatcherIndex: 4,
    decimals: 18,
  };
}

function withPrice(priceRaw: bigint, growth = 0) {
  minterResult.value = {
    data: { USDS: usdsRow(priceRaw, growth) },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

const FORBIDDEN = [/\bpot\b/i, /claim/i, /reward/i, /you receive/i, /winner/i, /\bUSDC\b/, /\bKENDU\b/i];

beforeEach(() => {
  vi.clearAllMocks();
  // Flat 100 USDS price makes the figures exact.
  withPrice(100n * ONE, 0);
});

describe('WhaleMockPanel', () => {
  it('renders the default (normal) figures', () => {
    render(<WhaleMockPanel addToast={vi.fn()} />);

    expect(screen.getByTestId('whale-mock-headline')).toHaveTextContent('24 NFTs at 50% off');
    expect(screen.getByTestId('whale-mock-discount')).toHaveTextContent('50% discount');
    expect(screen.queryByTestId('whale-mock-boost-badge')).toBeNull();
    expect(screen.queryByTestId('whale-mock-boost-compare')).toBeNull();
    expect(screen.queryByTestId('whale-mock-cap-sentence')).toBeNull();

    // 24 × 100 usual; 12 × 100 paid; 1,200 saved.
    expect(screen.getByTestId('whale-mock-usual-cost')).toHaveTextContent('2,400.00');
    expect(screen.getByTestId('whale-mock-discount-cost')).toHaveTextContent('1,200.00');
    expect(screen.getByTestId('whale-mock-saving')).toHaveTextContent('1,200.00');
    expect(screen.getByTestId('whale-mock-saving')).toHaveTextContent('50.0%');
    expect(screen.getByTestId('whale-mock-quantity')).toHaveTextContent('24 × Liquid Sky Phoenix');
    expect(screen.getByTestId('whale-mock-quantity')).toHaveTextContent(
      '12 covered by the discount fund · 12 paid'
    );
    expect(screen.getByTestId('whale-mock-cta')).toHaveTextContent('Mint 24 NFTs for 1,200.00 USDS');
    expect(screen.getByTestId('whale-mock-explainer')).toHaveTextContent('discount fund');
  });

  it('debug switch shows the boosted, cap-reached state', () => {
    render(<WhaleMockPanel addToast={vi.fn()} />);

    const toggle = screen.getByTestId('whale-mock-debug-boost');
    expect(toggle).toHaveAttribute('role', 'switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('whale-mock-headline')).toHaveTextContent('84 NFTs at 60% off');
    expect(screen.getByTestId('whale-mock-boost-badge')).toHaveTextContent('10% boost');
    expect(screen.getByTestId('whale-mock-discount')).toHaveTextContent('60% discount');
    // 50 vs 34 paid at a flat 100 → another 1,600 saved.
    const compare = screen.getByTestId('whale-mock-boost-compare');
    expect(compare).toHaveTextContent('you pay for 34 instead of 50');
    expect(compare).toHaveTextContent('1,600.00 USDS');
    expect(screen.getByTestId('whale-mock-cap-sentence')).toHaveTextContent(
      'This batch has hit the 50-NFT limit'
    );
    expect(screen.getByTestId('whale-mock-cap-sentence')).toHaveTextContent('up to +10%');

    fireEvent.click(toggle);
    expect(screen.getByTestId('whale-mock-headline')).toHaveTextContent('24 NFTs at 50% off');
    expect(screen.queryByTestId('whale-mock-boost-compare')).toBeNull();
  });

  it('CTA fires the info toast and makes no wallet call', () => {
    const addToast = vi.fn();
    render(<WhaleMockPanel addToast={addToast} />);

    fireEvent.click(screen.getByTestId('whale-mock-cta'));

    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'info', title: 'Preview only' })
    );
    expect(wagmiWrite.writeContract).not.toHaveBeenCalled();
  });

  it('never shows the forbidden wording, in either switch state', () => {
    const { container } = render(<WhaleMockPanel addToast={vi.fn()} />);
    for (const re of FORBIDDEN) expect(container.textContent ?? '').not.toMatch(re);

    fireEvent.click(screen.getByTestId('whale-mock-debug-boost'));
    for (const re of FORBIDDEN) expect(container.textContent ?? '').not.toMatch(re);
  });

  it('falls back to the mock price when useMinterPageView has no USDS row', () => {
    minterResult.value = { data: null, isLoading: true, isError: false, error: null, refetch: vi.fn() };
    render(<WhaleMockPanel addToast={vi.fn()} />);

    // Fallback: 10 USDS, 10 bps growth.
    expect(screen.getByTestId('whale-mock-headline')).toHaveTextContent('24 NFTs at 50% off');
    expect(screen.getByText('10.00 USDS per NFT now')).toBeInTheDocument();
    expect(screen.getByTestId('whale-mock-cta')).not.toBeDisabled();
  });

  it('uses the live price when present', () => {
    withPrice(3n * ONE, 0);
    render(<WhaleMockPanel addToast={vi.fn()} />);
    expect(screen.getByTestId('whale-mock-discount-cost')).toHaveTextContent('36.00');
  });
});
