import { useCallback, useEffect, useState } from 'react';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { nftMigratorAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import { useV1NFTStatus } from '../../hooks/useV1NFTStatus';
import { useToast } from '../ui/ToastProvider';
import { LoadingSpinner } from '../ui/ActionButton';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * NFTUpgradeModal
 *
 * Page-load modal that detects whether the connected wallet holds any V1
 * NFTs and, if so, prompts the user to perform a once-off upgrade via
 * `NFTMigrator.migrate()`. Dismissal is in-memory only — no localStorage,
 * no sessionStorage. A full page reload or wallet change re-triggers the
 * detection and re-shows the modal if the user still holds V1 tokens.
 *
 * All user-visible vocabulary uses "upgrade" / "upgraded" / "upgrading"
 * per product direction. The underlying contract is still called
 * `NFTMigrator` and the function is still `migrate()` — those stay as-is
 * in code per generated ABI.
 */
export default function NFTUpgradeModal() {
  const { address: walletAddress } = useAccount();
  const { addresses } = useContractAddresses();
  const { hasV1, migratorReady, loading, refetch } = useV1NFTStatus(walletAddress);
  const { addToast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const [dismissed, setDismissed] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    isLoading: isWaiting,
    isSuccess,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  // Reset dismissal state whenever the connected wallet address changes
  // (disconnect, reconnect, account switch). This guarantees account B
  // sees the modal even if account A dismissed it in the same session.
  useEffect(() => {
    setDismissed(false);
  }, [walletAddress]);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Escape key dismisses
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dismiss]);

  // When the migrate tx succeeds, refetch balances. The next render will
  // observe hasV1 === false and stop rendering the modal naturally.
  useEffect(() => {
    if (isSuccess && txHash) {
      addToast({
        type: 'success',
        title: 'NFTs Upgraded',
        description: 'Your NFTs have been successfully upgraded.',
      });
      setTxHash(undefined);
      setIsSubmitting(false);
      refetch();
    }
  }, [isSuccess, txHash, addToast, refetch]);

  // Surface receipt-level errors (e.g. tx reverted on-chain after submission).
  useEffect(() => {
    if (isReceiptError && txHash) {
      const message =
        receiptError instanceof Error
          ? receiptError.message
          : 'Upgrade transaction failed on-chain.';
      addToast({
        type: 'error',
        title: 'Upgrade Failed',
        description: message,
      });
      setTxHash(undefined);
      setIsSubmitting(false);
    }
  }, [isReceiptError, receiptError, txHash, addToast]);

  const migratorAddress = addresses?.NFTMigrator as `0x${string}` | undefined;

  const handleUpgrade = async () => {
    if (
      !migratorAddress ||
      migratorAddress.toLowerCase() === ZERO_ADDRESS
    ) {
      addToast({
        type: 'error',
        title: 'Upgrade Unavailable',
        description: 'Upgrade contract is not configured on this network.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      addToast({
        type: 'info',
        title: 'Confirm in Wallet',
        description: 'Please confirm the upgrade transaction in your wallet.',
        duration: 30000,
      });
      const hash = await writeContractAsync({
        address: migratorAddress,
        abi: nftMigratorAbi,
        functionName: 'migrate',
      });
      setTxHash(hash);
      addToast({
        type: 'info',
        title: 'Upgrade Submitted',
        description: 'Upgrade transaction submitted. Waiting for confirmation…',
      });
    } catch (err) {
      setIsSubmitting(false);
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (
        message.toLowerCase().includes('user rejected') ||
        message.toLowerCase().includes('user denied')
      ) {
        addToast({
          type: 'error',
          title: 'Upgrade Cancelled',
          description: 'You cancelled the upgrade transaction.',
        });
      } else {
        addToast({
          type: 'error',
          title: 'Upgrade Failed',
          description: message,
        });
      }
    }
  };

  const shouldShow = !loading && !dismissed && hasV1 && migratorReady;
  if (!shouldShow) return null;

  const isBusy = isSubmitting || isWaiting;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[110] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nft-upgrade-title"
      aria-describedby="nft-upgrade-body"
      onClick={(e) => {
        // Only dismiss when the user clicks the backdrop itself, not any
        // child element.
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        className="relative bg-background border border-border rounded-xl max-w-lg w-full p-6 sm:p-8 shadow-2xl animate-fade-in"
      >
        {/* X close button (top-right) */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close upgrade dialog"
          className="absolute top-3 right-3 p-2 text-muted-foreground hover:text-foreground rounded-md transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-6 text-center">
          <h2
            id="nft-upgrade-title"
            className="text-xl sm:text-2xl font-bold text-foreground"
          >
            Upgrade your NFTs
          </h2>
          <div className="mt-2 w-16 h-1 bg-primary mx-auto rounded-full" />
        </div>

        {/* Body — exact D8 copy */}
        <div className="mb-8">
          <div className="bg-pxusd-teal-900/50 border border-border rounded-lg p-4 sm:p-5">
            <p
              id="nft-upgrade-body"
              className="text-foreground text-sm sm:text-base leading-relaxed"
            >
              In order for Phoenix to enter a higher plane of yield opportunities,
              we will have to perform a once off upgrade on the NFTs. All of your
              existing NFTs will remain but will simply be upgraded.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row-reverse gap-3">
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={isBusy}
            className="phoenix-btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBusy && <LoadingSpinner />}
            Upgrade NFTs
          </button>
          <button
            type="button"
            onClick={dismiss}
            disabled={isBusy}
            className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

export { NFTUpgradeModal };
