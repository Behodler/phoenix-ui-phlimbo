import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { erc20Abi } from 'viem';
import { pauserAbi } from '../../lib/pauserAbi';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import { useTokenBalance, useTokenAllowance, useTokenApproval } from '../../hooks/useContractInteractions';
import { useToast } from '../ui/ToastProvider';
import { useApprovalTransaction } from '../../hooks/useTransaction';
import { getErrorTitle, shouldOfferRetry } from '../../utils/transactionErrors';
import ActionButton from '../ui/ActionButton';
import PauseConfirmationDialog from './PauseConfirmationDialog';

export default function SafetyTab() {
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Wagmi hooks for wallet connection
  const { isConnected, address: walletAddress } = useAccount();

  // Contract addresses context
  const { addresses, networkType } = useContractAddresses();

  // Toast notifications
  const { addToast } = useToast();

  // Token approval hook
  const { approve } = useTokenApproval();

  // Fetch EYE balance
  const {
    balance: eyeBalanceRaw,
    refetch: refetchEyeBalance
  } = useTokenBalance(
    walletAddress,
    addresses?.eyeToken as `0x${string}` | undefined
  );

  // Fetch EYE allowance for Pauser contract
  const {
    allowance: eyeAllowanceRaw,
    isLoading: eyeAllowanceLoading,
    refetch: refetchAllowance
  } = useTokenAllowance(
    walletAddress,
    addresses?.pauser as `0x${string}` | undefined,
    addresses?.eyeToken as `0x${string}` | undefined
  );

  // Fetch required EYE amount from Pauser contract
  const { data: eyeQuantityToPauseRaw } = useReadContract({
    address: addresses?.pauser as `0x${string}` | undefined,
    abi: pauserAbi,
    functionName: 'eyeQuantityToPause',
    query: {
      enabled: !!addresses?.pauser,
    },
  });

  // Pause transaction state
  const { data: pauseHash, writeContractAsync: writePause, isPending: isPausePending } = useWriteContract();
  const { isLoading: isPauseConfirming, isSuccess: isPauseSuccess } = useWaitForTransactionReceipt({
    hash: pauseHash,
    query: {
      enabled: !!pauseHash,
    },
  });

  // Convert required EYE amount (default to 1000 if not loaded)
  const requiredEyeAmount = eyeQuantityToPauseRaw
    ? parseFloat((Number(eyeQuantityToPauseRaw) / 1e18).toFixed(0))
    : 1000;

  const requiredEyeAmountWei = parseUnits(requiredEyeAmount.toString(), 18);

  // Convert EYE balance and allowance
  const eyeBalance = eyeBalanceRaw ? parseFloat((Number(eyeBalanceRaw) / 1e18).toFixed(4)) : 0;
  const eyeAllowance = eyeAllowanceRaw ? parseFloat((Number(eyeAllowanceRaw) / 1e18).toFixed(4)) : 0;

  // Check if approval is needed
  const needsApproval = eyeAllowanceRaw ? eyeAllowanceRaw < requiredEyeAmountWei : true;

  // EYE approval transaction state management
  const approvalTransaction = useApprovalTransaction(
    async () => {
      if (!addresses?.eyeToken || !addresses?.pauser) {
        throw new Error('Contract addresses not loaded');
      }
      // Approve exactly the required amount (not unlimited for security)
      return approve(
        addresses.eyeToken as `0x${string}`,
        addresses.pauser as `0x${string}`,
        requiredEyeAmountWei
      );
    },
    {
      onSuccess: async (hash) => {
        await refetchAllowance();

        addToast({
          type: 'success',
          title: 'Approval Successful',
          description: `${requiredEyeAmount} EYE spending has been approved for the Pauser contract.`,
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
        console.error('EYE approval failed:', error);
      },
      onStatusChange: (status) => {
        if (status === 'PENDING_SIGNATURE') {
          addToast({
            type: 'info',
            title: 'Confirm in Wallet',
            description: 'Please confirm the approval transaction in your wallet.',
            duration: 0,
          });
        } else if (status === 'PENDING_CONFIRMATION') {
          addToast({
            type: 'info',
            title: 'Transaction Submitted',
            description: 'Waiting for blockchain confirmation...',
            duration: 0,
          });
        }
      }
    }
  );

  // Handle approve button click
  const handleApprove = async (): Promise<void> => {
    if (!isConnected) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    if (!addresses?.eyeToken || !addresses?.pauser) {
      addToast({
        type: 'error',
        title: 'Contract Addresses Not Loaded',
        description: 'Please wait for contract addresses to load and try again.',
      });
      return;
    }

    try {
      await approvalTransaction.execute();
    } catch (error) {
      if (approvalTransaction.state.error) {
        const { error: txError } = approvalTransaction.state;
        addToast({
          type: 'error',
          title: getErrorTitle(txError.type),
          description: txError.message,
          duration: 8000,
          action: shouldOfferRetry(txError.type) ? {
            label: 'Retry',
            onClick: () => approvalTransaction.retry()
          } : undefined
        });
      }
    }
  };

  // Handle pause button click
  const handleInitiatePause = () => {
    // Check if user has sufficient EYE balance
    if (eyeBalance < requiredEyeAmount) {
      addToast({
        type: 'error',
        title: 'Insufficient EYE Balance',
        description: `You need ${requiredEyeAmount} EYE to pause the application. Current balance: ${eyeBalance.toFixed(4)} EYE`,
        duration: 8000,
      });
      return;
    }

    setShowConfirmation(true);
  };

  // Handle pause confirmation
  const handleConfirmPause = async () => {
    setShowConfirmation(false);

    if (!isConnected) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    if (!addresses?.pauser) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'Pauser contract address not loaded. Please try again.',
      });
      return;
    }

    try {
      // Show pending toast
      addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the pause transaction in your wallet.',
        duration: 0,
      });

      // Call pause function
      const hash = await writePause({
        address: addresses.pauser as `0x${string}`,
        abi: pauserAbi,
        functionName: 'pause',
      });

      // Show confirming toast
      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for blockchain confirmation...',
        duration: 0,
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
      console.error('Pause failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Pause Failed',
        description: errorMessage,
        duration: 8000,
      });
    }
  };

  // Handle pause success in useEffect to prevent infinite loop
  useEffect(() => {
    if (isPauseSuccess && pauseHash) {
      addToast({
        type: 'success',
        title: 'Application Paused',
        description: `Successfully paused the application. ${requiredEyeAmount} EYE has been burnt from your wallet.`,
        duration: 10000,
        action: {
          label: 'View Transaction',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${pauseHash}`
              : `https://sepolia.etherscan.io/tx/${pauseHash}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });

      // Refetch balances
      refetchEyeBalance();
      refetchAllowance();
    }
  }, [isPauseSuccess, pauseHash, addToast, requiredEyeAmount, networkType, refetchEyeBalance, refetchAllowance]); // Only run when dependencies change

  const handleCancelPause = () => {
    setShowConfirmation(false);
  };

  // Determine button state and properties
  const isTransacting = approvalTransaction.state.isPending ||
                       approvalTransaction.state.isConfirming ||
                       isPausePending ||
                       isPauseConfirming;

  let buttonLabel = "Connect Wallet";
  let buttonVariant: 'primary' | 'approve' = 'primary';
  let buttonAction = () => {};
  let buttonDisabled = true;
  let buttonLoading = false;

  if (isConnected) {
    if (eyeAllowanceLoading) {
      buttonLabel = "Loading...";
      buttonLoading = true;
      buttonDisabled = true;
    } else if (eyeBalance < requiredEyeAmount) {
      buttonLabel = `Insufficient EYE (need ${requiredEyeAmount})`;
      buttonDisabled = true;
    } else if (needsApproval) {
      buttonLabel = `Approve ${requiredEyeAmount} EYE`;
      buttonVariant = 'approve';
      buttonAction = handleApprove;
      buttonDisabled = false;
      buttonLoading = isTransacting;
    } else {
      buttonLabel = "Pause Application";
      buttonAction = handleInitiatePause;
      buttonDisabled = false;
      buttonLoading = isTransacting;
    }
  }

  return (
    <>
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Emergency Pause</h2>
          <p className="text-sm text-muted-foreground">
            Pause the entire application in case of suspected exploits or security vulnerabilities.
          </p>
        </div>

        <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-pxusd-orange-300 mb-3">Safety Information</h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-start">
              <span className="text-foreground">Your EYE Balance:</span>
              <span className="font-medium text-pxusd-yellow-400">{eyeBalance.toFixed(4)} EYE</span>
            </div>

            <div className="flex justify-between items-start">
              <span className="text-foreground">Required to Pause:</span>
              <span className="font-medium text-pxusd-pink-400">{requiredEyeAmount} EYE</span>
            </div>

            <div className="flex justify-between items-start">
              <span className="text-foreground">Current Allowance:</span>
              <span className="font-medium text-pxusd-green-400">{eyeAllowance.toFixed(4)} EYE</span>
            </div>
          </div>
        </div>

        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
          <p className="text-red-400 font-bold text-sm mb-2">⚠️ WARNING</p>
          <ul className="text-sm text-foreground space-y-1 list-disc list-inside">
            <li>This will pause ALL deposit and withdrawal operations</li>
            <li>{requiredEyeAmount} EYE will be permanently burnt from your wallet</li>
            <li>Only use in case of security emergencies</li>
            <li>The owner must unpause the application to restore functionality</li>
          </ul>
        </div>

        <ActionButton
          disabled={buttonDisabled}
          onAction={buttonAction}
          label={buttonLabel}
          variant={buttonVariant}
          isLoading={buttonLoading}
        />
      </div>

      <PauseConfirmationDialog
        isOpen={showConfirmation}
        onClose={handleCancelPause}
        onConfirm={handleConfirmPause}
        isLoading={isTransacting}
      />
    </>
  );
}
