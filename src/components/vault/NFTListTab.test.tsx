import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import NFTListTab from './NFTListTab';

// ---------------------------------------------------------------------------
// NFTListTab pulls in wagmi-backed hooks and several heavy child surfaces. This
// suite only exercises the sub-tab gating, so every child
// and hook is stubbed with a marker element.
// ---------------------------------------------------------------------------
vi.mock('../ui/ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('../../hooks/useNFTPrices', () => ({
  useNFTPrices: () => ({ prices: {} }),
}));

vi.mock('../../hooks/useMinterPageView', () => ({
  useMinterPageView: () => ({ data: null, isLoading: false, refetch: vi.fn() }),
}));

vi.mock('./NFTListItem', () => ({
  default: () => <div data-testid="nft-list-item" />,
}));

vi.mock('./NFTListMintModal', () => ({
  default: () => <div data-testid="nft-list-mint-modal" />,
}));

vi.mock('./stakeMock/StakingSurfaceMock', () => ({
  default: () => <div data-testid="staking-surface-mock" />,
}));

vi.mock('./whaleDiscount/WhaleDiscountPanel', () => ({
  default: () => <div data-testid="whale-discount-panel" />,
}));

vi.mock('./featuredProject/FeaturedProjectBanner', () => ({
  default: () => <div data-testid="featured-project-banner" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NFTListTab — sub-tabs', () => {
  it('offers all three sub-tabs to every user, admin or not', () => {
    render(<NFTListTab subTab="mint" onSubTabChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Mint' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Stake' })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Whale Discount' })
    ).toBeInTheDocument();
  });

  it('renders the Whale Discount panel on that sub-tab', () => {
    render(<NFTListTab subTab="whale-discount" onSubTabChange={vi.fn()} />);

    expect(screen.getByTestId('whale-discount-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('staking-surface-mock')).toBeNull();
  });

  it('renders the featured project banner after the Whale Discount panel', () => {
    // The banner is stubbed here, so this pins placement only — whether it
    // renders at all is `FEATURED_PROJECT_VISIBLE`'s job, covered by its own
    // suite.
    render(<NFTListTab subTab="whale-discount" onSubTabChange={vi.fn()} />);

    const panel = screen.getByTestId('whale-discount-panel');
    const banner = screen.getByTestId('featured-project-banner');

    expect(banner).toBeInTheDocument();
    // Siblings, banner second — DOCUMENT_POSITION_FOLLOWING is 4.
    expect(panel.parentElement).toBe(banner.parentElement);
    expect(panel.compareDocumentPosition(banner) & 4).toBeTruthy();
  });

  it('shows only the NFT list on the mint sub-tab — no whale panel', () => {
    render(<NFTListTab subTab="mint" onSubTabChange={vi.fn()} />);

    // The old single-nudge-token whale minter used to sit under the list.
    expect(screen.queryByTestId('whale-mint-panel')).toBeNull();
    expect(screen.queryByTestId('whale-discount-panel')).toBeNull();
    expect(screen.getAllByTestId('nft-list-item').length).toBeGreaterThan(0);
  });

  it('renders the Stake surface on the stake sub-tab', () => {
    render(<NFTListTab subTab="stake" onSubTabChange={vi.fn()} />);

    expect(screen.getByTestId('staking-surface-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('whale-discount-panel')).toBeNull();
  });
});
