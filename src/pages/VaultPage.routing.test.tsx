import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { Tab } from '../types/vault';
import { PATH_TO_TAB, TAB_TO_PATH, DEFAULT_PATH } from '../lib/tabRoutes';

// ---------------------------------------------------------------------------
// Mock VaultPage with a lightweight stand-in.
//
// VaultPage depends on wagmi, multiple React contexts, and on-chain hooks —
// none of which are relevant to verifying the routing wiring. This stand-in
// mirrors VaultPage's URL ↔ tab contract:
//   - initial `activeTab` is derived from `location.pathname` via PATH_TO_TAB
//   - a `location.pathname` effect syncs the URL back into `activeTab`
//   - tab clicks call `navigate(TAB_TO_PATH[tab] ?? DEFAULT_PATH)`
//
// It renders the active tab name as a heading so route → tab can be asserted
// via screen.getByRole('heading'). The actual VaultPage tab-content switch
// is unchanged by this story; what we are testing is the routing layer.
// ---------------------------------------------------------------------------

const TAB_HEADING: Record<Tab, string> = {
  Mint: 'Mint Tab',
  Deposit: 'Deposit Form',
  Withdraw: 'Withdraw Tab',
  'Yield Funnel': 'Yield Funnel Tab',
  Stake: 'Stake Tab',
  'Testnet Faucet': 'Faucet Tab',
  Market: 'Market Tab',
  NFT: 'NFT Tab',
  Admin: 'Admin Tab',
};

function VaultPageStub() {
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>(
    () => PATH_TO_TAB[location.pathname] ?? 'Mint'
  );

  useEffect(() => {
    const tabFromUrl = PATH_TO_TAB[location.pathname];
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    const targetPath = TAB_TO_PATH[tab] ?? DEFAULT_PATH;
    if (targetPath !== location.pathname) {
      navigate(targetPath, { replace: false });
    }
  };

  return (
    <div>
      <h1>{TAB_HEADING[activeTab]}</h1>
      <div data-testid="current-pathname">{location.pathname}</div>
      <nav>
        <button onClick={() => handleTabClick('Mint')}>Mint Nav</button>
        <button onClick={() => handleTabClick('Stake')}>Stake Nav</button>
        <button onClick={() => handleTabClick('Deposit')}>Deposit Nav</button>
        <button onClick={() => handleTabClick('NFT')}>NFT Nav</button>
        <button onClick={() => handleTabClick('Withdraw')}>Withdraw Nav</button>
      </nav>
    </div>
  );
}

vi.mock('./VaultPage', () => ({
  default: VaultPageStub,
}));

// Subtree mirroring the App.tsx <Routes> block. We deliberately do NOT render
// the full <App /> because App wraps in BrowserRouter which can't be nested
// inside MemoryRouter, and because App also pulls in providers (ToastProvider,
// DisclaimerModal, etc.) that are unrelated to the routing assertion.
function AppRoutesSubtree() {
  return (
    <Routes>
      <Route path="/" element={<VaultPageStub />} />
      <Route path="/stake" element={<VaultPageStub />} />
      <Route path="/staking" element={<VaultPageStub />} />
      <Route path="/nft" element={<VaultPageStub />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

describe('VaultPage routing (Story 066)', () => {
  it('renders Mint tab at /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutesSubtree />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Mint Tab' })).toBeInTheDocument();
    expect(screen.getByTestId('current-pathname').textContent).toBe('/');
  });

  it('renders Stake tab at /staking (repointed from Deposit, DeFi Llama link target)', () => {
    render(
      <MemoryRouter initialEntries={['/staking']}>
        <AppRoutesSubtree />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Stake Tab' })).toBeInTheDocument();
    expect(screen.getByTestId('current-pathname').textContent).toBe('/staking');
  });

  it('renders Stake tab at /stake (canonical path)', () => {
    render(
      <MemoryRouter initialEntries={['/stake']}>
        <AppRoutesSubtree />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Stake Tab' })).toBeInTheDocument();
    expect(screen.getByTestId('current-pathname').textContent).toBe('/stake');
  });

  it('clicking the Stake tab navigates to the canonical /stake path', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutesSubtree />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Stake Nav' }));

    expect(screen.getByRole('heading', { name: 'Stake Tab' })).toBeInTheDocument();
    expect(screen.getByTestId('current-pathname').textContent).toBe('/stake');
  });

  it('renders NFT tab at /nft', () => {
    render(
      <MemoryRouter initialEntries={['/nft']}>
        <AppRoutesSubtree />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'NFT Tab' })).toBeInTheDocument();
    expect(screen.getByTestId('current-pathname').textContent).toBe('/nft');
  });

  it('redirects /bogus to / and renders Mint', () => {
    render(
      <MemoryRouter initialEntries={['/bogus']}>
        <AppRoutesSubtree />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Mint Tab' })).toBeInTheDocument();
    expect(screen.getByTestId('current-pathname').textContent).toBe('/');
  });

  it('clicking the NFT tab from /staking updates location.pathname to /nft', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/staking']}>
        <AppRoutesSubtree />
      </MemoryRouter>
    );

    // Start on Stake at /staking (repointed)
    expect(screen.getByRole('heading', { name: 'Stake Tab' })).toBeInTheDocument();
    expect(screen.getByTestId('current-pathname').textContent).toBe('/staking');

    await user.click(screen.getByRole('button', { name: 'NFT Nav' }));

    expect(screen.getByRole('heading', { name: 'NFT Tab' })).toBeInTheDocument();
    expect(screen.getByTestId('current-pathname').textContent).toBe('/nft');
  });
});
