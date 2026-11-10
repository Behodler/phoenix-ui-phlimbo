import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HarvestTool from './HarvestTool';
import type { ForgeHarvestState } from '../../../hooks/useForgeHarvest';

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

/** HarvestTool is presentational; the harness stands in for `useForgeHarvest`. */
function Harness(overrides: Partial<ForgeHarvestState>) {
  const state: ForgeHarvestState = {
    active: true,
    owner: undefined,
    yieldUsd: 412.8,
    blocker: null,
    quote: OK_QUOTE,
    isQuoting: false,
    display: PROFITABLE,
    pendingAction: null,
    harvest,
    ...overrides,
  };
  return <HarvestTool state={state} />;
}

describe('HarvestTool', () => {
  beforeEach(() => {
    harvest.mockClear();
  });

  it('profitable quote: numbers, no NFT UI, Harvest calls the hook', async () => {
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

    // The SYA is gate-free: no claim-NFT picker, no approval step.
    expect(screen.queryByText('Claim NFT')).not.toBeInTheDocument();
    expect(screen.queryByText(/Approve NFTs/)).not.toBeInTheDocument();
    expect(screen.getByText(WARNING_LEAD)).toBeInTheDocument();
    expect(screen.queryByText('Not profitable.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Harvest → receive ~0.0421 ETH' }));
    expect(harvest).toHaveBeenCalledOnce();
  });

  it.each([
    ['inactive', 'Harvester not live on this network'],
    ['disconnected', 'Connect your wallet'],
    ['loading', 'Loading…'],
  ] as const)('blocker %s disables the button', (blocker, label) => {
    render(<Harness blocker={blocker} quote={undefined} display={null} />);
    expect(screen.getByRole('button', { name: label })).toBeDisabled();
  });

  it('unprofitable: negative metric, disabled button, danger callout', () => {
    render(
      <Harness
        quote={{ ...OK_QUOTE, ethOutWei: 1_900_000_000_000_000n }}
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
});
