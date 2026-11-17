import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import WhaleMockPanel from './WhaleMockPanel';
import type { DiscountBatchMinterState } from '../../../hooks/useDiscountBatchMinter';
import type { DiscountBonusTokensResult } from '../../../hooks/useDiscountBonusTokens';

// ---------------------------------------------------------------------------
// The panel's only data seam is useDiscountBatchMinter; the hook's own reads,
// guards and mint orchestration are covered in useDiscountBatchMinter.test.tsx.
// ---------------------------------------------------------------------------
const hook = vi.hoisted(() => ({ value: null as unknown as DiscountBatchMinterState }));
const mint = vi.hoisted(() => vi.fn());

const NO_BONUS: DiscountBonusTokensResult = { tokens: [], all: [], usdTotal: 0, isPartial: false };
const bonus = vi.hoisted(() => ({ value: null as unknown as DiscountBonusTokensResult }));
vi.mock('../../../hooks/useDiscountBatchMinter', () => ({
  useDiscountBatchMinter: () => ({ ...hook.value, bonus: bonus.value }),
}));

const ONE = 10n ** 18n;

/** Flat 100 USDS price makes every figure exact. */
function live(overrides: {
  free?: number;
  total?: number;
  paid?: number;
  boost?: number;
  effectivePercent?: number;
  maxBoost?: number;
  cap?: number;
  paused?: boolean;
} & Partial<Pick<DiscountBatchMinterState, 'status' | 'blocker' | 'phase'>> = {}): DiscountBatchMinterState {
  const { free = 12, total = 24, paid = 12, boost = 0, effectivePercent = 50, maxBoost = 0, cap = 50, paused = false } = overrides;
  const paidCostRaw = BigInt(paid) * 100n * ONE;
  return {
    status: overrides.status ?? (total > 0 ? 'ready' : 'no-discount'),
    minter: '0x4914000000000000000000000000000000089c1a',
    quote: {
      totalRaw: BigInt(total),
      freeRaw: BigInt(free),
      paidRaw: BigInt(paid),
      paidCostRaw,
      boost,
      effectivePercent,
      total,
      free,
      paid,
    },
    config: {
      discountPercent: 50,
      maxFreePerBatch: cap,
      overflowNFTsPerBoostPoint: 3,
      maxBoost,
      dispatcherIndex: 4,
      paused,
      bonusTokens: [],
    },
    fund: undefined,
    bonus: NO_BONUS,
    payment: {
      address: '0x00000000000000000000000000000000000000d5',
      symbol: 'USDS',
      decimals: 18,
      priceRaw: 100n * ONE,
      growthBps: 0,
    },
    maxPaymentRaw: (paidCostRaw * 10_200n) / 10_000n,
    balanceRaw: 10n ** 30n,
    blocker: overrides.blocker !== undefined ? overrides.blocker : paused ? 'paused' : total > 0 ? null : 'no-discount',
    phase: overrides.phase ?? 'idle',
    mint,
  };
}

const FORBIDDEN = [/\bpot\b/i, /claim/i, /reward/i, /you receive/i, /winner/i, /\bUSDC\b/, /\bKENDU\b/i];

/** Rendered copy, without the inline <style> block's keyframe numbers. */
function visibleText(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('style').forEach((el) => el.remove());
  return clone.textContent ?? '';
}

function expectNoForbiddenCopy(container: HTMLElement) {
  for (const re of FORBIDDEN) expect(visibleText(container)).not.toMatch(re);
}

const BOOSTED = { free: 50, total: 84, paid: 34, boost: 10, effectivePercent: 60, maxBoost: 10 };

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = live();
  bonus.value = NO_BONUS;
});

describe('WhaleMockPanel — live figures', () => {
  it('renders the unboosted batch from the live quote', () => {
    const { container } = render(<WhaleMockPanel />);

    expect(screen.getByTestId('whale-mock-headline')).toHaveTextContent('24 NFTs at 50% off');
    expect(screen.getByTestId('whale-mock-discount')).toHaveTextContent('50% discount');
    expect(screen.queryByTestId('whale-mock-boost-badge')).toBeNull();
    expect(screen.queryByTestId('whale-mock-boost-compare')).toBeNull();
    expect(screen.queryByTestId('whale-mock-cap-sentence')).toBeNull();

    // 24 × 100 usual; live paidCost 12 × 100; 1,200 saved.
    expect(screen.getByTestId('whale-mock-usual-cost')).toHaveTextContent('2,400.00');
    expect(screen.getByTestId('whale-mock-discount-cost')).toHaveTextContent('1,200.00');
    expect(screen.getByTestId('whale-mock-saving')).toHaveTextContent('1,200.00');
    expect(screen.getByTestId('whale-mock-saving')).toHaveTextContent('50.0%');
    expect(screen.getByTestId('whale-mock-quantity')).toHaveTextContent('24 × Liquid Sky Phoenix');
    expect(screen.getByTestId('whale-mock-quantity')).toHaveTextContent(
      '12 covered by the discount fund · 12 paid'
    );
    expect(screen.getByTestId('whale-mock-cta')).toHaveTextContent('Mint 24 NFTs for 1,200.00 USDS');
    expect(screen.getByTestId('whale-mock-cta')).not.toBeDisabled();
    expect(screen.getByTestId('whale-mock-budget-note')).toHaveTextContent('1,224.00 USDS');
    expect(screen.getByTestId('whale-mock-explainer')).toHaveTextContent('discount fund');
    expectNoForbiddenCopy(container);
  });

  it('shows the boost badge and comparison when previewBoost().boost > 0', () => {
    hook.value = live(BOOSTED);
    const { container } = render(<WhaleMockPanel />);

    expect(screen.getByTestId('whale-mock-headline')).toHaveTextContent('84 NFTs at 60% off');
    expect(screen.getByTestId('whale-mock-boost-badge')).toHaveTextContent('10% boost');
    expect(screen.getByTestId('whale-mock-discount')).toHaveTextContent('60% discount');
    // Unboosted: 50 free at 50% → 50 paid. 50 vs 34 at a flat 100 → another 1,600 saved.
    const compare = screen.getByTestId('whale-mock-boost-compare');
    expect(compare).toHaveTextContent('you pay for 34 instead of 50');
    expect(compare).toHaveTextContent('1,600.00 USDS');
    expectNoForbiddenCopy(container);
  });

  it('cap sentence with the boost clause when maxBoost > 0', () => {
    hook.value = live(BOOSTED);
    render(<WhaleMockPanel />);
    const sentence = screen.getByTestId('whale-mock-cap-sentence');
    expect(sentence).toHaveTextContent('This batch has hit the 50-NFT limit.');
    expect(sentence).toHaveTextContent("raises the discount by 1 point for every 3 NFTs' worth, up to +10%.");
  });

  it('plain cap sentence (no boost clause) when maxBoost == 0', () => {
    hook.value = live({ free: 50, total: 100, paid: 50, maxBoost: 0 });
    const { container } = render(<WhaleMockPanel />);
    const sentence = screen.getByTestId('whale-mock-cap-sentence');
    expect(sentence).toHaveTextContent('This batch has hit the 50-NFT limit. Extra funding carries over to the next batch.');
    expect(sentence.textContent).not.toMatch(/raises the discount|up to \+/);
    expect(screen.queryByTestId('whale-mock-boost-badge')).toBeNull();
    expect(screen.queryByTestId('whale-mock-boost-compare')).toBeNull();
    expectNoForbiddenCopy(container);
  });

  it('no cap sentence below the cap', () => {
    hook.value = live({ free: 49, total: 98, paid: 49 });
    render(<WhaleMockPanel />);
    expect(screen.queryByTestId('whale-mock-cap-sentence')).toBeNull();
  });

  it('has no debug switch', () => {
    render(<WhaleMockPanel />);
    expect(screen.queryByTestId('whale-mock-debug-strip')).toBeNull();
    expect(screen.queryByTestId('whale-mock-debug-boost')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText(/Simulate cap reached/)).toBeNull();
    expect(screen.queryByText(/Admin debug/)).toBeNull();
  });

  it('CTA calls the hook mint', () => {
    render(<WhaleMockPanel />);
    fireEvent.click(screen.getByTestId('whale-mock-cta'));
    expect(mint).toHaveBeenCalledTimes(1);
  });
});

describe('WhaleMockPanel — states', () => {
  it('unavailable (zero address)', () => {
    hook.value = { ...live(), status: 'unavailable', quote: undefined, config: undefined, payment: undefined };
    const { container } = render(<WhaleMockPanel />);
    expect(screen.getByTestId('whale-mock-unavailable')).toHaveTextContent('Not available on this network yet');
    expect(screen.queryByTestId('whale-mock-cta')).toBeNull();
    expectNoForbiddenCopy(container);
  });

  it('loading → skeleton, no figures, no mock fallback', () => {
    hook.value = { ...live(), status: 'loading', quote: undefined, config: undefined, payment: undefined };
    const { container } = render(<WhaleMockPanel />);
    expect(screen.getByTestId('whale-mock-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('whale-mock-headline')).toBeNull();
    expect(visibleText(container)).not.toMatch(/\d+\.\d\d/);
    expectNoForbiddenCopy(container);
  });

  it('no discount → message, disabled CTA, and no amounts', () => {
    hook.value = live({ free: 0, total: 0, paid: 0, effectivePercent: 0 });
    const { container } = render(<WhaleMockPanel />);
    expect(screen.getByTestId('whale-mock-no-discount')).toHaveTextContent('No discount batch available right now');
    expect(screen.getByTestId('whale-mock-cta')).toBeDisabled();
    expect(screen.getByTestId('whale-mock-cta')).toHaveTextContent(/^Mint$/);
    expect(screen.queryByTestId('whale-mock-usual-cost')).toBeNull();
    expect(screen.queryByTestId('whale-mock-discount-cost')).toBeNull();
    expect(screen.queryByTestId('whale-mock-saving')).toBeNull();
    expect(screen.queryByTestId('whale-mock-budget-note')).toBeNull();
    expect(visibleText(container)).not.toMatch(/USDS/);
    expect(visibleText(container)).not.toMatch(/\d+\.\d\d/);
    expectNoForbiddenCopy(container);
  });

  it('paused → CTA disabled with a paused label', () => {
    hook.value = live({ paused: true });
    const { container } = render(<WhaleMockPanel />);
    expect(screen.getByTestId('whale-mock-cta')).toBeDisabled();
    expect(screen.getByTestId('whale-mock-cta')).toHaveTextContent('Minting paused');
    expect(screen.getByTestId('whale-mock-paused')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('whale-mock-cta'));
    expect(mint).not.toHaveBeenCalled();
    expectNoForbiddenCopy(container);
  });

  it('insufficient balance → "Insufficient USDS", disabled', () => {
    hook.value = live({ blocker: 'insufficient-balance' });
    const { container } = render(<WhaleMockPanel />);
    expect(screen.getByTestId('whale-mock-cta')).toBeDisabled();
    expect(screen.getByTestId('whale-mock-cta')).toHaveTextContent('Insufficient USDS');
    expectNoForbiddenCopy(container);
  });

  it('disconnected → connect prompt, disabled', () => {
    hook.value = live({ blocker: 'disconnected' });
    render(<WhaleMockPanel />);
    expect(screen.getByTestId('whale-mock-cta')).toBeDisabled();
    expect(screen.getByTestId('whale-mock-cta')).toHaveTextContent('Connect wallet to mint');
  });

  it.each([
    ['checking', 'Checking batch…'],
    ['approving', 'Approving USDS…'],
    ['minting', 'Minting…'],
  ] as const)('busy (%s) → disabled with progress label', (phase, label) => {
    hook.value = live({ blocker: 'busy', phase });
    const { container } = render(<WhaleMockPanel />);
    expect(screen.getByTestId('whale-mock-cta')).toBeDisabled();
    expect(screen.getByTestId('whale-mock-cta')).toHaveTextContent(label);
    expectNoForbiddenCopy(container);
  });
});

describe('WhaleMockPanel — discount fund and bonus tokens', () => {
  it('shows the fund size, next step and reserve', () => {
    hook.value = {
      ...live(),
      fund: { potUsdRaw: 18_762_794n * 10n ** 12n, nextStepUsdcRaw: 1_681_857n, reservedUsdcRaw: 2_500_000n },
    };
    render(<WhaleMockPanel />);
    expect(screen.getByTestId('whale-mock-fund')).toHaveTextContent('Discount fund: $18.76');
    expect(screen.getByTestId('whale-mock-fund-next')).toHaveTextContent('$1.68 more covers another NFT');
    expect(screen.getByTestId('whale-mock-fund-reserved')).toHaveTextContent('$2.50 reserved');
  });

  it('omits the next-step and reserve clauses when they are zero', () => {
    hook.value = { ...live(), fund: { potUsdRaw: 10n * ONE, nextStepUsdcRaw: 0n, reservedUsdcRaw: 0n } };
    render(<WhaleMockPanel />);
    expect(screen.getByTestId('whale-mock-fund')).toHaveTextContent('Discount fund: $10.00');
    expect(screen.queryByTestId('whale-mock-fund-next')).toBeNull();
    expect(screen.queryByTestId('whale-mock-fund-reserved')).toBeNull();
  });

  it('lists the bonus tokens with their USD total', () => {
    bonus.value = {
      tokens: [
        { address: '0x01', symbol: 'phUSD', canonical: 'PHUSD', decimals: 18, totalRaw: 109n * ONE, amountFormatted: '109.72', usd: 109.72 },
        { address: '0x02', symbol: 'KENDU', canonical: 'KENDU', decimals: 18, totalRaw: 1087n * ONE, amountFormatted: '1,088', usd: 0.05 },
      ],
      all: [],
      usdTotal: 109.77,
      isPartial: false,
    };
    render(<WhaleMockPanel />);
    expect(screen.getByTestId('whale-mock-bonus')).toHaveTextContent('Plus bonus tokens');
    expect(screen.getByTestId('whale-mock-bonus-total')).toHaveTextContent('≈ $109.77');
    expect(screen.getByTestId('whale-mock-bonus-PHUSD')).toHaveTextContent('109.72phUSD');
    expect(screen.getByTestId('whale-mock-bonus-KENDU')).toHaveTextContent('1,088KENDU');
  });

  it('marks the total as a lower bound when a leg is unpriced', () => {
    bonus.value = {
      tokens: [{ address: '0x03', symbol: 'ODD', canonical: 'ODD', decimals: 18, totalRaw: ONE, amountFormatted: '1.00', usd: null }],
      all: [],
      usdTotal: 0,
      isPartial: true,
    };
    render(<WhaleMockPanel />);
    expect(screen.getByTestId('whale-mock-bonus-ODD')).toBeInTheDocument();
    expect(screen.queryByTestId('whale-mock-bonus-total')).toBeNull();
  });

  it('hides the bonus section when there are no bonus tokens', () => {
    render(<WhaleMockPanel />);
    expect(screen.queryByTestId('whale-mock-bonus')).toBeNull();
  });
});
