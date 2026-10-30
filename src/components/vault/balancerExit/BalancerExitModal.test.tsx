import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BalancerExitDialog } from './BalancerExitModal';
import { BALANCER_EXIT_MOCK, BALANCER_EXIT_MOCK_STEP_MS } from '../../../data/balancerExitMockData';

describe('BalancerExitDialog (mock)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the BPT balance, both legs, the LP received and the leftover', () => {
    render(<BalancerExitDialog preview={BALANCER_EXIT_MOCK} onFinished={() => {}} />);
    expect(screen.getByText('1,842.5173')).toBeInTheDocument();
    expect(screen.getByText('812.4061')).toBeInTheDocument();
    expect(screen.getByText('1,021.8846')).toBeInTheDocument();
    expect(screen.getByText('899.2015')).toBeInTheDocument();
    expect(screen.getByText(/25\.5725 phUSD/)).toBeInTheDocument();
    expect(screen.getByText(/sent to your wallet/)).toBeInTheDocument();
  });

  it('offers no way to close: no close/cancel button, Escape does nothing', () => {
    const onFinished = vi.fn();
    render(<BalancerExitDialog preview={BALANCER_EXIT_MOCK} onFinished={onFinished} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /close|cancel/i })).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onFinished).not.toHaveBeenCalled();
  });

  it('runs approve → migrate → success', () => {
    const onFinished = vi.fn();
    render(<BalancerExitDialog preview={BALANCER_EXIT_MOCK} onFinished={onFinished} />);

    fireEvent.click(screen.getByRole('button', { name: 'Approve Balancer LP' }));
    expect(screen.getByRole('button', { name: 'Approving…' })).toBeDisabled();
    act(() => vi.advanceTimersByTime(BALANCER_EXIT_MOCK_STEP_MS));

    fireEvent.click(screen.getByRole('button', { name: 'Migrate to Uniswap' }));
    act(() => vi.advanceTimersByTime(BALANCER_EXIT_MOCK_STEP_MS));

    expect(screen.getByText('Migration complete')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onFinished).toHaveBeenCalledOnce();
  });
});
