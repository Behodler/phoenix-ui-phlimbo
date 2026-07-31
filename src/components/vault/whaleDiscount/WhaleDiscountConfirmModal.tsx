import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import type { Address } from 'viem';
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { batchNftMinterMultiTokenAbi } from '@behodler/phase2-wagmi-hooks';
import { LoadingSpinner } from '../../ui/ActionButton';
import { useToast } from '../../ui/ToastProvider';
import { useContractAddresses } from '../../../contexts/ContractAddressContext';
import {
  useTokenAllowance,
  useTokenApproval,
  useTokenBalance,
} from '../../../hooks/useContractInteractions';
import type {
  NudgePayment,
  NudgePotToken,
} from '../../../hooks/useNudgePot';
import { useLiveNudgePot } from '../../../hooks/useLiveNudgePot';
import { WHALE_DISCOUNT_CYAN } from '../../../data/nudgeTokenMeta';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

interface WhaleDiscountConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fixed mint count (== on-chain nudgeSize, displayed as a number). */
  count: number;
  /** Exact cumulative charge as raw bigint, in the payment token's own units. */
  mintCostRaw: bigint;
  /**
   * What to approve and pass as `paymentAmount` — `mintCostRaw` plus headroom
   * for the dispatcher's price ramping before the tx lands. `batchMint` refunds
   * the unspent remainder in the same transaction.
   */
  mintBudgetRaw: bigint;
  /**
   * The token `batchMint` will actually charge, derived from the minter's
   * pinned `dispatcherIndex` — NOT assumed to be USDS.
   */
  payment: NudgePayment;
  /**
   * The live pot, in on-chain whitelist order. Order is load-bearing: the
   * `minRewards` array passed to `batchMint` is positional and the contract
   * reverts with `BatchMint__ArrayLengthMismatch` if it does not line up with
   * `getNudgeTokens()`.
   */
  tokens: NudgePotToken[];
  /** Raw on-chain nudgeSize — passed verbatim as the `count` argument to batchMint. */
  nudgeSizeRaw: bigint;
  /** When the pot reads resolved — the anchor the live reward figures count from. */
  readAtMs: number;
  /** Refetcher for the pot + minter reads; fires after approve and after mint. */
  refetchPot: () => void;
}

function formatPayment(raw: bigint, decimals: number): string {
  // Match the 4-decimal display used by the mint list for Liquid Sky Phoenix.
  // Scaled by the payment token's OWN decimals — a 6-decimal payment token
  // rendered at 18 would show a cost 12 orders of magnitude too small.
  return Number(formatUnits(raw, decimals)).toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

/**
 * Two-step approve→mint modal for the Whale Discount flow.
 *
 * Same shape as the Mint tab's `WhaleMintConfirmModal` — identical hook order,
 * toast wording and receipt-waiting — with one substantive difference: the
 * reward is a *list* of tokens rather than a single USDC figure, so the summary
 * enumerates every leg and `batchMint` takes a positional `minRewards` array
 * instead of a scalar floor.
 *
 * Each element of `minRewards` is that token's whole pot as of one block — its
 * settled balance plus its accrued NudgeStreamer stream. The displayed figures
 * keep counting past that (the streamer meters in every second) and the actual
 * payout depends on when the tx lands, so the summary carries a note saying so.
 * The floor is what makes the note safe to write: the mint reverts rather than
 * paying out below the amount that was on screen when the modal opened.
 */
export default function WhaleDiscountConfirmModal({
  isOpen,
  onClose,
  count,
  mintCostRaw,
  mintBudgetRaw,
  payment,
  tokens,
  nudgeSizeRaw,
  readAtMs,
  refetchPot,
}: WhaleDiscountConfirmModalProps) {
  const { address: walletAddress } = useAccount();
  const { addresses } = useContractAddresses();
  const { approve } = useTokenApproval();
  const { addToast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const paymentTokenAddress = payment.address;
  const batchMinter = addresses?.BatchNFTMinter as Address | undefined;

  const [isApproving, setIsApproving] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | undefined>(undefined);

  // Payment-token allowance for the batch minter.
  const { allowance, refetch: refetchAllowance } = useTokenAllowance(
    walletAddress,
    batchMinter,
    paymentTokenAddress,
  );

  // User's payment-token balance for the insufficient-balance branch.
  const { balance: userPaymentBalanceRaw } = useTokenBalance(
    walletAddress,
    paymentTokenAddress,
  );

  // Each reward is shown as ONE number — what the mint pays out — with no
  // split between the minter's settled balance and the NudgeStreamer's accrued
  // stream. That distinction is real on-chain but invisible to whoever is
  // signing: `batchMint` pulls the stream in before it pays, so both halves
  // land in the same transfer. Surfacing it only invites "why two numbers?".
  //
  // Slower than the panel's cadence: this is a figure someone is reading while
  // deciding to sign, and a number that moves under the cursor is worse here
  // than one that lags by a few seconds.
  const { tokens: liveTokens, isStreaming } = useLiveNudgePot(
    tokens,
    readAtMs,
    { tickMs: 4_000 }
  );

  // Only legs that actually pay out belong in the summary — a whitelisted
  // token with an empty pot would otherwise read as "and 0 FLAX". Declared
  // above the effects because the success toast closes over `rewardSummary`.
  const payingTokens = liveTokens.filter((token) => token.totalRaw > 0n);
  const rewardSummary = payingTokens
    .map((token) => `${token.liveAmountFormatted} ${token.symbol}`)
    .join(' + ');

  const { isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
    query: { enabled: !!approvalTxHash },
  });

  const { isSuccess: isMintSuccess } = useWaitForTransactionReceipt({
    hash: mintTxHash,
    query: { enabled: !!mintTxHash },
  });

  useEffect(() => {
    if (isApprovalSuccess && approvalTxHash) {
      setIsApproving(false);
      setApprovalTxHash(undefined);
      refetchAllowance();
      refetchPot();
      addToast({
        type: 'success',
        title: 'Approval Confirmed',
        description: `${payment.symbol} approval confirmed on-chain. You can now mint.`,
      });
    }
  }, [
    isApprovalSuccess,
    approvalTxHash,
    refetchAllowance,
    refetchPot,
    addToast,
    payment.symbol,
  ]);

  useEffect(() => {
    if (isMintSuccess && mintTxHash) {
      setIsMinting(false);
      setMintTxHash(undefined);
      refetchPot();
      refetchAllowance();
      addToast({
        type: 'success',
        title: 'Whale Mint Sent',
        description: (
          <>
            Whale Mint sent — {count} NFTs minted and the full nudge pot
            {rewardSummary ? <> (<em>{rewardSummary}</em>)</> : null} reserved
            for you.
          </>
        ),
      });
      onClose();
    }
    // One-shot on the success signal; the toast text is captured at render
    // time, which is fine here. Re-firing on the other deps would re-toast.
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
  // Both gates test the BUDGET, not the bare cost: the budget is what gets
  // pulled, so an allowance or balance that only covers `mintCostRaw` would
  // pass here and then revert inside `safeTransferFrom`.
  const isApproved =
    allowance !== undefined && mintBudgetRaw > 0n && allowance >= mintBudgetRaw;
  const hasInsufficientBalance =
    userPaymentBalanceRaw !== undefined &&
    userPaymentBalanceRaw < mintBudgetRaw;

  const mintCostFormatted = formatPayment(mintCostRaw, payment.decimals);

  const canExecute =
    !!walletAddress &&
    !!paymentTokenAddress &&
    !!batchMinter &&
    batchMinter.toLowerCase() !== ZERO_ADDRESS &&
    paymentTokenAddress.toLowerCase() !== ZERO_ADDRESS;

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
        description: `Please confirm the ${payment.symbol} approval in your wallet.`,
        duration: 30000,
      });
      const hash = await approve(
        paymentTokenAddress!,
        batchMinter!,
        mintBudgetRaw,
      );
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
      // `minRewards` is positional against `getNudgeTokens()` and must cover
      // every whitelisted token, including the empty legs — hence `tokens`
      // rather than `payingTokens`. Each floor is the pot we just showed, so a
      // pot drained by a competing mint reverts instead of silently paying out
      // less.
      //
      // The floor is `totalRaw` (balance + pendingStream as of one block), NOT
      // the panel's live extrapolation. Two reasons it is safe to demand the
      // streamed portion:
      //   1. `batchMint` pulls every whitelisted token's stream before it
      //      snapshots, so the pending amount is inside what gets measured.
      //   2. `balance + pending` only ever rises between our read and mining —
      //      settling moves value from the buffer into the balance and leaves
      //      the sum untouched, and accrual only adds. The one thing that
      //      lowers it is a competing payout, which is exactly what this floor
      //      exists to catch.
      // Signing the live-extrapolated figure instead would put a browser clock
      // ahead of `block.timestamp` and revert honest mints.
      const hash = await writeContractAsync({
        address: batchMinter!,
        abi: batchNftMinterMultiTokenAbi,
        functionName: 'batchMint',
        args: [
          nudgeSizeRaw,
          walletAddress!,
          mintBudgetRaw,
          tokens.map((token) => token.totalRaw),
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
      data-testid="whale-discount-modal"
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
            Mint {count} Liquid Sky Phoenix NFTs and receive the entire nudge
            reward pot back in the same transaction.
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
              {mintCostFormatted} {payment.symbol}
            </span>
          </div>

          {/*
            One row per reward token, in whitelist order — the same order the
            `minRewards` array uses, so the summary doubles as a readout of what
            is actually being enforced on-chain. Empty legs are omitted.
          */}
          <div className="pt-1" data-testid="whale-discount-modal-rewards">
            <div className="text-sm text-muted-foreground py-1">
              Nudge reward
            </div>
            {payingTokens.length === 0 ? (
              <div className="text-sm font-mono text-muted-foreground pl-3">
                Pot is empty
              </div>
            ) : (
              payingTokens.map((token) => (
                <div
                  key={token.address}
                  className="flex justify-between items-center text-sm py-1 pl-3"
                  data-testid={`whale-discount-modal-reward-${token.canonical}`}
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {token.logo ? (
                      <img
                        src={token.logo}
                        alt=""
                        className="w-4 h-4 rounded-full object-cover bg-[#050a14]"
                      />
                    ) : null}
                    {token.symbol}
                  </span>
                  <span
                    className="font-mono font-medium"
                    style={{ color: WHALE_DISCOUNT_CYAN }}
                  >
                    {token.liveAmountFormatted} {token.symbol}
                  </span>
                </div>
              ))
            )}
          </div>

          {/*
            The pot is metered in continuously by the NudgeStreamer, so the
            figures above are a reading, not a quote — whatever has accrued by
            the time the transaction lands is what gets paid. Saying so is the
            honest alternative to freezing a number we cannot honour exactly.
            The floor we actually sign guarantees the direction: never less.
          */}
          {isStreaming && (
            <p
              className="text-[11px] leading-snug text-muted-foreground pt-1 m-0"
              data-testid="whale-discount-modal-stream-note"
            >
              The reward pot fills continuously, so the final amounts depend on
              when your transaction lands. You will never receive less than
              shown here — the mint reverts rather than paying out below it.
            </p>
          )}

          <div className="flex justify-between items-center text-sm py-1 border-t border-border pt-2">
            <span className="text-muted-foreground">You'll receive</span>
            <span className="font-mono text-foreground font-medium text-right">
              {count} NFTs{rewardSummary ? ` + ${rewardSummary}` : ''}
            </span>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
            data-testid="whale-discount-modal-cancel"
          >
            Cancel
          </button>
          {!isApproved ? (
            <button
              type="button"
              onClick={handleApprove}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-pxusd-orange-500 hover:bg-pxusd-orange-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="whale-discount-modal-approve"
            >
              {isApproving && <LoadingSpinner />}
              Approve
            </button>
          ) : hasInsufficientBalance ? (
            <button
              type="button"
              disabled
              className="flex-1 px-4 py-2 bg-pxusd-orange-900/40 border border-pxusd-orange-500/50 text-pxusd-orange-300 font-medium rounded-lg cursor-not-allowed opacity-70"
              data-testid="whale-discount-modal-insufficient"
            >
              Insufficient {payment.symbol} Balance
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMint}
              disabled={isLoading}
              className="flex-1 phoenix-btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="whale-discount-modal-mint"
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
