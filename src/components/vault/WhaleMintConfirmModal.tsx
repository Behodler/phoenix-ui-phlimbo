import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import type { Address } from 'viem';
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { batchNftMinterAbi } from '@behodler/phase2-wagmi-hooks';
import { LoadingSpinner } from '../ui/ActionButton';
import { useToast } from '../ui/ToastProvider';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import {
  useTokenAllowance,
  useTokenApproval,
  useTokenBalance,
} from '../../hooks/useContractInteractions';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

interface WhaleMintConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fixed mint count (== on-chain nudgeSize, displayed as a number). */
  count: number;
  /** Total USDS cost as raw bigint — the exact amount BatchNFTMinter pulls. */
  mintCostRaw: bigint;
  /** Current nudge reward pot (nudgePaymentToken balance held by BatchNFTMinter). */
  rewardPotRaw: bigint;
  /** Liquid Sky Phoenix dispatcher index from MinterPageView. */
  dispatcherIndex: number;
  /** Raw on-chain nudgeSize — passed verbatim as the `count` argument to batchMint. */
  nudgeSize: bigint;
  /** Refetcher for MinterPageView; fires after both approve and mint confirm. */
  refetchMinterData: () => void;
  /** Refetcher for the reward-pot balance; fires after a successful mint. */
  refetchRewardPot: () => void;
}

function formatUsdc(raw: bigint): string {
  return Number(formatUnits(raw, 6)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUsds(raw: bigint): string {
  return Number(formatUnits(raw, 18)).toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

/**
 * Two-step approve→mint modal for the Whale Mint flow. Mirrors the live
 * batch-mint flow in `NFTListMintModal` (same hook order, toast wording, and
 * receipt-waiting). The only differences are:
 *   1. `count` is fixed by the on-chain `nudgeSize`, not slider-driven.
 *   2. No NFTCard / BatchMintControls UI inside the modal — the summary
 *      rows replace them.
 */
export default function WhaleMintConfirmModal({
  isOpen,
  onClose,
  count,
  mintCostRaw,
  rewardPotRaw,
  dispatcherIndex,
  nudgeSize,
  refetchMinterData,
  refetchRewardPot,
}: WhaleMintConfirmModalProps) {
  const { address: walletAddress } = useAccount();
  const { addresses, nftPrimary } = useContractAddresses();
  const { approve } = useTokenApproval();
  const { addToast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const usdsAddress = addresses?.USDS as Address | undefined;
  const batchMinter = addresses?.BatchNFTMinter as Address | undefined;
  const nftMinter = nftPrimary?.NFTMinter as Address | undefined;

  const [isApproving, setIsApproving] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | undefined>(undefined);

  // USDS allowance for BatchNFTMinter
  const { allowance, refetch: refetchAllowance } = useTokenAllowance(
    walletAddress,
    batchMinter,
    usdsAddress,
  );

  // User's USDS balance for the insufficient-balance branch.
  const { balance: userUsdsBalanceRaw } = useTokenBalance(
    walletAddress,
    usdsAddress,
  );

  // Wait for approval confirmation.
  const { isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
    query: { enabled: !!approvalTxHash },
  });

  // Wait for mint confirmation.
  const { isSuccess: isMintSuccess } = useWaitForTransactionReceipt({
    hash: mintTxHash,
    query: { enabled: !!mintTxHash },
  });

  // Handle approval success
  useEffect(() => {
    if (isApprovalSuccess && approvalTxHash) {
      setIsApproving(false);
      setApprovalTxHash(undefined);
      refetchAllowance();
      refetchMinterData();
      addToast({
        type: 'success',
        title: 'Approval Confirmed',
        description: 'USDS approval confirmed on-chain. You can now mint.',
      });
    }
  }, [isApprovalSuccess, approvalTxHash, refetchAllowance, refetchMinterData, addToast]);

  // Handle mint success — toast, refetch, close.
  useEffect(() => {
    if (isMintSuccess && mintTxHash) {
      setIsMinting(false);
      setMintTxHash(undefined);
      refetchMinterData();
      refetchAllowance();
      refetchRewardPot();
      addToast({
        type: 'success',
        title: 'Whale Mint Sent',
        description: (
          <>
            Whale Mint sent — {count} NFTs minted and{' '}
            <em>{formatUsdc(rewardPotRaw)} USDC</em> reward reserved for you.
          </>
        ),
      });
      onClose();
    }
    // We intentionally exclude `onClose` etc. from deps where they'd cause
    // re-fires — but include only the success signal + tx hash; the toast
    // text is captured at render time which is acceptable for a one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMintSuccess, mintTxHash]);

  // Reset transient state when the modal closes so a re-open starts fresh.
  useEffect(() => {
    if (!isOpen) {
      setIsApproving(false);
      setIsMinting(false);
      setApprovalTxHash(undefined);
      setMintTxHash(undefined);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLoading = isApproving || isMinting;
  const isApproved =
    allowance !== undefined && mintCostRaw > 0n && allowance >= mintCostRaw;
  const hasInsufficientBalance =
    userUsdsBalanceRaw !== undefined && userUsdsBalanceRaw < mintCostRaw;

  const rewardPotFormatted = formatUsdc(rewardPotRaw);
  const mintCostFormatted = formatUsds(mintCostRaw);

  const canExecute =
    !!walletAddress &&
    !!usdsAddress &&
    !!batchMinter &&
    !!nftMinter &&
    batchMinter.toLowerCase() !== ZERO_ADDRESS &&
    usdsAddress.toLowerCase() !== ZERO_ADDRESS;

  const handleApprove = async () => {
    if (!canExecute) {
      addToast({
        type: 'error',
        title: 'Error',
        description: 'Wallet not connected or contract addresses not loaded.',
      });
      return;
    }
    setIsApproving(true);
    try {
      addToast({
        type: 'info',
        title: 'Confirm in Wallet',
        description: 'Please confirm the USDS approval in your wallet.',
        duration: 30000,
      });
      const hash = await approve(usdsAddress!, batchMinter!, mintCostRaw);
      setApprovalTxHash(hash);
      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for approval confirmation...',
      });
    } catch (error) {
      setIsApproving(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (
        errorMessage.toLowerCase().includes('user rejected') ||
        errorMessage.toLowerCase().includes('user denied')
      ) {
        addToast({
          type: 'error',
          title: 'Transaction Cancelled',
          description: 'You cancelled the approval transaction.',
        });
      } else {
        addToast({ type: 'error', title: 'Approval Failed', description: errorMessage });
      }
    }
  };

  const handleMint = async () => {
    if (!canExecute) {
      addToast({
        type: 'error',
        title: 'Error',
        description: 'Wallet not connected or contract addresses not loaded.',
      });
      return;
    }
    setIsMinting(true);
    try {
      addToast({
        type: 'info',
        title: 'Confirm in Wallet',
        description: 'Please confirm the mint transaction in your wallet.',
        duration: 30000,
      });
      const hash = await writeContractAsync({
        address: batchMinter!,
        abi: batchNftMinterAbi,
        functionName: 'batchMint',
        args: [
          nftMinter!,
          usdsAddress!,
          BigInt(dispatcherIndex),
          nudgeSize,
          walletAddress!,
          mintCostRaw,
        ],
      });
      setMintTxHash(hash);
      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for blockchain confirmation...',
      });
    } catch (error) {
      setIsMinting(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (
        errorMessage.toLowerCase().includes('user rejected') ||
        errorMessage.toLowerCase().includes('user denied')
      ) {
        addToast({
          type: 'error',
          title: 'Transaction Cancelled',
          description: 'You cancelled the mint transaction.',
        });
      } else {
        addToast({ type: 'error', title: 'Mint Failed', description: errorMessage });
      }
    }
  };

  const handleClose = () => {
    if (isLoading) return;
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
            Mint {count} Liquid Sky Phoenix NFTs and receive {rewardPotFormatted} USDC back in the same transaction.
          </p>
        </div>

        <div className="space-y-2 py-2 border-y border-border">
          <div className="flex justify-between items-center text-sm py-1">
            <span className="text-muted-foreground">Mints</span>
            <span className="font-mono text-foreground font-medium">
              {count} × Liquid Sky Phoenix
            </span>
          </div>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="text-muted-foreground">Mint cost</span>
            <span className="font-mono text-foreground font-medium">
              {mintCostFormatted} USDS
            </span>
          </div>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="text-muted-foreground">Nudge reward</span>
            <span className="font-mono font-medium" style={{ color: 'oklch(78% 0.13 220)' }}>
              {rewardPotFormatted} USDC
            </span>
          </div>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="text-muted-foreground">You'll receive</span>
            <span className="font-mono text-foreground font-medium">
              {count} NFTs + {rewardPotFormatted} USDC
            </span>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
            data-testid="whale-mint-modal-cancel"
          >
            Cancel
          </button>
          {!isApproved ? (
            <button
              type="button"
              onClick={handleApprove}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-pxusd-orange-500 hover:bg-pxusd-orange-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="whale-mint-modal-approve"
            >
              {isApproving && <LoadingSpinner />}
              Approve
            </button>
          ) : hasInsufficientBalance ? (
            <button
              type="button"
              disabled
              className="flex-1 px-4 py-2 bg-pxusd-orange-900/40 border border-pxusd-orange-500/50 text-pxusd-orange-300 font-medium rounded-lg cursor-not-allowed opacity-70"
              data-testid="whale-mint-modal-insufficient"
            >
              Insufficient USDS Balance
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMint}
              disabled={isLoading}
              className="flex-1 phoenix-btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="whale-mint-modal-mint"
            >
              {isMinting && <LoadingSpinner />}
              Mint {count}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
