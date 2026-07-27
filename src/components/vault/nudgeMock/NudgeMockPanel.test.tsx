import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NudgeMockPanel from './NudgeMockPanel';
import type { NudgeMockToken } from '../../../data/nudgeMockData';

// ---------------------------------------------------------------------------
// The panel is a pure mock — no wagmi, no contexts, no hooks to stub. The only
// thing we mock is the fixture module itself, so individual tests can swap in
// degenerate pots (single token, token with no logo) without the component
// needing props it will never have in production.
// ---------------------------------------------------------------------------
const REAL_TOKENS: NudgeMockToken[] = [
  { symbol: 'USDC', logo: '/assets/usdc-logo.svg', amountFormatted: '12,480.00', usd: 12480 },
  { symbol: 'KENDU', logo: '/assets/KENDU.png', amountFormatted: '118,000', usd: 6294 },
  { symbol: 'sDOLA', logo: '/assets/sDOLA.png', amountFormatted: '1,904.20', usd: 1942 },
  { symbol: 'USDe', logo: '/assets/USDe.png', amountFormatted: '980.00', usd: 980 },
  { symbol: 'FLAX', logo: '/assets/Flax.png', amountFormatted: '48,000.00', usd: 1104 },
];

const fixture = vi.hoisted(() => ({
  value: null as unknown,
}));

vi.mock('../../../data/nudgeMockData', () => ({
  get NUDGE_MOCK() {
    return fixture.value;
  },
  NUDGE_MOCK_CYAN: 'oklch(78% 0.13 220)',
}));

function baseMock(tokens: NudgeMockToken[]) {
  return {
    nftCount: 40,
    nftCollectionName: 'Liquid Sky Phoenix',
    mintCostFormatted: '8,412.5316 USDS',
    whaleArt: '/assets/whale-phoenix.png',
    tokens,
  };
}

const addToast = vi.fn(() => 'toast-id');

beforeEach(() => {
  fixture.value = baseMock(REAL_TOKENS);
  addToast.mockClear();
});

describe('NudgeMockPanel', () => {
  it('always renders (never self-hides, unlike WhaleMintPanel)', () => {
    render(<NudgeMockPanel addToast={addToast} />);
    expect(screen.getByTestId('nudge-mock-panel')).toBeInTheDocument();
  });

  it('renders the eyebrow, heading and mint-cost sub-copy', () => {
    render(<NudgeMockPanel addToast={addToast} />);

    expect(screen.getByTestId('nudge-mock-eyebrow')).toHaveTextContent(
      'Whale Mint · Phoenix ×40'
    );
    expect(
      screen.getByRole('heading', { name: 'Claim the nudge reward' })
    ).toBeInTheDocument();
    expect(screen.getByText('8,412.5316 USDS')).toBeInTheDocument();
    expect(screen.getByTestId('nudge-mock-panel')).toHaveTextContent(
      'You keep all 40 Liquid Sky Phoenix NFTs'
    );
  });

  it('renders the NFT chip first, then every reward token in fixture order', () => {
    render(<NudgeMockPanel addToast={addToast} />);

    const strip = screen.getByTestId('nudge-mock-chip-strip');
    const chips = Array.from(strip.children);

    // NFT chip leads the strip.
    expect(chips[0]).toBe(screen.getByTestId('nudge-mock-chip-nft'));
    expect(chips[0]).toHaveTextContent('40 NFTs');
    expect(chips[0]).toHaveTextContent('Liquid Sky Phoenix');

    // Then one chip per token, in array order — never sorted by USD value.
    expect(chips.slice(1).map((c) => c.getAttribute('data-testid'))).toEqual([
      'nudge-mock-chip-USDC',
      'nudge-mock-chip-KENDU',
      'nudge-mock-chip-sDOLA',
      'nudge-mock-chip-USDe',
      'nudge-mock-chip-FLAX',
    ]);
  });

  it('renders all five token symbols and amounts with their real logos', () => {
    render(<NudgeMockPanel addToast={addToast} />);

    for (const token of REAL_TOKENS) {
      const chip = screen.getByTestId(`nudge-mock-chip-${token.symbol}`);
      expect(chip).toHaveTextContent(token.symbol);
      expect(chip).toHaveTextContent(token.amountFormatted);

      // Real bundled art, not the lettered-circle fallback.
      const img = chip.querySelector('img');
      expect(img).not.toBeNull();
      expect(img).toHaveAttribute('src', token.logo!);
      expect(
        within(chip).queryByTestId(`nudge-mock-logo-fallback-${token.symbol}`)
      ).not.toBeInTheDocument();
    }
  });

  it('derives the pot total by summing tokens[].usd', () => {
    render(<NudgeMockPanel addToast={addToast} />);

    // 12480 + 6294 + 1942 + 980 + 1104 = 22800
    expect(screen.getByTestId('nudge-mock-pot-total')).toHaveTextContent(
      '≈ $22,800'
    );
    expect(screen.getByTestId('nudge-mock-footer')).toHaveTextContent(
      'totaling $22,800.'
    );
  });

  it('recomputes the pot total when the token set changes', () => {
    fixture.value = baseMock(REAL_TOKENS.slice(0, 2));
    render(<NudgeMockPanel addToast={addToast} />);

    // 12480 + 6294 = 18774
    expect(screen.getByTestId('nudge-mock-pot-total')).toHaveTextContent(
      '≈ $18,774'
    );
  });

  it('renders a single-token pot with exactly one "+" separator and no dangling one', () => {
    fixture.value = baseMock(REAL_TOKENS.slice(0, 1));
    render(<NudgeMockPanel addToast={addToast} />);

    const strip = screen.getByTestId('nudge-mock-chip-strip');
    expect(strip.children).toHaveLength(2); // NFT chip + one token chip
    expect(within(strip).getAllByText('+')).toHaveLength(1);
    expect(screen.getByTestId('nudge-mock-chip-USDC')).toBeInTheDocument();
  });

  it('renders no separator at all for an empty pot', () => {
    fixture.value = baseMock([]);
    render(<NudgeMockPanel addToast={addToast} />);

    const strip = screen.getByTestId('nudge-mock-chip-strip');
    expect(strip.children).toHaveLength(1);
    expect(within(strip).queryAllByText('+')).toHaveLength(0);
  });

  it('falls back to a lettered circle for a token with no bundled logo', () => {
    fixture.value = baseMock([
      { symbol: 'WHITELISTED', amountFormatted: '1,000.00', usd: 1000 },
    ]);
    render(<NudgeMockPanel addToast={addToast} />);

    const fallback = screen.getByTestId('nudge-mock-logo-fallback-WHITELISTED');
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveTextContent('W');

    const chip = screen.getByTestId('nudge-mock-chip-WHITELISTED');
    expect(chip.querySelector('img')).toBeNull();
  });

  it('fires a "coming soon" toast from the CTA and never a transaction', async () => {
    const user = userEvent.setup();
    render(<NudgeMockPanel addToast={addToast} />);

    const cta = screen.getByTestId('nudge-mock-cta');
    expect(cta).toHaveTextContent('Mint 40 — Claim Reward');

    await user.click(cta);

    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'info', title: 'Coming soon' })
    );
  });

  it('applies the scroll-snap chip strip container', () => {
    render(<NudgeMockPanel addToast={addToast} />);
    const strip = screen.getByTestId('nudge-mock-chip-strip');
    expect(strip.className).toContain('overflow-x-auto');
    expect(strip).toHaveStyle({ scrollSnapType: 'x proximity' });
  });
});
