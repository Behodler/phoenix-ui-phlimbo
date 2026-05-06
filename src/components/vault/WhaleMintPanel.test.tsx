import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WhaleMintPanel from './WhaleMintPanel';

// Mock the toast provider so we don't need a wrapping provider in tests.
const addToastMock = vi.fn();
vi.mock('../ui/ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

// Mock the loading spinner to a simple stub so we can assert spinner presence
// via test-id without dragging in the SVG.
vi.mock('../ui/ActionButton', () => ({
  LoadingSpinner: () => <span data-testid="loading-spinner" />,
}));

describe('WhaleMintPanel', () => {
  beforeEach(() => {
    addToastMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Panel rendering', () => {
    it('renders the eyebrow, heading, pot value, cost hint, and CTA', () => {
      render(<WhaleMintPanel />);

      expect(screen.getByTestId('whale-mint-panel')).toBeInTheDocument();
      expect(screen.getByTestId('whale-mint-eyebrow')).toHaveTextContent(
        /Whale Mint · Phoenix ×40/i,
      );
      expect(screen.getByText('Claim the nudge reward')).toBeInTheDocument();

      // Pot displays the configured 10 USDC.
      expect(screen.getByTestId('whale-mint-pot')).toHaveTextContent(/10\.00/);
      expect(screen.getByTestId('whale-mint-pot')).toHaveTextContent(/USDC/);

      // Cost hint reflects 40 × 12.0034 = 480.1360 USDS, on three labelled lines.
      const hint = screen.getByTestId('whale-mint-cost-hint');
      expect(hint).toHaveTextContent(/Mint cost:\s*480\.1360 USDS/);
      expect(hint).toHaveTextContent(/Receive:\s*40 NFTs/);
      expect(hint).toHaveTextContent(/Whale mint reward:\s*10\.00 USDC/);

      // CTA label.
      expect(screen.getByTestId('whale-mint-cta')).toHaveTextContent(
        /Claim Reward/,
      );
    });

    it('does not render the modal until CTA is clicked', () => {
      render(<WhaleMintPanel />);
      expect(screen.queryByTestId('whale-mint-modal')).not.toBeInTheDocument();
    });
  });

  describe('Modal interactions', () => {
    it('opens the modal when the CTA is clicked', async () => {
      const user = userEvent.setup();
      render(<WhaleMintPanel />);

      await user.click(screen.getByTestId('whale-mint-cta'));

      expect(screen.getByTestId('whale-mint-modal')).toBeInTheDocument();
      expect(screen.getByText('Confirm Whale Mint')).toBeInTheDocument();
      expect(screen.getByTestId('whale-mint-modal-approve')).toBeInTheDocument();
    });

    it('closes the modal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<WhaleMintPanel />);

      await user.click(screen.getByTestId('whale-mint-cta'));
      expect(screen.getByTestId('whale-mint-modal')).toBeInTheDocument();

      await user.click(screen.getByTestId('whale-mint-modal-cancel'));
      expect(screen.queryByTestId('whale-mint-modal')).not.toBeInTheDocument();
      expect(addToastMock).not.toHaveBeenCalled();
    });

    it('renders the modal summary rows', async () => {
      const user = userEvent.setup();
      render(<WhaleMintPanel />);

      await user.click(screen.getByTestId('whale-mint-cta'));

      const modal = screen.getByTestId('whale-mint-modal');
      expect(modal).toHaveTextContent('Mints');
      expect(modal).toHaveTextContent(/40 × Liquid Sky Phoenix/);
      expect(modal).toHaveTextContent('Mint cost');
      // Cost appears in both the panel hint and the modal — the modal substring is enough.
      expect(modal).toHaveTextContent(/480\.1360 USDS/);
      expect(modal).toHaveTextContent('Nudge reward');
      expect(modal).toHaveTextContent(/10\.00 USDC/);
      expect(modal).toHaveTextContent("You'll receive");
      expect(modal).toHaveTextContent(/40 NFTs \+ 10\.00 USDC/);
    });

    it('transitions from Approve to Mint after the simulated approval delay', () => {
      // Use fireEvent (synchronous) when fake timers are in play; userEvent v14
      // schedules internal delays on real time and would hang under fake timers.
      vi.useFakeTimers();

      render(<WhaleMintPanel />);

      fireEvent.click(screen.getByTestId('whale-mint-cta'));
      fireEvent.click(screen.getByTestId('whale-mint-modal-approve'));

      // While approving, spinner is visible and button stays as Approve.
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByTestId('whale-mint-modal-approve')).toBeInTheDocument();

      // Advance through the simulated 1.2s approval delay.
      act(() => {
        vi.advanceTimersByTime(1200);
      });

      expect(screen.queryByTestId('whale-mint-modal-approve')).not.toBeInTheDocument();
      expect(screen.getByTestId('whale-mint-modal-mint')).toHaveTextContent(/Mint 40/);
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    it('closes the modal and fires a success toast after the simulated mint delay', () => {
      vi.useFakeTimers();

      render(<WhaleMintPanel />);

      // Open + approve.
      fireEvent.click(screen.getByTestId('whale-mint-cta'));
      fireEvent.click(screen.getByTestId('whale-mint-modal-approve'));
      act(() => {
        vi.advanceTimersByTime(1200);
      });

      // Mint.
      fireEvent.click(screen.getByTestId('whale-mint-modal-mint'));
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1200);
      });

      // Modal closed.
      expect(screen.queryByTestId('whale-mint-modal')).not.toBeInTheDocument();
      // Toast emitted.
      expect(addToastMock).toHaveBeenCalledTimes(1);
      const toastArg = addToastMock.mock.calls[0][0];
      expect(toastArg.type).toBe('success');
      expect(toastArg.title).toBe('Whale Mint Sent');
    });
  });
});
