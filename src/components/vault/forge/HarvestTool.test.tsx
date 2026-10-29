import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HarvestTool from './HarvestTool';
import type { ForgeHarvestState } from '../../../hooks/useForgeHarvest';

const approveNfts = vi.fn(async () => {});
const harvest = vi.fn(async () => {});

const WARNING_LEAD = 'Estimates, not guarantees.';

const PROFITABLE: ForgeHarvestState['display'] = {
  ethOut: 0.0421,
  gasEth: 0.0026,
  gasUnits: 640_000,
  gasGwei: 4.1,
  minEthOut: 0.039995,
  profitable: true,
};
const UNPROFITABLE: ForgeHarvestState['display'] = {
  ethOut: 0.0019,
  gasEth: 0.0026,
  gasUnits: 640_000,
  gasGwei: 4.1,
  minEthOut: 0,
  profitable: false,
};
const OK_QUOTE = {
  kind: 'ok',
  ethOutWei: 42_100_000_000_000_000n,
  gasUnits: 640_000n,
  gasLimit: 768_000n,
  maxFeePerGas: 4_100_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
} as const;

/** HarvestTool is presentational; the harness owns the NFT selection the hook would. */
function Harness(overrides: Partial<ForgeHarvestState>) {
  const [selectedNftId, setSelectedNftId] = useState(6);
  const state: ForgeHarvestState = {
    active: true,
    owner: undefined,
    requiresNft: true,
    nftHoldings: { 6: 2, 1: 1, 5: 3, 2: 1, 3: 0, 4: 0 },
    selectedNftId,
    setSelectedNftId,
    nftApproved: true,
    yieldUsd: 412.8,
    blocker: null,
    quote: OK_QUOTE,
    isQuoting: false,
    display: PROFITABLE,
    pendingAction: null,
    approveNfts,
    harvest,
    ...overrides,
  };
  return <HarvestTool state={state} />;
}

describe('HarvestTool', () => {
  beforeEach(() => {
    approveNfts.mockClear();
    harvest.mockClear();
  });

  it('profitable quote: numbers, NFT picker, Harvest calls the hook', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const profit = screen.getByTestId('harvest-profit');
    expect(profit).toHaveTextContent('+0.0395');
    expect(profit).toHaveClass('text-green-400');
    expect(screen.getByText('$412.80')).toBeInTheDocument();
    expect(screen.getByText('0.0421 ETH')).toBeInTheDocument();
    expect(screen.getByText('Est. gas (640k @ 4.1 gwei)')).toBeInTheDocument();
    expect(screen.getByText('−0.0026 ETH')).toBeInTheDocument();
    expect(screen.getByText('0.0400 ETH')).toBeInTheDocument();
    expect(screen.getByTestId('harvest-bar-profit')).toBeInTheDocument();

    expect(screen.getByText('Claim NFT')).toBeInTheDocument();
    expect(screen.getByText('#6 · you hold 2')).toBeInTheDocument();
    expect(screen.getByText(WARNING_LEAD)).toBeInTheDocument();
    expect(screen.queryByText('Not profitable.')).not.toBeInTheDocument();

    const steps = screen.getByTestId('harvest-steps');
    expect(within(steps).getByText('Approve NFTs (once)').closest('li')).toHaveAttribute('data-state', 'done');
    expect(within(steps).getByText('Harvest').closest('li')).toHaveAttribute('data-state', 'current');

    await user.click(screen.getByRole('button', { name: 'Harvest → receive ~0.0421 ETH' }));
    expect(harvest).toHaveBeenCalledOnce();
  });

  it('needs approval: no numbers yet, Approve calls the hook', async () => {
    const user = userEvent.setup();
    render(<Harness blocker="needs-approval" nftApproved={false} quote={undefined} display={null} />);
    expect(screen.getByTestId('harvest-profit')).toHaveTextContent('—');
    const steps = screen.getByTestId('harvest-steps');
    expect(within(steps).getByText('Approve NFTs (once)').closest('li')).toHaveAttribute('data-state', 'current');
    await user.click(screen.getByRole('button', { name: 'Approve NFTs for the Harvester' }));
    expect(approveNfts).toHaveBeenCalledOnce();
    expect(harvest).not.toHaveBeenCalled();
  });

  it.each([
    ['inactive', 'Harvester not live on this network'],
    ['disconnected', 'Connect your wallet'],
    ['no-nft', 'You do not hold this NFT'],
  ] as const)('blocker %s disables the button', (blocker, label) => {
    render(<Harness blocker={blocker} quote={undefined} display={null} />);
    expect(screen.getByRole('button', { name: label })).toBeDisabled();
  });

  it('opens the NFT modal from the picker and updates the selection', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Reservoir Ratchet/ }));
    const dialog = screen.getByRole('dialog', { name: 'Choose a claim NFT' });
    expect(within(dialog).getByRole('button', { name: /Smouldering Scarcity/ })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: /Flax Wild Fire/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('#5 · you hold 3')).toBeInTheDocument();
  });

  it('unprofitable: negative metric, disabled button, danger callout', () => {
    render(
      <Harness
        quote={{ kind: 'unprofitable', ethOutWei: 1_900_000_000_000_000n, gasCostWei: 2_600_000_000_000_000n, maxFeePerGas: 4_100_000_000n }}
        display={UNPROFITABLE}
      />,
    );
    const profit = screen.getByTestId('harvest-profit');
    expect(profit).toHaveTextContent('−0.0007');
    expect(profit).toHaveClass('text-pxusd-pink-400');
    expect(screen.getByRole('button', { name: 'Not profitable right now' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Gas (0.0026 ETH) would cost more than the harvest pays (0.0019 ETH). Check back once more yield has built up.',
    );
    expect(screen.queryByTestId('harvest-bar-profit')).not.toBeInTheDocument();
    expect(screen.getByTestId('harvest-bar-gas')).toHaveStyle({ width: '100%' });
  });

  it('a reverting simulation shows its reason and disables the button', () => {
    render(<Harness quote={{ kind: 'error', message: 'No sell route is registered.' }} display={null} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Harvest would fail. No sell route is registered.');
    expect(screen.getByRole('button', { name: 'Harvest unavailable' })).toBeDisabled();
  });

  it('requiresNft=false: no picker, no steps, button goes straight to Harvest', () => {
    render(<Harness requiresNft={false} />);
    expect(screen.queryByTestId('harvest-nft-block')).not.toBeInTheDocument();
    expect(screen.queryByTestId('harvest-steps')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Harvest → receive ~0.0421 ETH' })).toBeEnabled();
  });
});
