import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import WhaleDiscountPanel from './WhaleDiscountPanel';
import type { UseNudgePotResult, NudgePotToken } from '../../../hooks/useNudgePot';

// ---------------------------------------------------------------------------
// The panel is a pure projection of `useNudgePot`, so that hook is the only
// seam we stub. The confirm modal is stubbed too — it opens real wagmi write
// hooks and has nothing to say about how the banner renders.
// ---------------------------------------------------------------------------
const potResult = vi.hoisted(() => ({ value: null as unknown }));

vi.mock('../../../hooks/useNudgePot', () => ({
  useNudgePot: () => potResult.value,
}));

vi.mock('./WhaleDiscountConfirmModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="whale-discount-modal" /> : null,
}));

/**
 * Settled-only leg by default: everything already in the minter's balance,
 * nothing on the streamer. Pass `pendingRaw` / `bufferRaw` /
 * `rewardPerSecondRaw` / `isStreaming` to exercise the streamed case.
 */
function token(overrides: Partial<NudgePotToken> = {}): NudgePotToken {
  const balanceRaw = overrides.balanceRaw ?? 12_480_000_000n;
  const pendingRaw = overrides.pendingRaw ?? 0n;
  return {
    address: '0x0000000000000000000000000000000000000001',
    symbol: 'USDC',
    canonical: 'USDC',
    decimals: 6,
    balanceRaw,
    pendingRaw,
    totalRaw: balanceRaw + pendingRaw,
    bufferRaw: 0n,
    rewardPerSecondRaw: 0n,
    isStreaming: false,
    amountFormatted: '12,480',
    usd: 12480,
    usdPerUnit: 1,
    logo: '/assets/usdc-logo.svg',
    ...overrides,
  };
}

function basePot(overrides: Partial<UseNudgePotResult> = {}): UseNudgePotResult {
  return {
    tokens: [
      token(),
      token({
        address: '0x0000000000000000000000000000000000000002',
        symbol: 'KENDU',
        canonical: 'KENDU',
        decimals: 18,
        balanceRaw: 118_000n * 10n ** 18n,
        amountFormatted: '118,000',
        usd: 6294,
        usdPerUnit: 6294 / 118_000,
        url: 'https://www.coingecko.com/en/coins/kendu',
      }),
    ],
    nudgeSizeRaw: 40n,
    count: 40,
    payment: {
      address: '0x00000000000000000000000000000000000000aa',
      prefix: 'USDS',
      symbol: 'USDS',
      decimals: 18,
      usdPerUnit: 1,
    },
    mintCostRaw: 25_000n * 10n ** 18n,
    mintBudgetRaw: 25_500n * 10n ** 18n,
    mintCostUsd: 25000,
    potUsd: 18774,
    isPotValuePartial: false,
    hasReward: true,
    minterAddress: '0x00000000000000000000000000000000000000ff',
    isLoading: false,
    isUnavailable: false,
    // Fixed anchor: with no streaming leg the live layer adds nothing, so the
    // rendered figures stay deterministic.
    readAtMs: 1_700_000_000_000,
    refetch: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  potResult.value = basePot();
});

describe('WhaleDiscountPanel', () => {
  it('renders one chip per whitelisted token, in whitelist order', () => {
    render(<WhaleDiscountPanel />);

    const strip = screen.getByTestId('whale-discount-chip-strip');
    // Excludes `chip-link-*`, the inner anchor a linked chip wraps its body in.
    const chips = within(strip).getAllByTestId(/^whale-discount-chip-(?!link-)/);

    // NFT chip first, then the reward tokens in the order the hook returned.
    expect(chips.map((c) => c.dataset.testid ?? c.getAttribute('data-testid'))).toEqual([
      'whale-discount-chip-nft',
      'whale-discount-chip-USDC',
      'whale-discount-chip-KENDU',
    ]);
  });

  it('links only the tokens that carry a URL', () => {
    render(<WhaleDiscountPanel />);

    expect(screen.getByTestId('whale-discount-chip-link-KENDU')).toHaveAttribute(
      'href',
      'https://www.coingecko.com/en/coins/kendu'
    );
    expect(screen.queryByTestId('whale-discount-chip-link-USDC')).toBeNull();
  });

  it('shows the aggregate pot value and the net cost subtraction', () => {
    render(<WhaleDiscountPanel />);

    expect(screen.getByTestId('whale-discount-pot-total')).toHaveTextContent(
      '$18,774.00'
    );
    // 25,000 paid − 18,774 pot = 6,226 net.
    expect(screen.getByTestId('whale-discount-net-cost')).toHaveTextContent(
      '$6,226.00'
    );
  });

  it('leaves an unpriced leg out of the USD total, without qualifying it', () => {
    potResult.value = basePot({
      tokens: [
        token(),
        token({
          address: '0x0000000000000000000000000000000000000003',
          symbol: 'FLAX',
          canonical: 'FLAX',
          decimals: 18,
          balanceRaw: 48_000n * 10n ** 18n,
          amountFormatted: '48,000',
          usd: null,
          usdPerUnit: null,
        }),
      ],
      potUsd: 12480,
      isPotValuePartial: true,
    });

    render(<WhaleDiscountPanel />);

    // FLAX has no price, so it contributes nothing to the total — but the
    // figures are shown plainly, with no ≥/≤ qualifier.
    expect(screen.getByTestId('whale-discount-pot-total')).toHaveTextContent(
      '$12,480.00'
    );
    expect(screen.getByTestId('whale-discount-pot-total').textContent).not.toMatch(
      /[≥≤]/
    );
    expect(screen.getByTestId('whale-discount-net-cost')).toHaveTextContent(
      '$12,520.00'
    );
    expect(screen.getByTestId('whale-discount-net-cost').textContent).not.toMatch(
      /[≥≤]/
    );
  });

  it('reports a net credit when the pot is worth more than the mint', () => {
    // 30,000 USDC against a 25,000 USDS mint.
    potResult.value = basePot({
      tokens: [token({ balanceRaw: 30_000_000_000n })],
      potUsd: 30000,
    });

    render(<WhaleDiscountPanel />);

    expect(screen.getByTestId('whale-discount-net-cost')).toHaveTextContent(
      '$5,000.00'
    );
    expect(screen.getByText('Net credit')).toBeInTheDocument();
  });

  it('falls back to a lettered circle for a token with no bundled art', () => {
    potResult.value = basePot({
      tokens: [token({ symbol: 'WEIRD', canonical: 'WEIRD', logo: undefined })],
      potUsd: 12480,
    });

    render(<WhaleDiscountPanel />);

    expect(
      screen.getByTestId('whale-discount-logo-fallback-WEIRD')
    ).toHaveTextContent('W');
  });

  it('hides a whitelisted token that has nothing in the pot', () => {
    potResult.value = basePot({
      tokens: [
        token(),
        token({
          address: '0x0000000000000000000000000000000000000002',
          symbol: 'KENDU',
          canonical: 'KENDU',
          decimals: 18,
          balanceRaw: 0n,
          amountFormatted: '0',
          usd: 0,
          usdPerUnit: 0.05,
        }),
      ],
    });

    render(<WhaleDiscountPanel />);

    // The NFT chip and the funded leg stay; the empty leg takes its leading
    // `+` with it rather than leaving a dangling separator.
    expect(screen.getByTestId('whale-discount-chip-USDC')).toBeInTheDocument();
    expect(screen.queryByTestId('whale-discount-chip-KENDU')).toBeNull();
    expect(screen.getByTestId('whale-discount-chip-nft')).toBeInTheDocument();
  });

  it('disables the CTA and explains itself when the pot is empty', () => {
    potResult.value = basePot({ tokens: [], hasReward: false, potUsd: 0 });

    render(<WhaleDiscountPanel />);

    expect(screen.getByTestId('whale-discount-cta')).toBeDisabled();
    expect(screen.getByTestId('whale-discount-empty-pot')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // NudgeStreamer legs. `batchMint` flushes each token's accrued stream into
  // the pot before it snapshots balances, so an amount sitting on the streamer
  // is genuinely part of the reward and must be counted and shown as such.
  // -------------------------------------------------------------------------
  describe('streamed rewards', () => {
    /** 100 USDC settled + 900 USDC accrued on the streamer, still paying out. */
    function streamingPot() {
      return basePot({
        tokens: [
          token({
            balanceRaw: 100_000_000n,
            pendingRaw: 900_000_000n,
            bufferRaw: 5_000_000_000n,
            rewardPerSecondRaw: 10n ** 18n,
            isStreaming: true,
          }),
        ],
        potUsd: 1000,
        // Anchor the live layer at "now" so nothing has accrued since the read.
        readAtMs: Date.now(),
      });
    }

    it('values a leg at settled + accrued, not just the minter balance', () => {
      potResult.value = streamingPot();

      render(<WhaleDiscountPanel />);

      // 100 in the pot + 900 on the streamer = $1,000, not $100.
      expect(screen.getByTestId('whale-discount-pot-total')).toHaveTextContent(
        '$1,000.00'
      );
      expect(screen.getByTestId('whale-discount-amount-USDC')).toHaveTextContent(
        '1,000.000'
      );
    });

    it('flags a streaming leg so a climbing number does not read as a glitch', () => {
      potResult.value = streamingPot();

      render(<WhaleDiscountPanel />);

      // The per-chip dot is the whole affordance — the "streaming" word next
      // to Pot value was removed as noise.
      expect(
        screen.getByTestId('whale-discount-streaming-USDC')
      ).toBeInTheDocument();
      expect(screen.queryByText('streaming')).toBeNull();
    });

    it('leaves a settled-only pot static, with no streaming affordance', () => {
      render(<WhaleDiscountPanel />);

      expect(screen.queryByTestId('whale-discount-streaming-USDC')).toBeNull();
    });

    it('counts a stream up over time, and stops at the buffer', () => {
      vi.useFakeTimers();
      try {
        const start = Date.now();
        potResult.value = basePot({
          tokens: [
            token({
              balanceRaw: 0n,
              pendingRaw: 0n,
              // 10 USDC of buffer left, paying 1 USDC/sec.
              bufferRaw: 10_000_000n,
              rewardPerSecondRaw: 1_000_000n * 10n ** 18n,
              isStreaming: true,
            }),
          ],
          potUsd: 0,
          readAtMs: start,
        });

        render(<WhaleDiscountPanel />);

        const amount = () =>
          screen.getByTestId('whale-discount-amount-USDC').textContent;

        // Nothing has streamed in yet, so the leg pays out nothing and its
        // chip is not shown; it appears once the counter leaves zero.
        expect(screen.queryByTestId('whale-discount-amount-USDC')).toBeNull();

        act(() => {
          vi.advanceTimersByTime(4_000);
        });
        expect(amount()).toBe('4.000');

        // Past the buffer the counter must flatline rather than invent tokens
        // the streamer does not hold.
        act(() => {
          vi.advanceTimersByTime(60_000);
        });
        expect(amount()).toBe('10.000');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('renders a skeleton while the on-chain reads resolve', () => {
    potResult.value = basePot({ isLoading: true });

    render(<WhaleDiscountPanel />);

    expect(screen.getByTestId('whale-discount-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('whale-discount-chip-strip')).toBeNull();
  });

  it('explains itself instead of rendering on a chain with no multi-token minter', () => {
    potResult.value = basePot({ isUnavailable: true });

    render(<WhaleDiscountPanel />);

    expect(screen.getByTestId('whale-discount-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('whale-discount-cta')).toBeNull();
  });
});
