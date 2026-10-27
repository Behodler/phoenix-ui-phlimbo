import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('opens the FORGE_DEFAULT_OPEN row (Annihilate) initially', () => {
    expect(FORGE_DEFAULT_OPEN).toBe('annihilate');
    render(<ForgeTab />);
    expect(screen.getByRole('button', { name: 'Annihilate Antimatter' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Annihilation preview')).toBeInTheDocument();
    // Mock price 0.98 is above the floor → "Ready" pill.
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('clicking the open row header collapses it', async () => {
    const user = userEvent.setup();
    render(<ForgeTab />);
    const header = screen.getByRole('button', { name: 'Annihilate Antimatter' });
    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Annihilation preview')).not.toBeInTheDocument();
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
});
