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
    mintCostFormatted: '25,000.00 USDS',
    mintCostUsd: 25000,
    mintTokenLogo: '/assets/USDS.png',
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

  it('renders the eyebrow and heading, without the wordy sub-copy', () => {
    render(<NudgeMockPanel addToast={addToast} />);

    expect(screen.getByTestId('nudge-mock-eyebrow')).toHaveTextContent(
      'Whale Mint · Phoenix ×40'
    );
    expect(
      screen.getByRole('heading', { name: 'Claim the nudge reward' })
    ).toBeInTheDocument();
    // The "Pay … once. You keep all 40 …" paragraph was replaced by the
    // stacked Mint cost / Pot value / Net mint cost line items.
    expect(screen.getByTestId('nudge-mock-panel')).not.toHaveTextContent(
      'You keep all 40 Liquid Sky Phoenix NFTs'
    );
  });

  it('shows the mint cost beside the pot value, amount split from unit', () => {
    render(<NudgeMockPanel addToast={addToast} />);

    const cost = screen.getByTestId('nudge-mock-mint-cost');
    expect(cost).toHaveTextContent('25,000.00');
    expect(cost).toHaveTextContent('USDS');
  });

  it('renders Net mint cost as mint cost minus pot value (USDS valued at $1)', () => {
    render(<NudgeMockPanel addToast={addToast} />);

    // 25000 − (12480 + 6294 + 1942 + 980 + 1104) = 2200
    expect(screen.getByText('Net mint cost')).toBeInTheDocument();
    expect(screen.getByTestId('nudge-mock-net-cost')).toHaveTextContent(
      '$2,200.00'
    );
  });

  it('labels an over-sized pot as a Net credit rather than a negative cost', () => {
    // Pot ($22,800) worth more than the mint — a mispricing, not a normal
    // state, but it must not render as "-$…" under a "Net cost" label.
    fixture.value = {
      ...baseMock(REAL_TOKENS),
      mintCostFormatted: '8,412.5316 USDS',
      mintCostUsd: 8412.5316,
    };
    render(<NudgeMockPanel addToast={addToast} />);

    expect(screen.getByText('Net credit')).toBeInTheDocument();
    expect(screen.queryByText('Net mint cost')).not.toBeInTheDocument();
    expect(screen.getByTestId('nudge-mock-net-cost')).toHaveTextContent(
      '$14,387.47'
    );
  });

  it('renders a single "You pay" chip carrying the mint cost and its unit', () => {
    render(<NudgeMockPanel addToast={addToast} />);

    expect(screen.getByText('You pay')).toBeInTheDocument();
    const chip = screen.getByTestId('nudge-mock-chip-pay');
    expect(chip).toHaveTextContent('25,000.00');
    expect(chip).toHaveTextContent('USDS');
    expect(
      screen.queryByTestId('nudge-mock-pay-logo-fallback')
    ).not.toBeInTheDocument();
  });

  it('switches the pot between the full fixture and a USDC + KENDU pair', async () => {
    const user = userEvent.setup();
    render(<NudgeMockPanel addToast={addToast} />);

    const toggle = screen.getByTestId('nudge-mock-pot-size-switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('nudge-mock-token-count')).toHaveTextContent(
      '5 tokens'
    );

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('nudge-mock-token-count')).toHaveTextContent(
      '2 tokens'
    );
    // Only USDC + KENDU survive, in whitelist order — the filter never re-sorts.
    const strip = screen.getByTestId('nudge-mock-chip-strip');
    expect(
      Array.from(strip.children)
        .slice(1)
        .map((c) => c.getAttribute('data-testid'))
    ).toEqual(['nudge-mock-chip-USDC', 'nudge-mock-chip-KENDU']);

    await user.click(toggle);
    expect(screen.getByTestId('nudge-mock-chip-sDOLA')).toBeInTheDocument();
    expect(screen.getByTestId('nudge-mock-token-count')).toHaveTextContent(
      '5 tokens'
    );
  });

  it('orders "You pay" above "You receive", swap-UI style', () => {
    render(<NudgeMockPanel addToast={addToast} />);

    const pay = screen.getByText('You pay');
    const receive = screen.getByText('You receive');
    expect(
      pay.compareDocumentPosition(receive) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('falls back to a lettered circle when the payment token has no logo', () => {
    fixture.value = { ...baseMock(REAL_TOKENS), mintTokenLogo: undefined };
    render(<NudgeMockPanel addToast={addToast} />);

    expect(
      screen.getByTestId('nudge-mock-pay-logo-fallback')
    ).toHaveTextContent('U');
  });

  it('degrades to amount-only when the cost string carries no unit', () => {
    fixture.value = { ...baseMock(REAL_TOKENS), mintCostFormatted: '8412.5316' };
    render(<NudgeMockPanel addToast={addToast} />);

    expect(screen.getByTestId('nudge-mock-mint-cost')).toHaveTextContent(
      '8412.5316'
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
      '$22,800'
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
      '$18,774'
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

  it('turns a token with a URL into a new-tab link, and leaves the rest inert', () => {
    fixture.value = baseMock([
      REAL_TOKENS[0],
      { ...REAL_TOKENS[1], url: 'https://www.coingecko.com/en/coins/kendu' },
    ]);
    render(<NudgeMockPanel addToast={addToast} />);

    const link = screen.getByTestId('nudge-mock-chip-link-KENDU');
    expect(link).toHaveAttribute(
      'href',
      'https://www.coingecko.com/en/coins/kendu'
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));

    // The un-linked leg stays a plain chip — no anchor, no animation hooks.
    expect(
      screen.queryByTestId('nudge-mock-chip-link-USDC')
    ).not.toBeInTheDocument();
    const usdc = screen.getByTestId('nudge-mock-chip-USDC');
    expect(usdc.querySelector('.nudge-mock-sheen')).toBeNull();
    expect(usdc.querySelector('.nudge-mock-flip')).toBeNull();
  });

  it('gives a linked chip the sheen and coin-flip treatment', () => {
    fixture.value = baseMock([
      { ...REAL_TOKENS[1], url: 'https://www.coingecko.com/en/coins/kendu' },
    ]);
    render(<NudgeMockPanel addToast={addToast} />);

    const chip = screen.getByTestId('nudge-mock-chip-KENDU');
    expect(chip.querySelector('.nudge-mock-sheen')).not.toBeNull();
    // The logo itself is what flips.
    expect(
      chip.querySelector('.nudge-mock-flip img')
    ).toHaveAttribute('src', REAL_TOKENS[1].logo!);
  });

  it('treats a blank URL as no URL', () => {
    fixture.value = baseMock([{ ...REAL_TOKENS[0], url: '   ' }]);
    render(<NudgeMockPanel addToast={addToast} />);

    expect(
      screen.queryByTestId('nudge-mock-chip-link-USDC')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('nudge-mock-chip-USDC').querySelector('.nudge-mock-sheen')
    ).toBeNull();
  });

  it('wraps the chip strip instead of scrolling it horizontally', () => {
    render(<NudgeMockPanel addToast={addToast} />);
    const strip = screen.getByTestId('nudge-mock-chip-strip');
    expect(strip.className).toContain('flex-wrap');
    expect(strip.className).not.toContain('overflow-x-auto');
  });
});
