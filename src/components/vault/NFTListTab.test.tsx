import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import NFTListTab from './NFTListTab';

// ---------------------------------------------------------------------------
// NFTListTab pulls in wagmi-backed hooks and several heavy child surfaces. This
// suite only exercises the sub-tab gating added by story 077, so every child
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

vi.mock('./nudgeMock/NudgeMockPanel', () => ({
  default: () => <div data-testid="nudge-mock-panel" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NFTListTab — admin-only Nudge-mock sub-tab (story 077)', () => {
  it('hides the Nudge-mock option when canSeeNudgeMock is false', () => {
    render(<NFTListTab subTab="mint" onSubTabChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Mint' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Stake' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Nudge-mock' })).toBeNull();
  });

  it('shows the Nudge-mock option when canSeeNudgeMock is true', () => {
    render(
      <NFTListTab subTab="mint" onSubTabChange={vi.fn()} canSeeNudgeMock />
    );

    expect(screen.getByRole('tab', { name: 'Nudge-mock' })).toBeInTheDocument();
  });

  it('renders the mock panel for an admin sitting on the nudge-mock sub-tab', () => {
    render(
      <NFTListTab subTab="nudge-mock" onSubTabChange={vi.fn()} canSeeNudgeMock />
    );

    expect(screen.getByTestId('nudge-mock-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('staking-surface-mock')).toBeNull();
  });

  it('falls through to the wired Stake surface for a non-admin holding a stale nudge-mock sub-tab', () => {
    // Double guard: even with subTab === 'nudge-mock', a non-admin must never
    // see the preview.
    render(<NFTListTab subTab="nudge-mock" onSubTabChange={vi.fn()} />);

    expect(screen.queryByTestId('nudge-mock-panel')).toBeNull();
    expect(screen.getByTestId('staking-surface-mock')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Nudge-mock' })).toBeNull();
  });

  it('still renders the untouched Mint surface (WhaleMintPanel) on the mint sub-tab', () => {
    render(
      <NFTListTab subTab="mint" onSubTabChange={vi.fn()} canSeeNudgeMock />
    );

    expect(screen.getByTestId('whale-mint-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('nudge-mock-panel')).toBeNull();
  });

  it('renders the Stake surface on the stake sub-tab regardless of admin status', () => {
    render(
      <NFTListTab subTab="stake" onSubTabChange={vi.fn()} canSeeNudgeMock />
    );

    expect(screen.getByTestId('staking-surface-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('nudge-mock-panel')).toBeNull();
  });
});
