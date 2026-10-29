import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { stableYieldAccumulatorAbi } from '@behodler/phase2-wagmi-hooks';
import { useToast } from '../ui/ToastProvider';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import { useTokenBalance } from '../../hooks/useContractInteractions';
import ActionButton from '../ui/ActionButton';
import { log } from '../../utils/logger';

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

// `addYield(amount)` on the mock ERC4626 vaults (MockSDOLA, MockSUSDe, and MockAutoDOLA reused as
// autoUSDC). Permissionless: it mints `amount` of the underlying straight into the vault, raising the
// share price, which is the surplus SYA sells as pending yield.
const mockVaultAddYieldAbi = [
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'addYield',
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

/**
 * The vaults behind SYA's three strategies, and the yield each "Add Test Yield" click donates (the
 * amounts the Sepolia deploy seeds). SYA only sees its strategy's share of each vault's surplus.
 */
const SYA_YIELD_VAULTS = [
  { key: 'SDOLA', symbol: 'DOLA', amount: parseUnits('1000', 18) },
  { key: 'SUSDe', symbol: 'USDe', amount: parseUnits('1000', 18) },
  { key: 'AutoUSDC', symbol: 'USDC', amount: parseUnits('1000', 6) },
] as const;

/**
 * TestnetFaucet Component
 *
 * Provides a faucet for minting DOLA tokens on testnet networks.
 * Hidden on mainnet (chainID 1), visible on all other networks (e.g., Sepolia chainID 11155111).
 */
export default function TestnetFaucet() {
  const [isMinting, setIsMinting] = useState(false);
  const [isMintingEye, setIsMintingEye] = useState(false);
  const [isMintingUsdc, setIsMintingUsdc] = useState(false);
  const [isAddingYield, setIsAddingYield] = useState(false);
  const { addToast, removeToast } = useToast();
  const { isConnected, address: walletAddress } = useAccount();
  const { addresses, networkType } = useContractAddresses();

  // Wagmi hooks for contract interaction - DOLA
  const { data: hash, writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: {
      enabled: !!hash,
    },
  });

  // Wagmi hooks for contract interaction - EYE
  const { data: hashEye, writeContractAsync: writeContractAsyncEye } = useWriteContract();
  const { isLoading: isConfirmingEye, isSuccess: isSuccessEye } = useWaitForTransactionReceipt({
    hash: hashEye,
    query: {
      enabled: !!hashEye,
    },
  });

  // Wagmi hooks for contract interaction - USDC
  const { data: hashUsdc, writeContractAsync: writeContractAsyncUsdc } = useWriteContract();
  const { isLoading: isConfirmingUsdc, isSuccess: isSuccessUsdc } = useWaitForTransactionReceipt({
    hash: hashUsdc,
    query: {
      enabled: !!hashUsdc,
    },
  });

  // Add-yield writes are sequential, each awaited before the next, so they need their own client
  const { writeContractAsync: writeContractAsyncYield } = useWriteContract();
  const publicClient = usePublicClient();

  // SYA's current claim amount (USDC, 6dp) with no exemptions, shown beside the add-yield button
  const syaAddress = addresses?.StableYieldAccumulator as `0x${string}` | undefined;
  const { data: syaClaimAmount, refetch: refetchSyaClaimAmount } = useReadContract({
    address: syaAddress,
    abi: stableYieldAccumulatorAbi,
    functionName: 'calculateClaimAmount',
    args: [[]],
    query: {
      enabled: !!syaAddress,
    },
  });

  // Fetch DOLA balance to enable refetch after mint
  const { refetch: refetchDolaBalance } = useTokenBalance(
    walletAddress,
    addresses?.Dola as `0x${string}` | undefined
  );

  // Fetch EYE balance to enable refetch after mint
  const { refetch: refetchEyeBalance } = useTokenBalance(
    walletAddress,
    addresses?.EYE as `0x${string}` | undefined
  );

  // Fetch USDC balance to enable refetch after mint
  const { refetch: refetchUsdcBalance } = useTokenBalance(
    walletAddress,
    addresses?.USDC as `0x${string}` | undefined
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

    if (!addresses?.Dola) {
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
        duration: 30000,
      });

      // Mint 10,000 DOLA tokens (with 18 decimals)
      const mintAmount = parseUnits('10000', 18);

      // Call the mint function on the DOLA token contract
      await writeContractAsync({
        address: addresses.Dola as `0x${string}`,
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
        duration: 30000,
      });

    } catch (error) {
      log.error('Mint failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Faucet Failed',
        description: errorMessage,
        duration: 16000,
      });
      setIsMinting(false);
    }
  };

  /**
   * Handle EYE mint button click
   * Mints 1,000 EYE tokens to the connected wallet
   */
  const handleMintEye = async () => {
    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to use the faucet.',
      });
      return;
    }

    if (!addresses?.EYE) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'EYE token contract address not loaded. Please try again.',
      });
      return;
    }

    setIsMintingEye(true);

    try {
      // Show pending toast
      const pendingToastId = addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the faucet transaction in your wallet.',
        duration: 30000,
      });

      // Mint 1,000 EYE tokens (with 18 decimals)
      const mintAmount = parseUnits('1000', 18);

      // Call the mint function on the EYE token contract
      await writeContractAsyncEye({
        address: addresses.EYE as `0x${string}`,
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
        duration: 30000,
      });

    } catch (error) {
      log.error('Mint EYE failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Faucet Failed',
        description: errorMessage,
        duration: 16000,
      });
      setIsMintingEye(false);
    }
  };

  /**
   * Handle USDC mint button click
   * Mints 10,000 USDC tokens to the connected wallet
   */
  const handleMintUsdc = async () => {
    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to use the faucet.',
      });
      return;
    }

    if (!addresses?.USDC) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'USDC token contract address not loaded. Please try again.',
      });
      return;
    }

    setIsMintingUsdc(true);

    try {
      const pendingToastId = addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the faucet transaction in your wallet.',
        duration: 30000,
      });

      // Mint 10,000 USDC tokens (with 6 decimals)
      const mintAmount = parseUnits('10000', 6);

      await writeContractAsyncUsdc({
        address: addresses.USDC as `0x${string}`,
        abi: mintableErc20Abi,
        functionName: 'mint',
        args: [walletAddress, mintAmount],
      });

      removeToast(pendingToastId);

      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for blockchain confirmation...',
        duration: 30000,
      });

    } catch (error) {
      log.error('Mint USDC failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Faucet Failed',
        description: errorMessage,
        duration: 16000,
      });
      setIsMintingUsdc(false);
    }
  };

  /**
   * Handle add-yield button click
   * Calls addYield on the sDOLA, sUSDe and autoUSDC mock vaults, one confirmed transaction at a time,
   * so StableYieldAccumulator has pending DOLA, USDe and USDC yield to sell again
   */
  const handleAddYield = async () => {
    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to use the faucet.',
      });
      return;
    }

    const vaults = SYA_YIELD_VAULTS.map((v) => ({ ...v, address: addresses?.[v.key] as `0x${string}` | undefined }));
    if (!publicClient || vaults.some((v) => !v.address)) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'Yield vault addresses not loaded. Please try again.',
      });
      return;
    }

    setIsAddingYield(true);
    try {
      for (const [i, vault] of vaults.entries()) {
        const pendingToastId = addToast({
          type: 'info',
          title: `Confirm Transaction (${i + 1}/${vaults.length})`,
          description: `Please confirm adding 1,000 ${vault.symbol} of yield in your wallet.`,
          duration: 30000,
        });
        const txHash = await writeContractAsyncYield({
          address: vault.address as `0x${string}`,
          abi: mockVaultAddYieldAbi,
          functionName: 'addYield',
          args: [vault.amount],
        }).finally(() => removeToast(pendingToastId));
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

      addToast({
        type: 'success',
        title: 'Yield Added',
        description: 'Added 1,000 DOLA, USDe and USDC of yield to the SYA strategy vaults.',
        duration: 30000,
      });
      await refetchSyaClaimAmount();
    } catch (error) {
      log.error('Add yield failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Add Yield Failed',
        description: errorMessage,
        duration: 16000,
      });
    } finally {
      setIsAddingYield(false);
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

  // Handle EYE mint transaction success
  // Following the same pattern for automatic balance refresh
  useEffect(() => {
    if (isSuccessEye && hashEye) {
      // Show success toast
      addToast({
        type: 'success',
        title: 'Faucet Successful',
        description: 'Successfully minted 1,000 EYE to your wallet!',
        duration: 30000,
        action: {
          label: 'View Transaction',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${hashEye}`
              : `https://sepolia.etherscan.io/tx/${hashEye}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });

      // Refetch EYE balance to update UI immediately after mint
      // This ensures the balance reflects the newly minted tokens without manual refresh
      const refetchData = async () => {
        await refetchEyeBalance();
      };
      refetchData();

      // Reset minting state
      setIsMintingEye(false);
    }
  }, [isSuccessEye, hashEye, networkType, addToast, refetchEyeBalance]);

  // Handle USDC mint transaction success
  useEffect(() => {
    if (isSuccessUsdc && hashUsdc) {
      addToast({
        type: 'success',
        title: 'Faucet Successful',
        description: 'Successfully minted 10,000 USDC to your wallet!',
        duration: 30000,
        action: {
          label: 'View Transaction',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${hashUsdc}`
              : `https://sepolia.etherscan.io/tx/${hashUsdc}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });

      const refetchData = async () => {
        await refetchUsdcBalance();
      };
      refetchData();

      setIsMintingUsdc(false);
    }
  }, [isSuccessUsdc, hashUsdc, networkType, addToast, refetchUsdcBalance]);

  return (
    <div className="p-6">
      {/* Faucet Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Testnet Faucet</h2>
        <p className="text-sm text-muted-foreground">
          Mint test DOLA and EYE tokens for testing on {networkType === 'local' ? 'Anvil' : 'Sepolia'}
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

      {/* Mint Buttons */}
      <div className="space-y-4">
        <ActionButton
          disabled={!isConnected || isMinting || isConfirming}
          onAction={handleMint}
          label={!isConnected ? "Connect Wallet" : "Mint 10 000 Dola"}
          variant="primary"
          isLoading={isMinting || isConfirming}
        />

        <ActionButton
          disabled={!isConnected || isMintingEye || isConfirmingEye}
          onAction={handleMintEye}
          label={!isConnected ? "Connect Wallet" : "Mint 1000 EYE"}
          variant="primary"
          isLoading={isMintingEye || isConfirmingEye}
        />

        <ActionButton
          disabled={!isConnected || isMintingUsdc || isConfirmingUsdc}
          onAction={handleMintUsdc}
          label={!isConnected ? "Connect Wallet" : "Mint 10000 USDC"}
          variant="primary"
          isLoading={isMintingUsdc || isConfirmingUsdc}
        />

        <ActionButton
          disabled={!isConnected || isAddingYield}
          onAction={handleAddYield}
          label={!isConnected ? "Connect Wallet" : "Add Test Yield (1000 DOLA / USDe / USDC)"}
          variant="primary"
          isLoading={isAddingYield}
        />
        <p className="text-xs text-muted-foreground text-center">
          Donates yield to the sDOLA, sUSDe and autoUSDC vaults behind the StableYieldAccumulator
          strategies (3 transactions). SYA pending claim:{' '}
          <span className="font-mono text-accent">
            {syaClaimAmount !== undefined ? `${Number(formatUnits(syaClaimAmount, 6)).toLocaleString()} USDC` : '…'}
          </span>
        </p>
      </div>

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
