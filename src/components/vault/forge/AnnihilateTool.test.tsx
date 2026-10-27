import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnnihilateTool from './AnnihilateTool';

const { addToast } = vi.hoisted(() => ({ addToast: vi.fn() }));

vi.mock('../../ui/ToastProvider', () => ({
  useToast: () => ({ addToast }),
}));

const input = () => screen.getByPlaceholderText('ENTER AN AMOUNT') as HTMLInputElement;
const cell = (label: string) => screen.getByTestId(`preview-cell-${label}`);

describe('AnnihilateTool', () => {
  beforeEach(() => {
    addToast.mockClear();
  });

  it('starts empty with a disabled "Enter Amount" button and 0.00 preview', () => {
    render(<AnnihilateTool />);
    expect(input().value).toBe('');
    expect(screen.getByRole('button', { name: 'Enter Amount' })).toBeDisabled();
    expect(within(cell('Antimatter')).getByText('0.00')).toBeInTheDocument();
    expect(within(cell('phUSD')).getByText('0.00')).toBeInTheDocument();
  });

  it('shows Max as min(Antimatter, USDC) by default', () => {
    render(<AnnihilateTool />);
    // Antimatter 142.38 < USDC 1,250 → 142.38
    expect(screen.getByRole('button', { name: 'Max: 142.38' })).toBeInTheDocument();
  });

  it('over balance → "Insufficient Balance" + insufficient message + red border', async () => {
    const user = userEvent.setup();
    render(<AnnihilateTool />);
    await user.type(input(), '200');
    expect(screen.getByRole('button', { name: 'Insufficient Balance' })).toBeDisabled();
    expect(screen.getByText('Insufficient Antimatter')).toBeInTheDocument();
    expect(input()).toHaveAttribute('aria-invalid', 'true');
  });

  it('names the stablecoin when only the stable side is short', async () => {
    const user = userEvent.setup();
    render(<AnnihilateTool antimatterBalance={500} />);
    await user.click(screen.getByRole('button', { name: 'Pair with USDC' }));
    await user.click(screen.getByRole('button', { name: /USDe/ }));
    await user.type(input(), '100');
    expect(screen.getByText('Insufficient USDe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insufficient Balance' })).toBeDisabled();
  });

  it('valid amount → Approve USDC → Annihilate → receive 200.00 phUSD, with preview and toasts', async () => {
    const user = userEvent.setup();
    render(<AnnihilateTool />);
    await user.type(input(), '100');

    expect(within(cell('Antimatter')).getByText('100.00')).toBeInTheDocument();
    expect(within(cell('USDC')).getByText('100.00')).toBeInTheDocument();
    expect(within(cell('phUSD')).getByText('200.00')).toBeInTheDocument();
    expect(screen.getByText('≈ $100.00 of USDC leaves your wallet')).toBeInTheDocument();
    // Net = 100 × (2·0.98 − 1) = +96.00; min = 200 × 0.995 = 199.00
    expect(screen.getByText('+$96.00')).toBeInTheDocument();
    expect(screen.getByText('199.00 phUSD')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve USDC' }));
    expect(addToast).toHaveBeenCalledWith({
      type: 'info',
      title: 'Approved (preview)',
      description: 'USDC approval simulated. Nothing was sent.',
    });

    const annihilate = screen.getByRole('button', { name: 'Annihilate → receive 200.00 phUSD' });
    expect(annihilate).toBeEnabled();
    await user.click(annihilate);
    expect(addToast).toHaveBeenLastCalledWith({
      type: 'info',
      title: 'Preview only',
      description: 'Annihilation is mocked on this page. Nothing was sent.',
    });
    expect(input().value).toBe('');
    expect(screen.getByRole('button', { name: 'Enter Amount' })).toBeDisabled();
  });

  it('switching to USDe changes max to 80.00 and needs its own approval', async () => {
    const user = userEvent.setup();
    render(<AnnihilateTool />);

    // Approve USDC first.
    await user.type(input(), '50');
    await user.click(screen.getByRole('button', { name: 'Approve USDC' }));
    expect(screen.getByRole('button', { name: 'Annihilate → receive 100.00 phUSD' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Pair with USDC' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Only stablecoins registered with the phUSD minter can be annihilated.')).toBeInTheDocument();
    const options = within(dialog).getAllByRole('button');
    expect(options.map((b) => b.querySelector('span')?.textContent)).toEqual(['USDC', 'USDe', 'DOLA']);
    expect(options[1]).toHaveTextContent('80.00');
    expect(options[2]).toHaveTextContent('410.25');
    await user.click(within(dialog).getByRole('button', { name: /USDe/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Max: 80.00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve USDe' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Max: 80.00' }));
    expect(input().value).toBe('80');
  });

  it('rejects more than 4 decimals, like Mint', async () => {
    const user = userEvent.setup();
    render(<AnnihilateTool />);
    await user.type(input(), '1.123456');
    expect(input().value).toBe('1.1234');
  });

  it('gated price shows the disabled callout and paused button', async () => {
    const user = userEvent.setup();
    render(<AnnihilateTool price={0.5} />);
    expect(screen.getByText('Annihilation disabled.')).toBeInTheDocument();
    expect(screen.getByText(/phUSD is at \$0\.50\. At \$0\.50 or less/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annihilation paused at phUSD ≤ $0.50' })).toBeDisabled();

    // Still paused with a valid amount, and net value is shown as a loss/zero.
    await user.type(input(), '10');
    expect(screen.getByRole('button', { name: 'Annihilation paused at phUSD ≤ $0.50' })).toBeDisabled();
    expect(addToast).not.toHaveBeenCalled();
  });

  it('below the floor shows a negative net value with a real minus sign', async () => {
    const user = userEvent.setup();
    render(<AnnihilateTool price={0.4} />);
    await user.type(input(), '10');
    // 10 × (0.8 − 1) = −2.00
    expect(screen.getByText('−$2.00')).toBeInTheDocument();
  });

  it('is not gated just above the floor', () => {
    render(<AnnihilateTool price={0.51} />);
    expect(screen.queryByText('Annihilation disabled.')).not.toBeInTheDocument();
  });
});
