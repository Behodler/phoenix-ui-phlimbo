import { useState, useEffect } from 'react';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { useToast } from '../ui/ToastProvider';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import { useTokenBalance } from '../../hooks/useContractInteractions';
import ActionButton from '../ui/ActionButton';

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

/**
 * TestnetFaucet Component
 *
 * Provides a faucet for minting DOLA tokens on testnet networks.
 * Hidden on mainnet (chainID 1), visible on all other networks (e.g., Sepolia chainID 11155111).
 */
export default function TestnetFaucet() {
  const [isMinting, setIsMinting] = useState(false);
  const { addToast, removeToast } = useToast();
  const { isConnected, address: walletAddress } = useAccount();
  const chainId = useChainId();
  const { addresses, networkType } = useContractAddresses();

  // Wagmi hooks for contract interaction
  const { data: hash, writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: {
      enabled: !!hash,
    },
  });

  // Fetch DOLA balance to enable refetch after mint
  const { refetch: refetchDolaBalance } = useTokenBalance(
    walletAddress,
    addresses?.dolaToken as `0x${string}` | undefined
  );

  /**
   * Handle mint button click
   * Mints 10,000 DOLA tokens to the connected wallet
   */
  const handleMint = async () => {
    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to use the faucet.',
      });
      return;
    }

    if (!addresses?.dolaToken) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'DOLA token contract address not loaded. Please try again.',
      });
      return;
    }

    setIsMinting(true);

    try {
      // Show pending toast
      const pendingToastId = addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the faucet transaction in your wallet.',
        duration: 0,
      });

      // Mint 10,000 DOLA tokens (with 18 decimals)
      const mintAmount = parseUnits('10000', 18);

      // Call the mint function on the DOLA token contract
      await writeContractAsync({
        address: addresses.dolaToken as `0x${string}`,
        abi: mintableErc20Abi,
        functionName: 'mint',
        args: [walletAddress, mintAmount],
      });

      // Remove pending toast
      removeToast(pendingToastId);

      // Show confirming toast - success will be handled by useEffect when transaction confirms
      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for blockchain confirmation...',
        duration: 0,
      });

    } catch (error) {
      console.error('Mint failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Faucet Failed',
        description: errorMessage,
        duration: 8000,
      });
      setIsMinting(false);
    }
  };

  // Handle mint transaction success
  // Following the pattern from phoenix:031 for automatic balance refresh
  useEffect(() => {
    if (isSuccess && hash) {
      // Show success toast
      addToast({
        type: 'success',
        title: 'Faucet Successful',
        description: 'Successfully minted 10,000 DOLA to your wallet!',
        duration: 8000,
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

      // Refetch DOLA balance to update UI immediately after mint
      // This ensures the balance reflects the newly minted tokens without manual refresh
      const refetchData = async () => {
        await refetchDolaBalance();
      };
      refetchData();

      // Reset minting state
      setIsMinting(false);
    }
  }, [isSuccess, hash, networkType, addToast, refetchDolaBalance]);

  return (
    <div className="p-6">
      {/* Faucet Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Testnet Faucet</h2>
        <p className="text-sm text-muted-foreground">
          Mint test DOLA tokens for testing on {networkType === 'local' ? 'Anvil' : 'Sepolia'}
        </p>
      </div>

      {/* Faucet Info Box */}
      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-foreground">Amount per mint:</span>
            <span className="text-lg font-bold text-pxusd-yellow-400">10,000 DOLA</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-foreground">Network:</span>
            <span className="text-sm font-medium text-pxusd-pink-400">
              {networkType === 'local' ? 'Local Anvil' : 'Sepolia Testnet'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-foreground">Your wallet:</span>
            <span className="text-xs font-mono text-accent">
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
            </span>
          </div>
        </div>
      </div>

      {/* Mint Button */}
      <ActionButton
        disabled={!isConnected || isMinting || isConfirming}
        onAction={handleMint}
        label={!isConnected ? "Connect Wallet" : "Mint 10 000 Dola"}
        variant="primary"
        isLoading={isMinting || isConfirming}
      />

      {/* Faucet Notice */}
      <div className="mt-6 p-4 bg-card border border-border rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> This faucet is only available on testnet networks.
          It provides test tokens for development and testing purposes.
        </p>
      </div>
    </div>
  );
}
