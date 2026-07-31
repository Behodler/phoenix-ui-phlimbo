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

vi.mock('./WhaleMintPanel', () => ({
  default: () => <div data-testid="whale-mint-panel" />,
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

describe('NFTListTab — admin-only Whale Discount sub-tab', () => {
  it('hides the Whale Discount option when canSeeWhaleDiscount is false', () => {
    render(<NFTListTab subTab="mint" onSubTabChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Mint' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Stake' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Whale Discount' })).toBeNull();
  });

  it('shows the Whale Discount option when canSeeWhaleDiscount is true', () => {
    render(
      <NFTListTab subTab="mint" onSubTabChange={vi.fn()} canSeeWhaleDiscount />
    );

    expect(screen.getByRole('tab', { name: 'Whale Discount' })).toBeInTheDocument();
  });

  it('renders the Whale Discount panel for an admin sitting on that sub-tab', () => {
    render(
      <NFTListTab subTab="whale-discount" onSubTabChange={vi.fn()} canSeeWhaleDiscount />
    );

    expect(screen.getByTestId('whale-discount-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('staking-surface-mock')).toBeNull();
  });

  it('renders the featured project banner after the Whale Discount panel', () => {
    render(
      <NFTListTab subTab="whale-discount" onSubTabChange={vi.fn()} canSeeWhaleDiscount />
    );

    const panel = screen.getByTestId('whale-discount-panel');
    const banner = screen.getByTestId('featured-project-banner');

    expect(banner).toBeInTheDocument();
    // Siblings, banner second — DOCUMENT_POSITION_FOLLOWING is 4.
    expect(panel.parentElement).toBe(banner.parentElement);
    expect(panel.compareDocumentPosition(banner) & 4).toBeTruthy();
  });

  it('does not render the featured project banner for a non-admin', () => {
    render(<NFTListTab subTab="whale-discount" onSubTabChange={vi.fn()} />);

    expect(screen.queryByTestId('featured-project-banner')).toBeNull();
  });

  it('falls through to the wired Stake surface for a non-admin holding a stale whale-discount sub-tab', () => {
    // Double guard: even with subTab === 'whale-discount', a non-admin must
    // never see the panel.
    render(<NFTListTab subTab="whale-discount" onSubTabChange={vi.fn()} />);

    expect(screen.queryByTestId('whale-discount-panel')).toBeNull();
    expect(screen.getByTestId('staking-surface-mock')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Whale Discount' })).toBeNull();
  });

  it('still renders the untouched Mint surface (WhaleMintPanel) on the mint sub-tab', () => {
    render(
      <NFTListTab subTab="mint" onSubTabChange={vi.fn()} canSeeWhaleDiscount />
    );

    expect(screen.getByTestId('whale-mint-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('whale-discount-panel')).toBeNull();
  });

  it('renders the Stake surface on the stake sub-tab regardless of admin status', () => {
    render(
      <NFTListTab subTab="stake" onSubTabChange={vi.fn()} canSeeWhaleDiscount />
    );

    expect(screen.getByTestId('staking-surface-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('whale-discount-panel')).toBeNull();
  });
});
