import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { maxUint256 } from 'viem';
import { stableYieldAccumulatorAbi } from '@behodler/phase2-wagmi-hooks';
import ActionButton from '../ui/ActionButton';
import ConfirmationDialog from '../ui/ConfirmationDialog';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import { useYieldFunnelData, type PendingYieldItem } from '../../hooks/useYieldFunnelData';
import { useTokenAllowance, useTokenApproval } from '../../hooks/useContractInteractions';
import { useApprovalTransaction } from '../../hooks/useTransaction';
import { useToast } from '../ui/ToastProvider';
import { getErrorTitle, shouldOfferRetry } from '../../utils/transactionErrors';
import { log } from '../../utils/logger';

export default function YieldFunnelTab() {
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Wagmi hooks for wallet connection
  const { isConnected, address: walletAddress } = useAccount();

  // Contract addresses context
  const { addresses, networkType } = useContractAddresses();

  // Toast notifications
  const { addToast } = useToast();

  // Fetch yield funnel data from contract
  const {
    pendingYield,
    discountPercent,
    claimAmount,
    claimAmountFormatted,
    totalYieldFormatted,
    profitFormatted,
    isLoading: isDataLoading,
    isError: isDataError,
    error: dataError,
    refetch: refetchYieldData,
  } = useYieldFunnelData();

  // Token approval hook for USDC
  const { approve } = useTokenApproval();

  // Fetch USDC allowance for StableYieldAccumulator contract
  const {
    allowance: usdcAllowanceRaw,
    isLoading: usdcAllowanceLoading,
    refetch: refetchAllowance,
  } = useTokenAllowance(
    walletAddress,
    addresses?.StableYieldAccumulator as `0x${string}` | undefined,
    addresses?.USDC as `0x${string}` | undefined
  );

  // Check if approval is needed
  const needsApproval = usdcAllowanceRaw !== undefined
    ? usdcAllowanceRaw < claimAmount
    : true; // Default to needing approval if not loaded

  // USDC approval transaction state management
  const approvalTransaction = useApprovalTransaction(
    async () => {
      if (!addresses?.USDC || !addresses?.StableYieldAccumulator) {
        throw new Error('Contract addresses not loaded');
      }
      // Approve unlimited amount for better UX
      return approve(
        addresses.USDC as `0x${string}`,
        addresses.StableYieldAccumulator as `0x${string}`,
        maxUint256
      );
    },
    {
      onSuccess: async (hash) => {
        await refetchAllowance();

        addToast({
          type: 'success',
          title: 'Approval Successful',
          description: 'USDC spending has been approved for claiming yield.',
          duration: 30000,
          action: {
            label: 'View Transaction',
            onClick: () => {
              const explorerUrl = networkType === 'mainnet'
                ? `https://etherscan.io/tx/${hash}`
                : `https://sepolia.etherscan.io/tx/${hash}`;
              window.open(explorerUrl, '_blank');
            }
          }
        });
      },
      onError: (error) => {
        log.error('USDC approval failed:', error);
      },
      onStatusChange: (status) => {
        if (status === 'PENDING_SIGNATURE') {
          addToast({
            type: 'info',
            title: 'Confirm in Wallet',
            description: 'Please confirm the approval transaction in your wallet.',
            duration: 30000,
          });
        } else if (status === 'PENDING_CONFIRMATION') {
          addToast({
            type: 'info',
            title: 'Transaction Submitted',
            description: 'Waiting for blockchain confirmation...',
            duration: 30000,
          });
        }
      }
    }
  );

  // Claim transaction state
  const { data: claimHash, writeContractAsync: writeClaim, isPending: isClaimPending } = useWriteContract();
  const { isLoading: isClaimConfirming, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({
    hash: claimHash,
    query: {
      enabled: !!claimHash,
    },
  });

  // Handle approval button click
  const handleApprove = async (): Promise<void> => {
    if (!isConnected) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    if (!addresses?.USDC || !addresses?.StableYieldAccumulator) {
      addToast({
        type: 'error',
        title: 'Contract Not Ready',
        description: 'Please wait for contract addresses to load.',
      });
      return;
    }

    try {
      await approvalTransaction.execute();
    } catch {
      if (approvalTransaction.state.error) {
        const { error: txError } = approvalTransaction.state;
        addToast({
          type: 'error',
          title: getErrorTitle(txError.type),
          description: txError.message,
          duration: 16000,
          action: shouldOfferRetry(txError.type) ? {
            label: 'Retry',
            onClick: () => approvalTransaction.retry()
          } : undefined
        });
      }
    }
  };

  // Handle supply initiation
  const handleInitiateSupply = () => {
    if (!isConnected) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    // Check if there is yield to claim
    if (pendingYield.length === 0 || claimAmount === 0n) {
      addToast({
        type: 'error',
        title: 'No Yield Available',
        description: 'There is no pending yield to claim at this time.',
      });
      return;
    }

    setShowConfirmation(true);
  };

  // Handle supply confirmation
  const handleConfirmSupply = async () => {
    setShowConfirmation(false);

    if (!addresses?.StableYieldAccumulator) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'StableYieldAccumulator contract address not loaded. Please try again.',
      });
      return;
    }

    try {
      // Show pending toast
      addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the claim transaction in your wallet.',
        duration: 30000,
      });

      // Call claim function
      const hash = await writeClaim({
        address: addresses.StableYieldAccumulator as `0x${string}`,
        abi: stableYieldAccumulatorAbi,
        functionName: 'claim',
      });

      // Show confirming toast
      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for blockchain confirmation...',
        duration: 30000,
        action: {
          label: 'View on Etherscan',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${hash}`
              : `https://sepolia.etherscan.io/tx/${hash}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });
    } catch (error) {
      log.error('Claim failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Check for user rejection
      if (errorMessage.toLowerCase().includes('user rejected') ||
          errorMessage.toLowerCase().includes('user denied')) {
        addToast({
          type: 'error',
          title: 'Transaction Cancelled',
          description: 'You cancelled the transaction. Please try again when ready.',
          duration: 8000,
        });
      } else {
        addToast({
          type: 'error',
          title: 'Claim Failed',
          description: errorMessage,
          duration: 16000,
        });
      }
    }
  };

  // Handle claim success in useEffect to prevent infinite loop
  useEffect(() => {
    if (isClaimSuccess && claimHash) {
      addToast({
        type: 'success',
        title: 'Claim Successful',
        description: `Successfully claimed yield tokens! You paid ${claimAmountFormatted} USDC for ${totalYieldFormatted} worth of yield.`,
        duration: 30000,
        action: {
          label: 'View Transaction',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${claimHash}`
              : `https://sepolia.etherscan.io/tx/${claimHash}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });

      // Refetch data
      refetchYieldData();
      refetchAllowance();
    }
  }, [isClaimSuccess, claimHash]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle dialog close
  const handleCloseDialog = () => {
    setShowConfirmation(false);
  };

  // Determine button state
  const isTransacting = approvalTransaction.state.isPending ||
                       approvalTransaction.state.isConfirming ||
                       isClaimPending ||
                       isClaimConfirming;

  // Format number with 2 decimal places
  const formatAmount = (amount: string): string => {
    const num = parseFloat(amount);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  // Determine button label and action
  let buttonLabel = 'Connect Wallet';
  let buttonVariant: 'primary' | 'approve' = 'primary';
  let buttonAction = () => {};
  let buttonDisabled = true;
  let buttonLoading = false;

  if (isConnected) {
    if (isDataLoading || usdcAllowanceLoading) {
      buttonLabel = 'Loading...';
      buttonLoading = true;
      buttonDisabled = true;
    } else if (isDataError) {
      buttonLabel = 'Error loading data';
      buttonDisabled = true;
    } else if (pendingYield.length === 0 || claimAmount === 0n) {
      buttonLabel = 'No yield available';
      buttonDisabled = true;
    } else if (needsApproval) {
      buttonLabel = 'Approve USDC';
      buttonVariant = 'approve';
      buttonAction = handleApprove;
      buttonDisabled = false;
      buttonLoading = isTransacting;
    } else {
      buttonLabel = `Supply ${claimAmountFormatted} USDC`;
      buttonAction = handleInitiateSupply;
      buttonDisabled = false;
      buttonLoading = isTransacting;
    }
  }

  // Render loading state
  if (isDataLoading && !isDataError) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Yield Funnel</h2>
          <p className="text-sm text-muted-foreground">
            Loading yield data from contract...
          </p>
        </div>

        <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6 animate-pulse">
          <div className="h-6 bg-pxusd-teal-600 rounded mb-3 w-1/3"></div>
          <div className="space-y-2">
            <div className="h-4 bg-pxusd-teal-600 rounded w-full"></div>
            <div className="h-4 bg-pxusd-teal-600 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (isDataError && dataError) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Yield Funnel</h2>
          <p className="text-sm text-muted-foreground">
            Yield flows from multiple sources. Supply USDC to claim accumulated yield tokens at a discount.
          </p>
        </div>

        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
          <p className="text-red-400 font-bold text-sm mb-2">Error Loading Data</p>
          <p className="text-sm text-foreground">
            {dataError.message || 'Failed to fetch yield funnel data. Please try refreshing the page.'}
          </p>
        </div>

        <ActionButton
          disabled={true}
          onAction={() => {}}
          label="Unable to load"
          variant="primary"
          isLoading={false}
        />
      </div>
    );
  }

  // Render empty state
  if (pendingYield.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Yield Funnel</h2>
          <p className="text-sm text-muted-foreground">
            Yield flows from multiple sources. Supply USDC to claim accumulated yield tokens at a discount.
          </p>
        </div>

        <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-pxusd-orange-300 mb-3">Pending Yield</h3>
          <p className="text-sm text-muted-foreground">
            No pending yield available at this time. Yield accumulates from registered strategies over time.
          </p>
        </div>

        <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-foreground">Total Yield Value:</span>
              <span className="font-medium text-pxusd-yellow-400">$0.00</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-foreground">Discount:</span>
              <span className="font-medium text-pxusd-green-400">{discountPercent}%</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-foreground">Your Cost:</span>
              <span className="font-medium text-pxusd-pink-400">0.00 USDC</span>
            </div>
          </div>
        </div>

        <ActionButton
          disabled={true}
          onAction={() => {}}
          label="No yield available"
          variant="primary"
          isLoading={false}
        />
      </div>
    );
  }

  return (
    <>
      <div className="p-6">
        {/* Explanatory Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Yield Funnel</h2>
          <p className="text-sm text-muted-foreground">
            Yield flows from multiple sources. Supply USDC to claim accumulated yield tokens at a discount.
          </p>
        </div>

        {/* Pending Yield Breakdown Panel */}
        <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-pxusd-orange-300 mb-3">Pending Yield</h3>

          <div className="space-y-2">
            {pendingYield.map((token: PendingYieldItem) => (
              <div key={token.strategyAddress} className="flex justify-between items-center text-sm">
                <span className="text-foreground">{token.symbol}</span>
                <span className="font-medium text-pxusd-yellow-400">{formatAmount(token.amountFormatted)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Discount and Pricing Section */}
        <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-foreground">Total Yield Value:</span>
              <span className="font-medium text-pxusd-yellow-400">${formatAmount(totalYieldFormatted)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-foreground">Discount:</span>
              <span className="font-medium text-pxusd-green-400">{discountPercent}%</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-foreground">Your Cost:</span>
              <span className="font-medium text-pxusd-pink-400">{formatAmount(claimAmountFormatted)} USDC</span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-pxusd-teal-600">
              <span className="text-foreground font-semibold">Your Profit:</span>
              <span className="font-bold text-pxusd-green-400">${formatAmount(profitFormatted)}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <ActionButton
          disabled={buttonDisabled}
          onAction={buttonAction}
          label={buttonLabel}
          variant={buttonVariant}
          isLoading={buttonLoading}
        />
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmation}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmSupply}
        title="Confirm Supply"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        isLoading={isTransacting}
      >
        <div className="space-y-4">
          {/* USDC Amount */}
          <div className="bg-pxusd-teal-700 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-2">You're supplying</div>
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium">{formatAmount(claimAmountFormatted)} USDC</span>
              <span className="text-sm text-muted-foreground">${formatAmount(claimAmountFormatted)}</span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" className="text-muted-foreground">
              <path
                fill="currentColor"
                d="M8 12L3 7h2.5V1h5v6H13z"
              />
            </svg>
          </div>

          {/* Tokens to Receive */}
          <div className="bg-pxusd-teal-700 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-2">You'll receive</div>
            <div className="space-y-2">
              {pendingYield.map((token: PendingYieldItem) => (
                <div key={token.strategyAddress} className="flex justify-between items-center">
                  <span className="font-medium">{formatAmount(token.amountFormatted)} {token.symbol}</span>
                  <span className="text-sm text-muted-foreground">${formatAmount(token.amountFormatted)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Profit Summary */}
          <div className="flex justify-between items-center pt-2 text-sm">
            <span className="text-muted-foreground">Estimated Profit</span>
            <span className="font-bold text-pxusd-green-400">${formatAmount(profitFormatted)}</span>
          </div>
        </div>
      </ConfirmationDialog>
    </>
  );
}
