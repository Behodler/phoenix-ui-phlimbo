import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HarvestTool from './HarvestTool';
import { FORGE_HARVEST_REQUIRES_NFT, FORGE_HARVEST_SCENARIO } from '../../../data/forgeMockData';

const { addToast } = vi.hoisted(() => ({ addToast: vi.fn() }));

vi.mock('../../ui/ToastProvider', () => ({
  useToast: () => ({ addToast }),
}));

const WARNING_LEAD = 'Estimates, not guarantees.';

describe('HarvestTool', () => {
  beforeEach(() => {
    addToast.mockClear();
  });

  it('ships with the NFT requirement on and the profitable scenario', () => {
    expect(FORGE_HARVEST_REQUIRES_NFT).toBe(true);
    expect(FORGE_HARVEST_SCENARIO).toBe('profitable');
  });

  it('profitable default: numbers, NFT picker, steps, approve → harvest with toasts', async () => {
    const user = userEvent.setup();
    render(<HarvestTool />);

    const profit = screen.getByTestId('harvest-profit');
    expect(profit).toHaveTextContent('+0.0395');
    expect(profit).toHaveClass('text-green-400');
    // |0.0395| × $3,500 = $138.25
    expect(screen.getByText('ETH · ≈ $138.25')).toBeInTheDocument();
    expect(screen.getByText('$412.80')).toBeInTheDocument();
    expect(screen.getByText('0.0421 ETH')).toBeInTheDocument();
    expect(screen.getByText('Est. gas (640k @ 4.1 gwei)')).toBeInTheDocument();
    expect(screen.getByText('−0.0026 ETH')).toBeInTheDocument();
    // 0.0421 × 95% = 0.039995 → floored to 0.0399
    expect(screen.getByText('0.0399 ETH')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Gas 0.0026 ETH/ })).toBeInTheDocument();
    expect(screen.getByTestId('harvest-bar-profit')).toBeInTheDocument();

    expect(screen.getByText('Claim NFT')).toBeInTheDocument();
    expect(screen.getByText('1 is burned per harvest')).toBeInTheDocument();
    expect(screen.getByText('#6 · you hold 2')).toBeInTheDocument();
    expect(screen.getByText(WARNING_LEAD)).toBeInTheDocument();
    expect(screen.queryByText('Not profitable.')).not.toBeInTheDocument();

    const steps = screen.getByTestId('harvest-steps');
    expect(within(steps).getByText('Approve NFTs (once)').closest('li')).toHaveAttribute('data-state', 'current');
    expect(within(steps).getByText('Harvest').closest('li')).toHaveAttribute('data-state', 'pending');

    await user.click(screen.getByRole('button', { name: 'Approve NFTs for the Harvester' }));
    expect(addToast).toHaveBeenCalledWith({
      type: 'info',
      title: 'Approved (preview)',
      description: 'Harvester NFT approval simulated. Nothing was sent.',
    });
    expect(within(steps).getByText('Approve NFTs (once)').closest('li')).toHaveAttribute('data-state', 'done');
    expect(within(steps).getByText('Harvest').closest('li')).toHaveAttribute('data-state', 'current');

    const harvest = screen.getByRole('button', { name: 'Harvest → receive ~0.0421 ETH' });
    expect(harvest).toBeEnabled();
    await user.click(harvest);
    expect(addToast).toHaveBeenLastCalledWith({
      type: 'info',
      title: 'Preview only',
      description: 'Harvesting is mocked on this page. Nothing was sent.',
    });
  });

  it('opens the NFT modal from the picker and updates the selection', async () => {
    const user = userEvent.setup();
    render(<HarvestTool />);
    await user.click(screen.getByRole('button', { name: /Reservoir Ratchet/ }));
    const dialog = screen.getByRole('dialog', { name: 'Choose a claim NFT' });
    expect(
      within(dialog).getByText('The Yield Funnel burns one unit of the NFT you choose. Any type works.'),
    ).toBeInTheDocument();
    // Holdings: 3 and 4 are zero → disabled.
    expect(within(dialog).getByRole('button', { name: /Smouldering Scarcity/ })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: /Bitcoin Buildup/ })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: /Flax Wild Fire/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('#5 · you hold 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Flax Wild Fire/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('unprofitable: negative metric, disabled button, danger callout, no steps', () => {
    render(<HarvestTool scenario="unprofitable" />);
    const profit = screen.getByTestId('harvest-profit');
    expect(profit).toHaveTextContent('−0.0007');
    expect(profit).toHaveClass('text-pxusd-pink-400');
    expect(screen.getByRole('button', { name: 'Not profitable right now' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Approve NFTs for the Harvester' })).not.toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Not profitable.');
    expect(alert).toHaveTextContent(
      'Gas (0.0026 ETH) would cost more than the harvest pays (0.0019 ETH). Check back once more yield has built up.',
    );
    expect(screen.getByText(WARNING_LEAD)).toBeInTheDocument();
    expect(screen.queryByTestId('harvest-steps')).not.toBeInTheDocument();
    expect(screen.queryByTestId('harvest-bar-profit')).not.toBeInTheDocument();
    expect(screen.getByTestId('harvest-bar-gas')).toHaveStyle({ width: '100%' });
  });

  it('requiresNft=false: no picker, no steps, button goes straight to Harvest', async () => {
    const user = userEvent.setup();
    render(<HarvestTool requiresNft={false} />);
    expect(screen.queryByTestId('harvest-nft-block')).not.toBeInTheDocument();
    expect(screen.queryByText('Claim NFT')).not.toBeInTheDocument();
    expect(screen.queryByTestId('harvest-steps')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve NFTs for the Harvester' })).not.toBeInTheDocument();
    expect(screen.getByText(WARNING_LEAD)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Harvest → receive ~0.0421 ETH' }));
    expect(addToast).toHaveBeenCalledWith({
      type: 'info',
      title: 'Preview only',
      description: 'Harvesting is mocked on this page. Nothing was sent.',
    });
  });

  it('requiresNft=false and unprofitable: still disabled "Not profitable right now"', () => {
    render(<HarvestTool requiresNft={false} scenario="unprofitable" />);
    expect(screen.getByRole('button', { name: 'Not profitable right now' })).toBeDisabled();
    expect(screen.getByText(WARNING_LEAD)).toBeInTheDocument();
  });
});
