import { useState, useCallback, useEffect } from 'react';
import { useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { useToast } from '../ui/ToastProvider';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import SafetyTab from './SafetyTab';

// ABI for ERC20 tokens with mint function (used on testnets)
const mintableErc20Abi = [
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export default function EmergencyPauseFooter() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [isMinting, setIsMinting] = useState(false);

  const chainId = useChainId();
  const isTestnet = chainId !== 1;

  const { addToast, removeToast } = useToast();
  const { addresses, networkType } = useContractAddresses();

  // Wagmi hooks for mint transaction
  const { data: hash, writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: {
      enabled: !!hash,
    },
  });

  const handleOpenModal = useCallback(() => {
    // Increment resetKey to trigger checkbox reset in SafetyTab
    setResetKey((prev) => prev + 1);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  /**
   * Handle "Top up yield" button click
   * Mints 1,000 USDC (6 decimals) to the AutoUSDC contract address
   */
  const handleTopUpYield = async () => {
    if (!addresses?.USDC) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'USDC token contract address not loaded. Please try again.',
      });
      return;
    }

    if (!addresses?.AutoUSDC || addresses.AutoUSDC === ZERO_ADDRESS) {
      addToast({
        type: 'error',
        title: 'AutoUSDC Not Available',
        description: 'AutoUSDC contract address is not configured for this network.',
      });
      return;
    }

    setIsMinting(true);

    try {
      const pendingToastId = addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the yield top-up transaction in your wallet.',
        duration: 30000,
      });

      const mintAmount = parseUnits('1000', 6);

      await writeContractAsync({
        address: addresses.USDC as `0x${string}`,
        abi: mintableErc20Abi,
        functionName: 'mint',
        args: [addresses.AutoUSDC as `0x${string}`, mintAmount],
      });

      removeToast(pendingToastId);

      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for blockchain confirmation...',
        duration: 30000,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Top Up Failed',
        description: errorMessage,
        duration: 16000,
      });
      setIsMinting(false);
    }
  };

  // Handle mint transaction success
  useEffect(() => {
    if (isSuccess && hash) {
      addToast({
        type: 'success',
        title: 'Yield Top-Up Successful',
        description: 'Successfully minted 1,000 USDC to AutoUSDC!',
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
      setIsMinting(false);
    }
  }, [isSuccess, hash, networkType, addToast]);

  return (
    <>
      {/* Fixed footer at viewport bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-red-500/30">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-red-400 font-medium hidden sm:block">
            Emergency controls
          </span>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {isTestnet && (
              <button
                onClick={handleTopUpYield}
                disabled={isMinting || isConfirming || !addresses?.AutoUSDC || addresses.AutoUSDC === ZERO_ADDRESS}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
              >
                {isMinting || isConfirming ? 'Topping up...' : 'Top up yield'}
              </button>
            )}
            <button
              onClick={handleOpenModal}
              className="w-full sm:w-auto px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              Emergency Pause
            </button>
          </div>
        </div>
      </div>

      {/* Modal overlay with SafetyTab content */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Emergency Pause</h3>
              <button
                onClick={handleCloseModal}
                className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>
            <SafetyTab resetKey={resetKey} />
          </div>
        </div>
      )}
    </>
  );
}
