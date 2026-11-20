import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RecentAnnihilations from './RecentAnnihilations';
import RecentBurns from './RecentBurns';
import RecentBatchMints from './RecentBatchMints';
import { ALICE, FIXTURE_NOW_MS, jsonResponse, makeHistoryFixture } from './historyFixture';
import type { EventHistory } from '../../../hooks/useEventHistory';

function renderWithHistory(ui: ReactElement, history: EventHistory | 'error' = makeHistoryFixture()) {
  const fetchMock =
    history === 'error'
      ? vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      : vi.fn().mockResolvedValue(jsonResponse(history));
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

async function expand(title: RegExp) {
  await userEvent.click(await screen.findByRole('button', { name: title }));
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(Date, 'now').mockReturnValue(FIXTURE_NOW_MS);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('RecentAnnihilations', () => {
  it('renders tiles, the summary line, and a desktop table with the stablecoin column and Via pill', async () => {
    renderWithHistory(<RecentAnnihilations />);
    const section = await screen.findByTestId('history-annihilations');

    expect(await within(section).findByText('Antimatter annihilated')).toBeInTheDocument();
    expect(within(section).getByText('1,087.52')).toBeInTheDocument();
    expect(within(section).getByText('phUSD delivered')).toBeInTheDocument();
    expect(within(section).getByText('2,175.54')).toBeInTheDocument();
    expect(within(section).getByText('3 annihilations · 2 via Forge, 1 via Stake')).toBeInTheDocument();

    await expand(/Recent annihilations/);
    const table = within(section).getByTestId('history-table');
    expect(within(table).getByText('+ Stablecoin')).toBeInTheDocument();
    const rows = within(table).getAllByTestId('history-table-row');
    expect(rows).toHaveLength(3);
    // Newest first: USDS forge row, then the DOLA stake row, then USDC.
    expect(rows[0]).toHaveTextContent('2h ago');
    expect(rows[0]).toHaveTextContent('75.53USDS');
    expect(rows[0]).toHaveTextContent('Forge');
    expect(rows[1]).toHaveTextContent('1,000.48DOLA');
    expect(rows[1]).toHaveTextContent('2,000.48');
    expect(rows[1]).toHaveTextContent('Stake');
    expect(rows[2]).toHaveTextContent('12.02USDC');

    // Address and tx links.
    const who = within(rows[0]).getByRole('link', { name: '0x3f2a…a91c' });
    expect(who).toHaveAttribute('href', `https://etherscan.io/address/${ALICE}`);
    const when = within(rows[0]).getByRole('link', { name: '2h ago' });
    expect(when.getAttribute('href')).toMatch(/^https:\/\/etherscan\.io\/tx\/0x0+c$/);
    expect(when).toHaveAttribute('title', '2026-11-18 22:00 UTC');
  });

  it('renders phone cards with "→ phUSD", the Via pill and "with <SYMBOL>"', async () => {
    renderWithHistory(<RecentAnnihilations />);
    await expand(/Recent annihilations/);
    const cards = within(screen.getByTestId('history-cards')).getAllByTestId('history-card');
    expect(cards).toHaveLength(3);
    expect(cards[1]).toHaveTextContent('1,000.00 → 2,000.48 phUSD');
    expect(cards[1]).toHaveTextContent('Stake');
    expect(cards[1]).toHaveTextContent('9h ago · with DOLA');
  });

  it('shows the unavailable line when the fetch fails', async () => {
    renderWithHistory(<RecentAnnihilations />, 'error');
    expect(await screen.findByText('History unavailable right now')).toBeInTheDocument();
  });
});

describe('RecentBurns', () => {
  it('renders 7d / last payout / total tiles and NFT names (incl. Nudge Ratchet and unknown fallback)', async () => {
    renderWithHistory(<RecentBurns />);
    const section = await screen.findByTestId('history-bonfire-burns');
    expect(await within(section).findByText('Burns · 7d')).toBeInTheDocument();
    const tiles = within(section).getByText('Burns · 7d').parentElement!.parentElement!;
    expect(tiles).toHaveTextContent('Burns · 7d2');
    expect(tiles).toHaveTextContent('Last payout18.67');
    expect(tiles).toHaveTextContent('Total paid36.17');

    await expand(/Recent burns/);
    const rows = within(within(section).getByTestId('history-table')).getAllByTestId('history-table-row');
    expect(rows[0]).toHaveTextContent('NFT #99');
    expect(within(rows[0]).getByTestId('history-nft-generic-icon')).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('Liquid Sky Phoenix');
    expect(rows[1]).toHaveTextContent('12.50');
    expect(rows[2]).toHaveTextContent('Nudge Ratchet');
    expect(rows[2]).toHaveTextContent('10d ago');

    const cards = within(screen.getByTestId('history-cards')).getAllByTestId('history-card');
    expect(cards[1]).toHaveTextContent('Liquid Sky Phoenix12.50');
  });
});

describe('RecentBatchMints', () => {
  it('renders the LSP header, tiles, summary line, table and phone cards', async () => {
    renderWithHistory(<RecentBatchMints />);
    const section = await screen.findByTestId('history-batch-mints');
    expect(within(section).getByText('Liquid Sky Phoenix')).toBeInTheDocument();
    expect(await within(section).findByText('NFTs minted')).toBeInTheDocument();
    const tiles = within(section).getByText('NFTs minted').parentElement!.parentElement!;
    expect(tiles).toHaveTextContent('NFTs minted60');
    expect(tiles).toHaveTextContent('Of which free27');
    expect(tiles).toHaveTextContent('Avg. discount45%');
    expect(within(section).getByText('2 batches since 18 Nov 2026')).toBeInTheDocument();

    await expand(/Recent batch mints/);
    const rows = within(within(section).getByTestId('history-table')).getAllByTestId('history-table-row');
    expect(rows[0]).toHaveTextContent('6h ago');
    expect(rows[0]).toHaveTextContent('1218');
    expect(rows[0]).toHaveTextContent('2,412.00');
    expect(rows[0]).toHaveTextContent('40%');
    expect(rows[1]).toHaveTextContent('1,980.50');
    expect(rows[1]).toHaveTextContent('50%');

    const cards = within(screen.getByTestId('history-cards')).getAllByTestId('history-card');
    expect(cards[0]).toHaveTextContent('30 NFTs · 12 free');
    expect(cards[0]).toHaveTextContent('2,412.00 USDS');
    expect(cards[0]).toHaveTextContent('6h ago · 40% off');
  });

  it('shows the 18 Nov empty state when there are no batch mints', async () => {
    renderWithHistory(<RecentBatchMints />, makeHistoryFixture({ batchMints: [] }));
    expect(await screen.findByText('No batch mints yet — history starts 18 Nov 2026')).toBeInTheDocument();
    expect(screen.getByText('Avg. discount').nextSibling).toHaveTextContent('—');
  });
});
