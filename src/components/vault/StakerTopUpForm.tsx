import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { erc20Abi, parseUnits, type Abi } from 'viem';
import { useToast } from '../ui/ToastProvider';
import ActionButton from '../ui/ActionButton';

interface StakerTopUpFormProps {
  /** The staker contract receiving the top-up. */
  stakerAddress: `0x${string}` | undefined;
  /**
   * ABI exposing `topUp(uint256)`. Differs between the fixed-rate stakers
   * (`nftStakerAbi`) and the depletion stakers (`nftStakerDepletionAbi`), but
   * the top-up entrypoint itself is identical in both.
   */
  stakerAbi: Abi;
  /** Reward-token address to approve and transfer (phUSD for every staker). */
  rewardTokenAddress: `0x${string}` | undefined;
  /** Short contract label used in toast/warning copy, e.g. "NFTStaker". */
  stakerLabel: string;
  /** Prefix keeping the input id unique when several forms are on the page. */
  idPrefix: string;
  /** Whether the connected wallet is the staker owner. topUp is owner-only. */
  isOwner: boolean;
  /** Called after a top-up confirms, so the parent can refetch its stats. */
  onToppedUp: () => void;
  /** Reward-token symbol for display. Defaults to phUSD. */
  tokenSymbol?: string;
}

/**
 * Reward-token top-up flow shared by the runway panels: amount input, an
 * approve step that appears only while allowance is short, and the owner-only
 * `topUp` call. Amounts are parsed at 18dp (phUSD).
 */
export default function StakerTopUpForm({
  stakerAddress,
  stakerAbi,
  rewardTokenAddress,
  stakerLabel,
  idPrefix,
  isOwner,
  onToppedUp,
  tokenSymbol = 'phUSD',
}: StakerTopUpFormProps) {
  const { isConnected, address: walletAddress } = useAccount();
  const { addToast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const [topUpAmountInput, setTopUpAmountInput] = useState<string>('');
  const [topUpInputError, setTopUpInputError] = useState<string | null>(null);

  // Parse the user input into a bigint amount, surfacing parse errors inline.
  const parsedTopUpAmount = useMemo<bigint | null>(() => {
    const trimmed = topUpAmountInput.trim();
    if (!trimmed) return null;
    try {
      const value = parseUnits(trimmed, 18);
      return value > 0n ? value : null;
    } catch {
      return null;
    }
  }, [topUpAmountInput]);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: rewardTokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: walletAddress && stakerAddress
      ? [walletAddress as `0x${string}`, stakerAddress]
      : undefined,
    query: { enabled: !!rewardTokenAddress && !!stakerAddress && !!walletAddress },
  });

  const [topUpTxHash, setTopUpTxHash] = useState<`0x${string}` | undefined>();
  const [topUpApproveTxHash, setTopUpApproveTxHash] = useState<`0x${string}` | undefined>();
  const [isTopUpApproving, setIsTopUpApproving] = useState(false);
  const [isTopUpExecuting, setIsTopUpExecuting] = useState(false);

  const { isSuccess: topUpApproveConfirmed } = useWaitForTransactionReceipt({
    hash: topUpApproveTxHash,
    query: { enabled: !!topUpApproveTxHash },
  });
  const { isSuccess: topUpConfirmed } = useWaitForTransactionReceipt({
    hash: topUpTxHash,
    query: { enabled: !!topUpTxHash },
  });

  useEffect(() => {
    if (topUpApproveConfirmed && topUpApproveTxHash) {
      setIsTopUpApproving(false);
      setTopUpApproveTxHash(undefined);
      refetchAllowance();
      addToast({
        type: 'success',
        title: 'Approval Confirmed',
        description: `${tokenSymbol} allowance set for ${stakerLabel}. You can now top up.`,
      });
    }
    // refetchAllowance is stable from wagmi; addToast pulled from context
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topUpApproveConfirmed, topUpApproveTxHash]);

  useEffect(() => {
    if (topUpConfirmed && topUpTxHash) {
      setIsTopUpExecuting(false);
      setTopUpTxHash(undefined);
      refetchAllowance();
      onToppedUp();
      addToast({
        type: 'success',
        title: 'Top Up Confirmed',
        description: `${tokenSymbol} has been transferred to ${stakerLabel}. Runway updated.`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topUpConfirmed, topUpTxHash]);

  const handleApprove = async () => {
    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to approve.',
      });
      return;
    }
    if (!rewardTokenAddress || !stakerAddress) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: `${tokenSymbol} or ${stakerLabel} address missing.`,
      });
      return;
    }
    if (parsedTopUpAmount === null) {
      setTopUpInputError(`Enter a valid ${tokenSymbol} amount > 0.`);
      return;
    }
    setTopUpInputError(null);
    setIsTopUpApproving(true);
    try {
      const hash = await writeContractAsync({
        address: rewardTokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [stakerAddress, parsedTopUpAmount],
      });
      setTopUpApproveTxHash(hash);
      addToast({
        type: 'info',
        title: 'Approval Submitted',
        description: 'Waiting for approval confirmation...',
      });
    } catch (err) {
      setIsTopUpApproving(false);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addToast({
        type: 'error',
        title: 'Approval Failed',
        description: msg,
      });
    }
  };

  const handleTopUp = async () => {
    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to top up.',
      });
      return;
    }
    if (!stakerAddress) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: `${stakerLabel} address missing.`,
      });
      return;
    }
    if (parsedTopUpAmount === null) {
      setTopUpInputError(`Enter a valid ${tokenSymbol} amount > 0.`);
      return;
    }
    setTopUpInputError(null);
    setIsTopUpExecuting(true);
    try {
      const hash = await writeContractAsync({
        address: stakerAddress,
        abi: stakerAbi,
        functionName: 'topUp',
        args: [parsedTopUpAmount],
      });
      setTopUpTxHash(hash);
      addToast({
        type: 'info',
        title: 'Top Up Submitted',
        description: 'Waiting for top-up confirmation...',
      });
    } catch (err) {
      setIsTopUpExecuting(false);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addToast({
        type: 'error',
        title: 'Top Up Failed',
        description: msg,
      });
    }
  };

  const inputId = `${idPrefix}-topup-amount`;

  const allowanceBigint = typeof allowance === 'bigint' ? allowance : 0n;
  const requiredAmount = parsedTopUpAmount ?? 0n;
  const needsApproval = requiredAmount > 0n && allowanceBigint < requiredAmount;
  const txInFlight = isTopUpApproving || isTopUpExecuting;

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-foreground mb-2"
      >
        Top up {tokenSymbol}
      </label>
      <input
        id={inputId}
        data-testid={inputId}
        type="text"
        inputMode="decimal"
        value={topUpAmountInput}
        onChange={(e) => {
          setTopUpAmountInput(e.target.value);
          setTopUpInputError(null);
        }}
        placeholder="e.g. 1000"
        disabled={txInFlight}
        className={
          'w-full px-3 py-2 bg-background border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ' +
          (topUpInputError ? 'border-red-500' : 'border-border')
        }
      />
      {topUpInputError && (
        <p className="text-xs text-red-500 mt-1">{topUpInputError}</p>
      )}

      <div className="flex gap-3 mt-3">
        {needsApproval ? (
          <ActionButton
            disabled={txInFlight || parsedTopUpAmount === null}
            onAction={handleApprove}
            label={isTopUpApproving ? 'Approving…' : `Approve ${tokenSymbol}`}
            variant="primary"
            isLoading={isTopUpApproving}
          />
        ) : (
          <div title={!isOwner ? `${stakerLabel}.owner only` : undefined}>
            <ActionButton
              disabled={txInFlight || parsedTopUpAmount === null || !isOwner}
              onAction={handleTopUp}
              label={isTopUpExecuting ? 'Topping Up…' : 'Top Up'}
              variant="primary"
              isLoading={isTopUpExecuting}
            />
          </div>
        )}
      </div>
      {!isOwner && walletAddress && (
        <p className="text-xs text-muted-foreground mt-2">
          Connected wallet is not the {stakerLabel} owner — Top Up will revert on-chain.
        </p>
      )}
    </div>
  );
}
