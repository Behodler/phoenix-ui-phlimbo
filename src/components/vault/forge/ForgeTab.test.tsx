import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgeTab, { type ForgeRowDef } from './ForgeTab';
import { FORGE_DEFAULT_OPEN, FORGE_OPEN_ROW_STORAGE_KEY } from '../../../data/forgeMockData';
import type { ForgeAnnihilateState } from '../../../hooks/useForgeAnnihilate';
import type { ForgeHarvestState } from '../../../hooks/useForgeHarvest';
import type { ForgeBonfireState } from '../../../hooks/useForgeBonfire';
import { createBonfirePotClock } from './bonfirePotClock';

const OWNER = '0x00000000000000000000000000000000000000aa';
vi.mock('../../ui/ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const annihilateState = (): ForgeAnnihilateState => ({
  active: true,
  paused: false,
  walletAntimatter: 142.38,
  stableBalances: { USDC: 1250, USDe: 80, DOLA: 410.25 },
  price: 0.98,
  gateReason: null,
  priceGated: false,
  stable: 'USDC',
  setStable: vi.fn(),
  amount: '',
  setAmount: vi.fn(),
  phusdOut: null,
  minPhusdOut: null,
  needsApproval: false,
  pendingAction: null,
  approve: vi.fn(),
  annihilate: vi.fn(),
});
const harvestState = (): ForgeHarvestState => ({
  active: true,
  owner: OWNER,
  yieldUsd: 412.8,
  blocker: null,
  quote: {
    kind: 'ok',
    ethOutWei: 42_100_000_000_000_000n,
    gasUnits: 640_000n,
    gasLimit: 768_000n,
    maxFeePerGas: 4_100_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
  },
  isQuoting: false,
  display: { ethOut: 0.0421, gasEth: 0.0026, gasUnits: 640_000, gasGwei: 4.1, minEthOut: 0.04, profitable: true },
  pendingAction: null,
  harvest: vi.fn(),
});
const bonfireState = (): ForgeBonfireState => ({
  active: true,
  loaded: true,
  // Real clock: the header-tick test drives it with fake timers.
  clock: createBonfirePotClock({ potInitial: 18.4062, ratePerDay: 2.5, maxPayout: 50 }, { intervalMs: 50 }),
  ratePerDay: 2.5,
  maxPayout: 50,
  paused: false,
  nftHoldings: { 6: 2, 1: 1, 5: 3, 2: 1, 3: 0, 4: 0 },
  selectedNftId: 1,
  setSelectedNftId: vi.fn(),
  minPayoutWei: 18_030_000_000_000_000_000n,
  blocker: null,
  pendingBurn: false,
  burn: vi.fn().mockResolvedValue(undefined),
});
let annihilate: ForgeAnnihilateState;
let harvest: ForgeHarvestState;
let bonfire: ForgeBonfireState;
vi.mock('../../../hooks/useForgeAnnihilate', () => ({ useForgeAnnihilate: () => annihilate, ANNIHILATE_STABLE_ORDER: ['USDC', 'USDe', 'DOLA'] }));
vi.mock('../../../hooks/useForgeHarvest', () => ({ useForgeHarvest: () => harvest }));
vi.mock('../../../hooks/useForgeBonfire', () => ({ useForgeBonfire: () => bonfire }));

const BONFIRE = 'Burn NFTs for Antimatter';

beforeEach(() => {
  // The open row is remembered in localStorage; start every test as a first visit.
  localStorage.clear();
  annihilate = annihilateState();
  harvest = harvestState();
  bonfire = bonfireState();
});

function makeRow(key: string, title: string): ForgeRowDef {
  return {
    key,
    icon: <span />,
    title,
    tagline: `${title} tagline`,
    metric: '1.00',
    metricLabel: 'Metric',
    pill: <span>pill</span>,
    body: <div>{`${title} body`}</div>,
  };
}

describe('ForgeTab', () => {
  it('renders the heading and sub copy', () => {
    render(<ForgeTab />);
    expect(screen.getByRole('heading', { name: 'Forge', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Handy one-transaction actions. Each one is a single click.')).toBeInTheDocument();
  });

  it('opens the FORGE_DEFAULT_OPEN row (Annihilate) on a first visit, with Harvest collapsed', () => {
    expect(FORGE_DEFAULT_OPEN).toBe('annihilate');
    render(<ForgeTab />);
    expect(screen.getByRole('button', { name: 'Annihilate Antimatter' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Harvest Yield' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Annihilation preview')).toBeInTheDocument();
    expect(screen.queryByText('Estimated profit')).not.toBeInTheDocument();
  });

  it('remembers the last opened row across mounts', async () => {
    const user = userEvent.setup();
    const first = render(<ForgeTab />);
    await user.click(screen.getByRole('button', { name: 'Harvest Yield' }));
    expect(localStorage.getItem(FORGE_OPEN_ROW_STORAGE_KEY)).toBe('harvest');
    first.unmount();

    render(<ForgeTab />);
    expect(screen.getByRole('button', { name: 'Harvest Yield' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Annihilate Antimatter' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('remembers that every row was collapsed', async () => {
    const user = userEvent.setup();
    const first = render(<ForgeTab />);
    await user.click(screen.getByRole('button', { name: 'Annihilate Antimatter' }));
    first.unmount();

    render(<ForgeTab />);
    for (const name of ['Annihilate Antimatter', 'Harvest Yield', BONFIRE]) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('falls back to the default row when the remembered key names no row', () => {
    localStorage.setItem(FORGE_OPEN_ROW_STORAGE_KEY, 'retired-tool');
    render(<ForgeTab />);
    expect(screen.getByRole('button', { name: 'Annihilate Antimatter' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders the Harvest row after Annihilate with the profitable header metric and pill', () => {
    render(<ForgeTab />);
    const annihilate = screen.getByRole('button', { name: 'Annihilate Antimatter' });
    const harvest = screen.getByRole('button', { name: 'Harvest Yield' });
    // DOCUMENT_POSITION_FOLLOWING: harvest comes after annihilate.
    expect(annihilate.compareDocumentPosition(harvest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(harvest).getByText('Claim protocol yield, get paid in ETH')).toBeInTheDocument();
    expect(within(harvest).getByText('Est. profit · ETH')).toBeInTheDocument();
    expect(within(harvest).getAllByText('+0.0395').length).toBeGreaterThan(0);
    expect(within(harvest).getByText('Profitable')).toBeInTheDocument();
  });

  it('opens Annihilate when its header is clicked, collapsing Harvest', async () => {
    localStorage.setItem(FORGE_OPEN_ROW_STORAGE_KEY, 'harvest');
    const user = userEvent.setup();
    render(<ForgeTab />);
    const annihilate = screen.getByRole('button', { name: 'Annihilate Antimatter' });
    await user.click(annihilate);
    expect(annihilate).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Harvest Yield' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Annihilation preview')).toBeInTheDocument();
    // Price 0.98 is above the floor → "Ready" pill.
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('clicking the open row header collapses it', async () => {
    localStorage.setItem(FORGE_OPEN_ROW_STORAGE_KEY, 'harvest');
    const user = userEvent.setup();
    render(<ForgeTab />);
    const header = screen.getByRole('button', { name: 'Harvest Yield' });
    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Estimated profit')).not.toBeInTheDocument();
    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps only one row open at a time', async () => {
    const user = userEvent.setup();
    render(<ForgeTab rows={[makeRow('annihilate', 'Alpha'), makeRow('beta', 'Beta')]} />);
    const alpha = screen.getByRole('button', { name: 'Alpha' });
    const beta = screen.getByRole('button', { name: 'Beta' });

    // Default-open key is 'annihilate' → Alpha.
    expect(alpha).toHaveAttribute('aria-expanded', 'true');
    expect(beta).toHaveAttribute('aria-expanded', 'false');

    await user.click(beta);
    expect(alpha).toHaveAttribute('aria-expanded', 'false');
    expect(beta).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('Alpha body')).not.toBeInTheDocument();
    expect(screen.getByText('Beta body')).toBeInTheDocument();

    await user.click(beta);
    expect(alpha).toHaveAttribute('aria-expanded', 'false');
    expect(beta).toHaveAttribute('aria-expanded', 'false');
  });

  it('appends the Burn NFTs for Antimatter row after Harvest with the live pot metric and Burning pill', () => {
    render(<ForgeTab />);
    const harvest = screen.getByRole('button', { name: 'Harvest Yield' });
    const bonfire = screen.getByRole('button', { name: BONFIRE });
    expect(harvest.compareDocumentPosition(bonfire) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bonfire).toHaveAttribute('aria-expanded', 'false');
    expect(within(bonfire).getByText('Burn an NFT, take the Antimatter pot')).toBeInTheDocument();
    expect(within(bonfire).getByText('Pot · Antimatter')).toBeInTheDocument();
    expect(within(bonfire).getByText('Burning')).toBeInTheDocument();
    expect(within(bonfire).getByTestId('bonfire-flame-icon')).toBeInTheDocument();
    for (const metric of within(bonfire).getAllByTestId('bonfire-header-pot')) {
      expect(metric).toHaveTextContent('18.40');
      expect(metric).toHaveStyle({ color: '#FFD93D' });
    }
  });

  it('header pot ticks and always matches the panel and the burn button', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      bonfire = bonfireState(); // anchor the clock at the fake epoch
      render(<ForgeTab />);
      fireEvent.click(screen.getByRole('button', { name: BONFIRE }));
      const header = () => screen.getAllByTestId('bonfire-header-pot').map((el) => el.textContent);

      expect(header()).toEqual(['18.40', '18.40']);
      expect(screen.getByTestId('bonfire-pot')).toHaveTextContent('18.406200');
      expect(screen.getByRole('button', { name: 'Burn EYE ignition → receive 18.40 Antimatter' })).toBeInTheDocument();

      // One day later (the 50 ms tick also advances the fake clock): 20.9062 → 20.90.
      act(() => {
        vi.setSystemTime(86_400_000 - 50);
        vi.advanceTimersByTime(50);
      });
      expect(header()).toEqual(['20.90', '20.90']);
      expect(screen.getByTestId('bonfire-pot')).toHaveTextContent('20.906200');
      expect(screen.getByRole('button', { name: 'Burn EYE ignition → receive 20.90 Antimatter' })).toBeInTheDocument();

      // A fresh chain read re-anchors the shared pot: header and panel move together.
      act(() => bonfire.clock.sync({ potInitial: 0, ratePerDay: 2.5, maxPayout: 50 }));
      expect(header()).toEqual(['0.00', '0.00']);
      expect(screen.getByTestId('bonfire-pot')).toHaveTextContent('0.000000');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the Bonfire row to everyone, with no admin suffix', () => {
    render(<ForgeTab />);
    expect(screen.getByRole('button', { name: BONFIRE })).toBeInTheDocument();
    expect(screen.queryByText(/only visible to admins/)).not.toBeInTheDocument();
  });

  it('Bonfire header: dash before the first read, Paused when paused, Off at rate 0', () => {
    bonfire = { ...bonfireState(), loaded: false, blocker: 'loading' };
    const { unmount } = render(<ForgeTab />);
    const header = () => screen.getByRole('button', { name: BONFIRE });
    expect(within(header()).queryByTestId('bonfire-header-pot')).not.toBeInTheDocument();
    expect(within(header()).getAllByText('—').length).toBeGreaterThan(0);
    unmount();

    bonfire = { ...bonfireState(), paused: true, blocker: 'paused' };
    const second = render(<ForgeTab />);
    expect(within(header()).getByText('Paused')).toBeInTheDocument();
    second.unmount();

    bonfire = { ...bonfireState(), ratePerDay: 0, blocker: 'disabled' };
    render(<ForgeTab />);
    expect(within(header()).getByText('Off')).toBeInTheDocument();
  });

  it('header pills reflect live state: Paused annihilation, No quote harvest', () => {
    annihilate = { ...annihilateState(), gateReason: 'Annihilation is paused.', paused: true };
    harvest = { ...harvestState(), blocker: 'loading', quote: undefined, display: null };
    render(<ForgeTab />);
    expect(within(screen.getByRole('button', { name: 'Annihilate Antimatter' })).getByText('Paused')).toBeInTheDocument();
    const harvestHeader = screen.getByRole('button', { name: 'Harvest Yield' });
    expect(within(harvestHeader).getByText('No quote')).toBeInTheDocument();
    expect(within(harvestHeader).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('marks undeployed contracts as Not live', () => {
    annihilate = { ...annihilateState(), active: false, gateReason: 'Annihilation is not live on this network yet.' };
    harvest = { ...harvestState(), active: false, owner: undefined, blocker: 'inactive', quote: undefined, display: null };
    bonfire = { ...bonfireState(), active: false, loaded: false, blocker: 'inactive' };
    render(<ForgeTab />);
    expect(within(screen.getByRole('button', { name: 'Annihilate Antimatter' })).getByText('Not live')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Harvest Yield' })).getByText('Not live')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: BONFIRE })).getByText('Not live')).toBeInTheDocument();
  });
});
