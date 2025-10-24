import { useState, useEffect } from 'react';
import { useAccount, useChainId, useReadContract, useWriteContract } from 'wagmi';
import {
  behodler3TokenlaunchAbi,
  mockAutoDolaAbi,
  mockBondingTokenAbi,
  iBondingTokenAbi,
} from '@behodler/wagmi-hooks';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import { useToast } from '../ui/ToastProvider';
import ActionButton from '../ui/ActionButton';
import type { Abi, AbiFunction } from 'viem';

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
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

/**
 * Contract configuration type
 */
interface ContractConfig {
  name: string;
  addressKey: keyof typeof import('../../types/contracts').ContractAddresses;
  abi: Abi;
}

/**
 * Contract configurations for admin panel
 * Only includes contracts that might be ownable
 */
const getContractConfigs = (networkType: string): ContractConfig[] => [
  {
    name: 'Bonding Curve',
    addressKey: 'bondingCurve',
    abi: behodler3TokenlaunchAbi as Abi,
  },
  {
    name: 'Bonding Token',
    addressKey: 'bondingToken',
    abi: (networkType === 'mainnet' ? iBondingTokenAbi : mockBondingTokenAbi) as Abi,
  },
  {
    name: 'AutoDolaYieldStrategy',
    addressKey: 'autoDolaYieldStrategy',
    abi: mockAutoDolaAbi as Abi,
  },
];

/**
 * Extract all functions from ABI
 * Note: ABIs only contain external/public functions by definition
 */
const extractFunctionsFromAbi = (abi: Abi): string[] => {
  const functions = abi.filter(
    (item): item is AbiFunction => item.type === 'function'
  );

  return functions.map((func) => func.name);
};

/**
 * Admin Component
 *
 * Provides administrative controls for the bonding curve contract owner.
 * This component is only rendered when the connected wallet address matches
 * the owner address of the bonding curve contract.
 */
export default function Admin() {
  const { isConnected, address: walletAddress } = useAccount();
  const { addresses, networkType } = useContractAddresses();
  const chainId = useChainId();
  const { addToast, removeToast } = useToast();
  const [isMinting, setIsMinting] = useState(false);

  // State for contract and function selection
  const [selectedContractKey, setSelectedContractKey] = useState<string>('');
  const [ownedContracts, setOwnedContracts] = useState<ContractConfig[]>([]);
  const [isLoadingOwnership, setIsLoadingOwnership] = useState(false);
  const [availableFunctions, setAvailableFunctions] = useState<string[]>([]);

  // Fetch the owner address from the bonding curve contract
  const { data: ownerAddress } = useReadContract({
    address: addresses?.bondingCurve as `0x${string}` | undefined,
    abi: behodler3TokenlaunchAbi,
    functionName: 'owner',
    query: {
      enabled: !!addresses?.bondingCurve,
    },
  });

  // Fetch DOLA balance from AutoDolaVault
  const { data: vaultDolaBalance, refetch: refetchVaultBalance } = useReadContract({
    address: addresses?.dolaToken as `0x${string}` | undefined,
    abi: mintableErc20Abi,
    functionName: 'balanceOf',
    args: addresses?.autoDolaVault ? [addresses.autoDolaVault as `0x${string}`] : undefined,
    query: {
      enabled: !!addresses?.dolaToken && !!addresses?.autoDolaVault,
    },
  });

  // Wagmi hook for contract write
  const { writeContractAsync } = useWriteContract();

  // Check if we should show mint yield button (hide on mainnet, chainID 1)
  const isMainnet = chainId === 1;
  const showMintYieldButton = !isMainnet;

  /**
   * Discover owned contracts by checking ownership of each contract
   */
  useEffect(() => {
    const discoverOwnedContracts = async () => {
      if (!isConnected || !walletAddress || !addresses) {
        console.log('🔍 Contract discovery skipped:', {
          isConnected,
          hasWallet: !!walletAddress,
          hasAddresses: !!addresses,
        });
        setOwnedContracts([]);
        return;
      }

      console.log('🔍 Starting contract ownership discovery...');
      console.log('📋 Available addresses:', addresses);
      console.log('👛 Connected wallet:', walletAddress);

      setIsLoadingOwnership(true);

      try {
        const contractConfigs = getContractConfigs(networkType);
        console.log('📝 Contract configs to check:', contractConfigs.map(c => ({ name: c.name, key: c.addressKey })));

        const ownedConfigsPromises = contractConfigs.map(async (config) => {
          try {
            const contractAddress = addresses[config.addressKey];

            console.log(`🔎 Checking ${config.name}:`, {
              addressKey: config.addressKey,
              contractAddress,
              hasAddress: !!contractAddress,
            });

            if (!contractAddress) {
              console.warn(`⚠️ ${config.name}: No address found for key "${config.addressKey}"`);
              return null;
            }

            console.log(`🌐 ${config.name}: Calling owner() at ${contractAddress}...`);

            // Try to read the owner() function
            const response = await fetch(
              `http://localhost:8545`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'eth_call',
                  params: [
                    {
                      to: contractAddress,
                      data: '0x8da5cb5b', // keccak256("owner()") selector
                    },
                    'latest',
                  ],
                  id: 1,
                }),
              }
            );

            const data = await response.json();

            console.log(`📡 ${config.name}: RPC response:`, {
              result: data.result,
              error: data.error,
            });

            if (data.result && data.result !== '0x') {
              // Parse the owner address from the result
              const ownerAddress = '0x' + data.result.slice(-40);

              console.log(`👤 ${config.name}: Owner check:`, {
                contractOwner: ownerAddress,
                walletAddress,
                matches: ownerAddress.toLowerCase() === walletAddress.toLowerCase(),
              });

              // Compare addresses (case-insensitive)
              if (ownerAddress.toLowerCase() === walletAddress.toLowerCase()) {
                console.log(`✅ ${config.name}: Owned by connected wallet!`);
                return config;
              } else {
                console.log(`❌ ${config.name}: Not owned by connected wallet`);
              }
            } else {
              console.warn(`⚠️ ${config.name}: No owner() result or empty response`);
            }

            return null;
          } catch (error) {
            console.error(`❌ Error checking ownership for ${config.name}:`, error);
            return null;
          }
        });

        const ownedConfigs = (await Promise.all(ownedConfigsPromises)).filter(
          (config): config is ContractConfig => config !== null
        );

        console.log('✨ Ownership discovery complete:', {
          totalChecked: contractConfigs.length,
          ownedCount: ownedConfigs.length,
          ownedContracts: ownedConfigs.map(c => c.name),
        });

        setOwnedContracts(ownedConfigs);
      } catch (error) {
        console.error('💥 Error discovering owned contracts:', error);
        addToast({
          type: 'error',
          title: 'Contract Discovery Failed',
          description: 'Unable to check contract ownership. Please try again.',
        });
      } finally {
        setIsLoadingOwnership(false);
      }
    };

    discoverOwnedContracts();
  }, [isConnected, walletAddress, addresses, addToast]);

  /**
   * Extract functions when a contract is selected
   */
  useEffect(() => {
    if (!selectedContractKey) {
      setAvailableFunctions([]);
      return;
    }

    const selectedContract = ownedContracts.find(
      (contract) => contract.addressKey === selectedContractKey
    );

    if (selectedContract) {
      const functions = extractFunctionsFromAbi(selectedContract.abi);
      setAvailableFunctions(functions);
    } else {
      setAvailableFunctions([]);
    }
  }, [selectedContractKey, ownedContracts]);

  /**
   * Reset selections when wallet changes or disconnects
   */
  useEffect(() => {
    if (!isConnected) {
      setSelectedContractKey('');
      setOwnedContracts([]);
      setAvailableFunctions([]);
    }
  }, [isConnected]);

  /**
   * Handle mint yield button click
   * Mints 1% of current AutoDolaVault DOLA balance to the vault
   */
  const handleMintYield = async () => {
    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to mint yield.',
      });
      return;
    }

    if (!addresses?.dolaToken || !addresses?.autoDolaVault) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'Contract addresses not loaded. Please try again.',
      });
      return;
    }

    if (!vaultDolaBalance || vaultDolaBalance === 0n) {
      addToast({
        type: 'error',
        title: 'No Balance to Mint',
        description: 'AutoDolaVault has no DOLA balance. Cannot mint yield.',
      });
      return;
    }

    setIsMinting(true);

    try {
      // Calculate 1% of current vault DOLA balance
      const mintAmount = vaultDolaBalance / 100n;

      // Show pending toast
      const pendingToastId = addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the mint yield transaction in your wallet.',
        duration: 0,
      });

      // Call the mint function on the DOLA token contract, minting to AutoDolaVault
      const hash = await writeContractAsync({
        address: addresses.dolaToken as `0x${string}`,
        abi: mintableErc20Abi,
        functionName: 'mint',
        args: [addresses.autoDolaVault as `0x${string}`, mintAmount],
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
              : networkType === 'local'
              ? `http://localhost:8545` // Anvil doesn't have a block explorer
              : `https://sepolia.etherscan.io/tx/${hash}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });

      // Wait for confirmation (simplified - just using setTimeout)
      setTimeout(async () => {
        removeToast(confirmingToastId);

        // Refetch vault balance to show updated amount
        await refetchVaultBalance();

        addToast({
          type: 'success',
          title: 'Yield Minted Successfully',
          description: `Successfully minted 1% of vault balance (${(Number(mintAmount) / 1e18).toFixed(2)} DOLA) to AutoDolaVault!`,
          duration: 8000,
          action: {
            label: 'View Transaction',
            onClick: () => {
              const explorerUrl = networkType === 'mainnet'
                ? `https://etherscan.io/tx/${hash}`
                : networkType === 'local'
                ? `http://localhost:8545`
                : `https://sepolia.etherscan.io/tx/${hash}`;
              window.open(explorerUrl, '_blank');
            }
          }
        });
        setIsMinting(false);
      }, 2000);

    } catch (error) {
      console.error('Mint yield failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Mint Yield Failed',
        description: errorMessage,
        duration: 8000,
      });
      setIsMinting(false);
    }
  };

  return (
    <div className="p-6">
      {/* Admin Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Admin Controls</h2>
        <p className="text-sm text-muted-foreground">
          Administrative functions for bonding curve contract owner
        </p>
      </div>

      {/* Owner Info Box */}
      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-foreground">Contract Owner:</span>
            <span className="text-xs font-mono text-accent">
              {ownerAddress ? `${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}` : 'Loading...'}
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

      {/* Mint Yield Button - Hidden on mainnet (chainID 1) */}
      {showMintYieldButton && (
        <div className="mb-6">
          <ActionButton
            disabled={!isConnected || isMinting}
            onAction={handleMintYield}
            label={!isConnected ? "Connect Wallet" : "Mint Yield (1% of Vault Balance)"}
            variant="primary"
            isLoading={isMinting}
          />
          {vaultDolaBalance !== undefined && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Current vault DOLA balance: {(Number(vaultDolaBalance) / 1e18).toFixed(2)} DOLA
              {vaultDolaBalance > 0n && ` → Will mint ${(Number(vaultDolaBalance / 100n) / 1e18).toFixed(2)} DOLA`}
            </p>
          )}
        </div>
      )}

      {/* Contract and Function Dropdowns */}
      <div className="flex gap-4 mb-6">
        {/* Contracts Dropdown */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-2">
            Contracts {isLoadingOwnership && <span className="text-xs text-muted-foreground">(Loading...)</span>}
          </label>
          <select
            className="w-full px-4 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isConnected || isLoadingOwnership || ownedContracts.length === 0}
            value={selectedContractKey}
            onChange={(e) => setSelectedContractKey(e.target.value)}
          >
            <option value="">
              {!isConnected
                ? 'Connect wallet to view contracts'
                : isLoadingOwnership
                ? 'Checking ownership...'
                : ownedContracts.length === 0
                ? 'No owned contracts found'
                : 'Select Contract...'}
            </option>
            {ownedContracts.map((contract) => (
              <option key={contract.addressKey} value={contract.addressKey}>
                {contract.name}
              </option>
            ))}
          </select>
          {ownedContracts.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {ownedContracts.length} owned contract{ownedContracts.length > 1 ? 's' : ''} found
            </p>
          )}
        </div>

        {/* Functions Dropdown */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-2">
            Functions
          </label>
          <select
            className="w-full px-4 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!selectedContractKey || availableFunctions.length === 0}
          >
            <option value="">
              {!selectedContractKey
                ? 'Select a contract first'
                : availableFunctions.length === 0
                ? 'No functions available'
                : 'Select Function...'}
            </option>
            {availableFunctions.map((funcName, index) => (
              <option key={`${funcName}-${index}`} value={funcName}>
                {funcName}
              </option>
            ))}
          </select>
          {availableFunctions.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {availableFunctions.length} function{availableFunctions.length > 1 ? 's' : ''} available
            </p>
          )}
        </div>
      </div>

      {/* Admin Notice */}
      <div className="mt-6 p-4 bg-card border border-border rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> This tab is only visible to the bonding curve contract owner.
          {showMintYieldButton && (
            <span className="block mt-2">
              <strong>Mint Yield:</strong> This testnet-only feature simulates yield generation by minting DOLA tokens directly into the AutoDolaVault. This button is hidden on mainnet.
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
          <strong>Dynamic ABI Loading:</strong> ABIs are statically imported from <code className="px-1 py-0.5 bg-background rounded">@behodler/wagmi-hooks</code>.
          To update contract ABIs, reinstall the wagmi-hooks package or rebuild it from source.
          Changes to ABIs in the deployment contracts will NOT be reflected automatically - the package must be updated first.
          Check browser console (F12) for detailed contract discovery logs.
        </p>
      </div>
    </div>
  );
}
