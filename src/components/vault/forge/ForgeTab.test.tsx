import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgeTab, { type ForgeRowDef } from './ForgeTab';
import { FORGE_DEFAULT_OPEN } from '../../../data/forgeMockData';
import type { ForgeAnnihilateState } from '../../../hooks/useForgeAnnihilate';
import type { ForgeHarvestState } from '../../../hooks/useForgeHarvest';

const OWNER = '0x00000000000000000000000000000000000000aa';
const STRANGER = '0x00000000000000000000000000000000000000bb';
// First entry of the mainnet ADMIN_ALLOWLIST in src/lib/adminAllowlist.ts.
const ALLOWLISTED = '0x186c77B80Bbfd21b01C7D7FA44bA27031322a77F';

let wallet: string | undefined;
let chainId: number;

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: wallet }),
  useChainId: () => chainId,
}));
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
  requiresNft: true,
  nftHoldings: { 6: 2, 1: 1, 5: 3, 2: 1, 3: 0, 4: 0 },
  selectedNftId: 6,
  setSelectedNftId: vi.fn(),
  nftApproved: true,
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
  approveNfts: vi.fn(),
  harvest: vi.fn(),
});
let annihilate: ForgeAnnihilateState;
let harvest: ForgeHarvestState;
vi.mock('../../../hooks/useForgeAnnihilate', () => ({ useForgeAnnihilate: () => annihilate, ANNIHILATE_STABLE_ORDER: ['USDC', 'USDe', 'DOLA'] }));
vi.mock('../../../hooks/useForgeHarvest', () => ({ useForgeHarvest: () => harvest }));

const BONFIRE = 'NFT Bonfire - only visible to admins';

beforeEach(() => {
  wallet = OWNER;
  chainId = 31337;
  annihilate = annihilateState();
  harvest = harvestState();
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

  it('opens the FORGE_DEFAULT_OPEN row (Harvest) initially, with Annihilate collapsed', () => {
    expect(FORGE_DEFAULT_OPEN).toBe('harvest');
    render(<ForgeTab />);
    expect(screen.getByRole('button', { name: 'Harvest Yield' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Annihilate Antimatter' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Annihilation preview')).not.toBeInTheDocument();
    expect(screen.getByText('Estimated profit')).toBeInTheDocument();
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
    render(<ForgeTab rows={[makeRow('harvest', 'Alpha'), makeRow('beta', 'Beta')]} />);
    const alpha = screen.getByRole('button', { name: 'Alpha' });
    const beta = screen.getByRole('button', { name: 'Beta' });

    // Default-open key is 'harvest' → Alpha.
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

  it('appends the NFT Bonfire row after Harvest with the live pot metric and Burning pill', () => {
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

      // Burning resets the shared pot: header and panel both drop to zero.
      fireEvent.click(screen.getByRole('button', { name: 'Burn EYE ignition → receive 20.90 Antimatter' }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Burn' }));
      expect(header()).toEqual(['0.00', '0.00']);
      expect(screen.getByTestId('bonfire-pot')).toHaveTextContent('0.000000');
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides the Bonfire row from a wallet that is neither the harvester owner nor allowlisted', () => {
    wallet = STRANGER;
    render(<ForgeTab />);
    expect(screen.queryByRole('button', { name: BONFIRE })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Harvest Yield' })).toBeInTheDocument();
  });

  it('hides the Bonfire row when no wallet is connected', () => {
    wallet = undefined;
    render(<ForgeTab />);
    expect(screen.queryByRole('button', { name: BONFIRE })).not.toBeInTheDocument();
  });

  it('shows the Bonfire row to the SYAHarvester owner, case-insensitively', () => {
    wallet = OWNER.toUpperCase().replace('0X', '0x');
    render(<ForgeTab />);
    expect(screen.getByRole('button', { name: BONFIRE })).toBeInTheDocument();
  });

  it('shows the Bonfire row to an allowlisted admin wallet', () => {
    wallet = ALLOWLISTED;
    chainId = 1;
    render(<ForgeTab />);
    expect(screen.getByRole('button', { name: BONFIRE })).toBeInTheDocument();
  });

  it('header pills reflect live state: Paused annihilation, Approve NFTs harvest', () => {
    annihilate = { ...annihilateState(), gateReason: 'Annihilation is paused.', paused: true };
    harvest = { ...harvestState(), blocker: 'needs-approval', quote: undefined, display: null };
    render(<ForgeTab />);
    expect(within(screen.getByRole('button', { name: 'Annihilate Antimatter' })).getByText('Paused')).toBeInTheDocument();
    const harvestHeader = screen.getByRole('button', { name: 'Harvest Yield' });
    expect(within(harvestHeader).getByText('Approve NFTs')).toBeInTheDocument();
    expect(within(harvestHeader).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('marks undeployed contracts as Not live', () => {
    annihilate = { ...annihilateState(), active: false, gateReason: 'Annihilation is not live on this network yet.' };
    harvest = { ...harvestState(), active: false, owner: undefined, blocker: 'inactive', quote: undefined, display: null };
    render(<ForgeTab />);
    expect(within(screen.getByRole('button', { name: 'Annihilate Antimatter' })).getByText('Not live')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Harvest Yield' })).getByText('Not live')).toBeInTheDocument();
  });
});
