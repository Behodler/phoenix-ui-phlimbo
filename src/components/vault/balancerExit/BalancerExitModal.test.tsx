import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BalancerExitDialog, type BalancerExitDialogProps } from './BalancerExitModal';
import type { BalancerExitPreview } from '../../../data/balancerExitData';
import { withSlippage } from '../../../hooks/useBalancerExit';

const PREVIEW: BalancerExitPreview = {
  bptAmount: 1_842_517_300_000_000_000_000n,
  sUSDSOut: 812_406_100_000_000_000_000n,
  phUSDOut: 1_021_884_550_000_000_000_000n,
  sUSDSUsed: 812_406_100_000_000_000_000n,
  phUSDUsed: 996_312_040_000_000_000_000n,
  leftoverToken: 'phUSD',
  leftoverAmount: 25_572_510_000_000_000_000n,
  recoveryMode: false,
  expectedLiquidity: 899_201_480_000_000_000_000n,
};

function renderDialog(overrides: Partial<BalancerExitDialogProps> = {}) {
  const props: BalancerExitDialogProps = {
    preview: PREVIEW,
    step: 'approve',
    pending: false,
    onAdvance: vi.fn(),
    onFinished: vi.fn(),
    ...overrides,
  };
  render(<BalancerExitDialog {...props} />);
  return props;
}

describe('BalancerExitDialog', () => {
  it('shows the BPT balance, both legs, the LP received and the leftover', () => {
    renderDialog();
    expect(screen.getByText('1,842.5173')).toBeInTheDocument();
    expect(screen.getByText('812.4061')).toBeInTheDocument();
    expect(screen.getByText('1,021.8846')).toBeInTheDocument();
    expect(screen.getByText('899.2015')).toBeInTheDocument();
    expect(screen.getByText(/25\.5725 phUSD/)).toBeInTheDocument();
    expect(screen.getByText(/sent to your wallet/)).toBeInTheDocument();
  });

  it('hides the leftover line when nothing is left over', () => {
    renderDialog({ preview: { ...PREVIEW, leftoverAmount: 0n } });
    expect(screen.queryByText(/sent to your wallet/)).toBeNull();
  });

  it('offers no way to close: one button, no close/cancel, Escape does nothing', () => {
    const props = renderDialog();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /close|cancel/i })).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(props.onFinished).not.toHaveBeenCalled();
  });

  it('labels the button by step and calls onAdvance', () => {
    const props = renderDialog({ step: 'migrate' });
    fireEvent.click(screen.getByRole('button', { name: 'Migrate to Uniswap' }));
    expect(props.onAdvance).toHaveBeenCalledOnce();
  });

  it('disables the button and explains why when blocked', () => {
    const props = renderDialog({ blockedReason: 'Preview only' });
    const btn = screen.getByRole('button', { name: 'Approve Balancer LP' });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(props.onAdvance).not.toHaveBeenCalled();
    expect(screen.getByText('Preview only')).toBeInTheDocument();
  });

  it('shows the success screen once done; Continue calls onFinished', () => {
    const props = renderDialog({ step: 'done' });
    expect(screen.getByText('Migration complete')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(props.onFinished).toHaveBeenCalledOnce();
  });
});

describe('withSlippage', () => {
  it('floors by 50 bps', () => {
    expect(withSlippage(10_000n)).toBe(9_950n);
  });

  it('never returns zero, because migrate rejects a zero minimum', () => {
    expect(withSlippage(0n)).toBe(1n);
    expect(withSlippage(1n)).toBe(1n);
  });
});
