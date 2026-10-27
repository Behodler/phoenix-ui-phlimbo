import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgeTab, { type ForgeRowDef } from './ForgeTab';
import { FORGE_DEFAULT_OPEN } from '../../../data/forgeMockData';

vi.mock('../../ui/ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

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
    // Mock price 0.98 is above the floor → "Ready" pill.
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
    const bonfire = screen.getByRole('button', { name: 'NFT Bonfire' });
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
      fireEvent.click(screen.getByRole('button', { name: 'NFT Bonfire' }));
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

  it('shares NFT holdings: a bonfire burn updates the Harvest picker count', async () => {
    const user = userEvent.setup();
    render(<ForgeTab />);
    // Harvest is open by default with Reservoir Ratchet #6 ×2.
    expect(screen.getByText('#6 · you hold 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'NFT Bonfire' }));
    await user.click(screen.getByRole('button', { name: /EYE ignition #1/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Reservoir Ratchet/ }));
    await user.click(screen.getByRole('button', { name: /^Burn Reservoir Ratchet → receive / }));
    await user.click(screen.getByRole('button', { name: 'Confirm Burn' }));
    expect(screen.getByText('#6 · you hold 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Harvest Yield' }));
    expect(screen.getByText('#6 · you hold 1')).toBeInTheDocument();
  });
});
