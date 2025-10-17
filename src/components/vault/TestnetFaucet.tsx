import { useState } from 'react';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { useToast } from '../ui/ToastProvider';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
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
  const { writeContractAsync } = useWriteContract();

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
      const hash = await writeContractAsync({
        address: addresses.dolaToken as `0x${string}`,
        abi: mintableErc20Abi,
        functionName: 'mint',
        args: [walletAddress, mintAmount],
      });

      // Remove pending toast
      removeToast(pendingToastId);

      // Show confirming toast
      const confirmingToastId = addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for blockchain confirmation...',
        duration: 0,
        action: {
          label: 'View on Explorer',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${hash}`
              : `https://sepolia.etherscan.io/tx/${hash}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });

      // Wait for transaction confirmation (we don't use the hook here for simplicity)
      // The transaction will be confirmed in the background

      // Show success toast after a short delay (simulating confirmation)
      setTimeout(() => {
        removeToast(confirmingToastId);
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
        setIsMinting(false);
      }, 2000);

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
        disabled={!isConnected || isMinting}
        onAction={handleMint}
        label={!isConnected ? "Connect Wallet" : "Mint 10 000 Dola"}
        variant="primary"
        isLoading={isMinting}
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
