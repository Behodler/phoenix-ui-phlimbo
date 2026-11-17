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

vi.mock('./whaleMock/WhaleMockPanel', () => ({
  default: () => <div data-testid="whale-mock-panel" />,
}));

vi.mock('./featuredProject/FeaturedProjectBanner', () => ({
  default: () => <div data-testid="featured-project-banner" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NFTListTab — sub-tabs', () => {
  it('offers Mint, Stake and Whale Discount to every user', () => {
    render(<NFTListTab subTab="mint" onSubTabChange={vi.fn()} />);
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Mint', 'Stake', 'Whale Discount']);
  });

  it('shows only the NFT list on the mint sub-tab — no whale panel', () => {
    render(<NFTListTab subTab="mint" onSubTabChange={vi.fn()} />);

    expect(screen.queryByTestId('whale-mint-panel')).toBeNull();
    expect(screen.queryByTestId('whale-mock-panel')).toBeNull();
    expect(screen.getAllByTestId('nft-list-item').length).toBeGreaterThan(0);
  });

  it('leaves Reservoir Ratchet out of the mint list', () => {
    render(<NFTListTab subTab="mint" onSubTabChange={vi.fn()} />);
    // Six configured NFTs, Ratchet hidden.
    expect(screen.getAllByTestId('nft-list-item')).toHaveLength(5);
  });

  it('renders the Stake surface on the stake sub-tab', () => {
    render(<NFTListTab subTab="stake" onSubTabChange={vi.fn()} />);

    expect(screen.getByTestId('staking-surface-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('whale-mock-panel')).toBeNull();
  });

  it('renders the discount panel, then the featured project banner', () => {
    render(<NFTListTab subTab="whale-discount" onSubTabChange={vi.fn()} />);
    const panel = screen.getByTestId('whale-mock-panel');
    const banner = screen.getByTestId('featured-project-banner');
    expect(panel.parentElement).toBe(banner.parentElement);
    // Banner second — DOCUMENT_POSITION_FOLLOWING is 4.
    expect(panel.compareDocumentPosition(banner) & 4).toBeTruthy();
    expect(screen.queryByTestId('staking-surface-mock')).toBeNull();
  });
});
