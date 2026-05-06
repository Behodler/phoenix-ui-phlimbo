import { useEffect, useRef, useState } from 'react';
import { LoadingSpinner } from '../ui/ActionButton';
import { useToast } from '../ui/ToastProvider';

interface WhaleMintConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  cost: number;
  reward: number;
  batchSize: number;
}

type Stage = 'idle' | 'approving' | 'approved' | 'minting';

const SIMULATED_DELAY_MS = 1200;

function formatUsdc(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatUsds(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

/**
 * Mock-only two-step approve→mint modal for the Whale Mint panel. State
 * machine is fully local; nothing touches wagmi/viem/contracts. Each
 * pending step uses a real `setTimeout` so the spinner feels real, but the
 * timer is cleared on unmount/close.
 */
export default function WhaleMintConfirmModal({
  isOpen,
  onClose,
  cost,
  reward,
  batchSize,
}: WhaleMintConfirmModalProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addToast } = useToast();

  // Reset state when the modal closes so a re-open starts fresh.
  useEffect(() => {
    if (!isOpen) {
      setStage('idle');
    }
  }, [isOpen]);

  // Clear any pending timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const isPending = stage === 'approving' || stage === 'minting';

  const handleApprove = () => {
    setStage('approving');
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setStage('approved');
    }, SIMULATED_DELAY_MS);
  };

  const handleMint = () => {
    setStage('minting');
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      addToast({
        type: 'success',
        title: 'Whale Mint Sent',
        description: (
          <>
            Whale Mint sent — {batchSize} NFTs minted and{' '}
            <em>{formatUsdc(reward)} USDC</em> pot reserved for you.
          </>
        ),
      });
      onClose();
    }, SIMULATED_DELAY_MS);
  };

  const handleClose = () => {
    if (isPending) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
      data-testid="whale-mint-modal"
    >
      <div
        className="bg-background border border-border rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Confirm Whale Mint
          </h3>
          <p className="text-sm text-muted-foreground">
            You'll mint {batchSize} Liquid Sky Phoenix and claim the pot in one
            transaction.
          </p>
        </div>

        <div className="space-y-2 py-2 border-y border-border">
          <div className="flex justify-between items-center text-sm py-1">
            <span className="text-muted-foreground">Mints</span>
            <span className="font-mono text-foreground font-medium">
              {batchSize} × Liquid Sky Phoenix
            </span>
          </div>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="text-muted-foreground">Mint cost</span>
            <span className="font-mono text-foreground font-medium">
              {formatUsds(cost)} USDS
            </span>
          </div>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="text-muted-foreground">Nudge reward</span>
            <span className="font-mono font-medium" style={{ color: 'oklch(78% 0.13 220)' }}>
              {formatUsdc(reward)} USDC
            </span>
          </div>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="text-muted-foreground">You'll receive</span>
            <span className="font-mono text-foreground font-medium">
              {batchSize} NFTs + pot
            </span>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
            data-testid="whale-mint-modal-cancel"
          >
            Cancel
          </button>
          {stage === 'approved' || stage === 'minting' ? (
            <button
              type="button"
              onClick={handleMint}
              disabled={isPending}
              className="flex-1 phoenix-btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="whale-mint-modal-mint"
            >
              {stage === 'minting' && <LoadingSpinner />}
              Mint {batchSize}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApprove}
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-pxusd-orange-500 hover:bg-pxusd-orange-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="whale-mint-modal-approve"
            >
              {stage === 'approving' && <LoadingSpinner />}
              Approve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
