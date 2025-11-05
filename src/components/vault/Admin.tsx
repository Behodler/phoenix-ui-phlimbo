import { useState, useEffect } from 'react';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '../../wagmiConfig';
import {
  behodler3TokenlaunchAbi,
  flaxTokenAbi,
  autoDolaYieldStrategyAbi,
} from '@behodler/wagmi-hooks';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import { useToast } from '../ui/ToastProvider';
import ActionButton from '../ui/ActionButton';
import type { Abi, AbiFunction } from 'viem';
import type { ContractAddresses } from '../../types/contracts';

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
  addressKey: keyof ContractAddresses;
  abi: Abi;
}

/**
 * Contract configurations for admin panel
 * Only includes contracts that might be ownable
 */
const getContractConfigs = (_networkType: string): ContractConfig[] => [
  {
    name: 'Bonding Curve',
    addressKey: 'bondingCurve',
    abi: behodler3TokenlaunchAbi as Abi,
  },
  {
    name: 'Bonding Token',
    addressKey: 'bondingToken',
    abi:   flaxTokenAbi as Abi,
  },
  {
    name: 'AutoDolaYieldStrategy',
    addressKey: 'autoDolaYieldStrategy',
    abi: autoDolaYieldStrategyAbi as Abi,
  },
];

/**
 * Expands exponential notation into a plain integer string
 * e.g. "1e20" -> "100000000000000000000"
 * Rejects any negative exponents or decimals
 */
function expandExpInt(input: string): string {
  const s = String(input).trim();
  const m = /^([+-]?)(\d+)(?:[eE]([+-]?\d+))?$/.exec(s);
  if (!m) throw new Error("Invalid integer format");

  const sign = m[1] === "-" ? "-" : "";
  const base = m[2];
  const exp = m[3] !== undefined ? parseInt(m[3], 10) : 0;

  if (exp < 0) throw new Error("Negative exponents not allowed (Ethereum uses integers only)");

  // Append exp number of zeros
  const result = base + "0".repeat(exp);

  // Strip leading zeros except one
  return sign + result.replace(/^(-?)0+(?=\d)/, "$1");
}

/**
 * Check if a Solidity type is numeric (uint/int variants)
 */
function isNumericType(solidityType: string): boolean {
  // Match uint/int with any bit size or no bit size specified
  return /^(u?int\d*)$/.test(solidityType);
}

/**
 * Check if a Solidity type is boolean
 */
function isBooleanType(solidityType: string): boolean {
  return solidityType === 'bool';
}

/**
 * Convert string value to boolean
 * Only "true" (case-insensitive) returns true, everything else returns false
 */
function convertBooleanParameter(value: string): boolean {
  const result = !!value && `${value}`.toLowerCase() === 'true';
  console.log('[Boolean Debug] Converting:', { input: value, output: result });
  return result;
}

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
  const [selectedFunctionName, setSelectedFunctionName] = useState<string>('');
  const [selectedFunction, setSelectedFunction] = useState<AbiFunction | null>(null);

  // State for parameter inputs and validation
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [conversionErrors, setConversionErrors] = useState<Record<string, string>>({});

  // State for transaction management
  const [isCalling, setIsCalling] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Fetch the owner address from the bonding curve contract
  const { data: ownerAddress } = useReadContract({
    address: addresses?.bondingCurve as `0x${string}` | undefined,
    abi: behodler3TokenlaunchAbi,
    functionName: 'owner',
    query: {
      enabled: !!addresses?.bondingCurve,
    },
  });

  // Fetch principal from AutoDolaYieldStrategy (principal deposited via bonding curve)
  const { data: bondingCurvePrincipal, refetch: refetchPrincipal } = useReadContract({
    address: addresses?.autoDolaYieldStrategy as `0x${string}` | undefined,
    abi: autoDolaYieldStrategyAbi,
    functionName: 'principalOf',
    args: addresses?.dolaToken && addresses?.bondingCurve
      ? [addresses.dolaToken as `0x${string}`, addresses.bondingCurve as `0x${string}`]
      : undefined,
    query: {
      enabled: !!addresses?.autoDolaYieldStrategy && !!addresses?.dolaToken && !!addresses?.bondingCurve,
    },
  });

  // Fetch total balance from AutoDolaYieldStrategy (principal + yield)
  // Uses totalBalanceOf per IYieldStrategy interface specification
  const { data: vaultDolaBalance, refetch: refetchVaultBalance } = useReadContract({
    address: addresses?.autoDolaYieldStrategy as `0x${string}` | undefined,
    abi: autoDolaYieldStrategyAbi,
    functionName: 'totalBalanceOf',
    args: addresses?.dolaToken && addresses?.bondingCurve
      ? [addresses.dolaToken as `0x${string}`, addresses.bondingCurve as `0x${string}`]
      : undefined,
    query: {
      enabled: !!addresses?.autoDolaYieldStrategy && !!addresses?.dolaToken && !!addresses?.bondingCurve,
    },
  });

  // Wagmi hooks for contract write and transaction tracking
  const { data: txHash, writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: !!txHash,
    },
  });

  // Check if we should show mint yield button (hide on mainnet, chainID 1)
  const isMainnet = chainId === 1;
  const showMintYieldButton = !isMainnet;

  // Calculate yield vs principal breakdown
  // Per IYieldStrategy interface: yield = totalBalanceOf - principalOf
  const principal = bondingCurvePrincipal !== undefined ? bondingCurvePrincipal : 0n;
  const totalVaultBalance = vaultDolaBalance !== undefined ? vaultDolaBalance : 0n;
  const yield_ = totalVaultBalance > principal ? totalVaultBalance - principal : 0n;

  // Format for display (convert from wei to DOLA)
  const principalDisplay = (Number(principal) / 1e18).toFixed(2);
  const yieldDisplay = (Number(yield_) / 1e18).toFixed(2);
  const totalDisplay = (Number(totalVaultBalance) / 1e18).toFixed(2);

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

            // Try to read the owner() function using wagmi's readContract
            try {
              const ownerAddress = await readContract(wagmiConfig, {
                address: contractAddress as `0x${string}`,
                abi: config.abi,
                functionName: 'owner',
              });

              console.log(`📡 ${config.name}: Successfully read owner address:`, ownerAddress);

              console.log(`👤 ${config.name}: Owner check:`, {
                contractOwner: ownerAddress,
                walletAddress,
                matches: (ownerAddress as string).toLowerCase() === walletAddress.toLowerCase(),
              });

              // Compare addresses (case-insensitive)
              if ((ownerAddress as string).toLowerCase() === walletAddress.toLowerCase()) {
                console.log(`✅ ${config.name}: Owned by connected wallet!`);
                return config;
              } else {
                console.log(`❌ ${config.name}: Not owned by connected wallet`);
              }
            } catch (ownerError) {
              console.warn(`⚠️ ${config.name}: Failed to read owner() function:`, ownerError);
              // Contract might not have an owner() function, skip it
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
   * Extract function details when a function is selected
   */
  useEffect(() => {
    if (!selectedFunctionName || !selectedContractKey) {
      setSelectedFunction(null);
      setParameterValues({});
      setValidationErrors({});
      return;
    }

    const selectedContract = ownedContracts.find(
      (contract) => contract.addressKey === selectedContractKey
    );

    if (selectedContract) {
      const functionAbi = selectedContract.abi.find(
        (item): item is AbiFunction =>
          item.type === 'function' && item.name === selectedFunctionName
      );

      if (functionAbi) {
        setSelectedFunction(functionAbi);
        // Initialize parameter values and validation state
        const initialValues: Record<string, string> = {};
        const initialErrors: Record<string, boolean> = {};

        functionAbi.inputs.forEach((input, index) => {
          const key = input.name || `param${index}`;
          initialValues[key] = '';
          initialErrors[key] = false;
        });

        setParameterValues(initialValues);
        setValidationErrors(initialErrors);
        setConversionErrors({});
      } else {
        setSelectedFunction(null);
        setParameterValues({});
        setValidationErrors({});
        setConversionErrors({});
      }
    }
  }, [selectedFunctionName, selectedContractKey, ownedContracts]);

  /**
   * Reset selections when wallet changes or disconnects
   */
  useEffect(() => {
    if (!isConnected) {
      setSelectedContractKey('');
      setOwnedContracts([]);
      setAvailableFunctions([]);
      setSelectedFunctionName('');
      setSelectedFunction(null);
      setParameterValues({});
      setValidationErrors({});
      setConversionErrors({});
    }
  }, [isConnected]);

  /**
   * Handle transaction success for Execute button
   */
  useEffect(() => {
    if (isTxSuccess && txHash && isExecuting) {
      // Show success toast with transaction hash
      addToast({
        type: 'success',
        title: 'Transaction Confirmed',
        description: `Function executed successfully!`,
        duration: 8000,
        action: {
          label: 'View Transaction',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${txHash}`
              : networkType === 'local'
              ? `http://localhost:8545` // Anvil doesn't have a block explorer
              : `https://sepolia.etherscan.io/tx/${txHash}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });

      // Reset executing state
      setIsExecuting(false);
    }
  }, [isTxSuccess, txHash, isExecuting, networkType, addToast]);

  /**
   * Handle parameter input changes
   */
  const handleParameterChange = (paramKey: string, value: string) => {
    setParameterValues((prev) => ({
      ...prev,
      [paramKey]: value,
    }));

    // Clear validation error when user types
    if (validationErrors[paramKey]) {
      setValidationErrors((prev) => ({
        ...prev,
        [paramKey]: false,
      }));
    }

    // Clear conversion error when user types
    if (conversionErrors[paramKey]) {
      setConversionErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[paramKey];
        return newErrors;
      });
    }
  };

  /**
   * Validate form - check that all parameters have values
   */
  const validateForm = (): boolean => {
    if (!selectedFunction) return false;

    const errors: Record<string, boolean> = {};
    let hasErrors = false;

    selectedFunction.inputs.forEach((input, index) => {
      const key = input.name || `param${index}`;
      const value = parameterValues[key] || '';

      if (value.trim() === '') {
        errors[key] = true;
        hasErrors = true;
      } else {
        errors[key] = false;
      }
    });

    setValidationErrors(errors);
    return !hasErrors;
  };

  /**
   * Convert and validate parameters for contract calls
   * Returns converted parameters array or null if there are errors
   */
  const convertAndValidateParameters = (): any[] | null => {
    if (!selectedFunction) return null;

    // Validate form first
    if (!validateForm()) {
      return null;
    }

    // Convert e-notation values for numeric parameters and boolean values
    const convertedValues: Record<string, string | boolean> = {};
    const newConversionErrors: Record<string, string> = {};
    let hasConversionErrors = false;

    selectedFunction.inputs.forEach((input, index) => {
      const key = input.name || `param${index}`;
      const value = parameterValues[key] || '';
      const paramType = input.type;

      console.log(`[Admin Panel] Parameter "${key}":`, {
        type: paramType,
        originalValue: value,
        isNumeric: isNumericType(paramType),
        isBoolean: isBooleanType(paramType),
        hasENotation: /[eE]/.test(value),
      });

      // Check if parameter is boolean type
      if (isBooleanType(paramType)) {
        // Convert string to boolean
        const boolValue = convertBooleanParameter(value);
        convertedValues[key] = boolValue;
        console.log(`[Admin Panel] ✅ Boolean converted "${value}" → ${boolValue}`);
      }
      // Check if parameter is numeric type and contains e-notation
      else if (isNumericType(paramType) && /[eE]/.test(value)) {
        try {
          // Convert e-notation to full integer string
          const expandedValue = expandExpInt(value);
          convertedValues[key] = expandedValue;
          console.log(`[Admin Panel] ✅ Converted "${value}" → "${expandedValue}"`);
        } catch (error) {
          // Store conversion error
          const errorMessage = error instanceof Error ? error.message : 'Conversion failed';
          newConversionErrors[key] = errorMessage;
          hasConversionErrors = true;
          console.log(`[Admin Panel] ❌ Conversion failed for "${value}":`, errorMessage);
        }
      } else {
        // Pass through non-numeric or non-e-notation values unchanged
        convertedValues[key] = value;
        console.log(`[Admin Panel] ⏭️ Passed through unchanged: "${value}"`);
      }
    });

    // If there are conversion errors, update state and return null
    if (hasConversionErrors) {
      setConversionErrors(newConversionErrors);
      return null;
    }

    // Build args array in the correct order for the contract function
    const args = selectedFunction.inputs.map((input, index) => {
      const key = input.name || `param${index}`;
      return convertedValues[key];
    });

    return args;
  };

  /**
   * Handle Call button - for read-only functions (view/pure)
   */
  const handleCall = async () => {
    if (!selectedFunction || !selectedContractKey) return;

    const args = convertAndValidateParameters();
    if (!args) return;

    setIsCalling(true);

    try {
      const selectedContract = ownedContracts.find(
        (contract) => contract.addressKey === selectedContractKey
      );

      if (!selectedContract || !addresses) {
        throw new Error('Contract not found');
      }

      const contractAddress = addresses[selectedContract.addressKey];
      if (!contractAddress) {
        throw new Error('Contract address not available');
      }

      console.log(`[Admin Panel] Calling ${selectedFunction.name} with args:`, args);

      // Call the contract function using readContract
      const result = await readContract(wagmiConfig, {
        address: contractAddress as `0x${string}`,
        abi: selectedContract.abi,
        functionName: selectedFunction.name,
        args: args as any,
      });

      console.log(`[Admin Panel] ✅ Call result for ${selectedFunction.name}:`, result);

      // Show success toast
      addToast({
        type: 'success',
        title: 'Call Successful',
        description: 'Function called successfully. Check console for results.',
        duration: 6000,
      });

    } catch (error) {
      console.error('[Admin Panel] ❌ Call error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Call Failed',
        description: errorMessage,
        duration: 8000,
      });
    } finally {
      setIsCalling(false);
    }
  };

  /**
   * Handle Execute button - for state-changing functions
   */
  const handleExecute = async () => {
    if (!selectedFunction || !selectedContractKey) return;

    const args = convertAndValidateParameters();
    if (!args) return;

    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to execute transactions.',
        duration: 6000,
      });
      return;
    }

    setIsExecuting(true);

    try {
      const selectedContract = ownedContracts.find(
        (contract) => contract.addressKey === selectedContractKey
      );

      if (!selectedContract || !addresses) {
        throw new Error('Contract not found');
      }

      const contractAddress = addresses[selectedContract.addressKey];
      if (!contractAddress) {
        throw new Error('Contract address not available');
      }

      console.log(`[Admin Panel] Executing ${selectedFunction.name} with args:`, args);

      // Show pending toast
      const pendingToastId = addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: `Please confirm the transaction in your wallet.`,
        duration: 0,
      });

      // Execute the transaction
      const hash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: selectedContract.abi,
        functionName: selectedFunction.name,
        args: args as any,
      });

      // Remove pending toast
      removeToast(pendingToastId);

      // Show confirming toast
      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for blockchain confirmation...',
        duration: 0,
      });

      console.log(`[Admin Panel] ✅ Transaction submitted:`, hash);

      // Success will be handled by useEffect when transaction confirms

    } catch (error) {
      console.error('[Admin Panel] ❌ Execute error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Transaction Failed',
        description: errorMessage,
        duration: 8000,
      });
      setIsExecuting(false);
    }
  };

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

        // Refetch vault balance and principal to show updated amounts
        await refetchVaultBalance();
        await refetchPrincipal();

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

      {/* AutoDola Vault Yield vs Principal Breakdown */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          AutoDola Vault Balance Breakdown
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Principal (Bonding Curve):</span>
            <span className="text-sm font-mono text-foreground">
              {principalDisplay} DOLA
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Yield Generated:</span>
            <span className="text-sm font-mono text-accent">
              {yieldDisplay} DOLA
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-sm font-medium text-foreground">Total Vault Balance:</span>
            <span className="text-sm font-mono font-semibold text-foreground">
              {totalDisplay} DOLA
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
          <strong>Note:</strong> Principal represents DOLA deposited through the bonding curve.
          Yield is vault balance growth beyond principal. The bonding curve values phUSD as though yield is 0%,
          while the protocol utilizes yield separately.
          <span className="block mt-2">
            Values are fetched directly from AutoDolaYieldStrategy using the IYieldStrategy interface:
            principalOf() returns principal only, totalBalanceOf() returns principal + yield.
            Yield is calculated as: totalBalanceOf - principalOf.
          </span>
        </p>
      </div>

      {/* Selected Contract Address Display */}
      {selectedContractKey && addresses && (
        <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-foreground">Selected Contract Address:</span>
            <span className="text-xs font-mono text-accent">
              {(() => {
                const selectedContract = ownedContracts.find(c => c.addressKey === selectedContractKey);
                if (!selectedContract) return 'N/A';
                const address = addresses[selectedContract.addressKey];
                return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'N/A';
              })()}
            </span>
          </div>
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
            value={selectedFunctionName}
            onChange={(e) => setSelectedFunctionName(e.target.value)}
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

      {/* Parameter Input Form */}
      {selectedFunction && (
        <div className="mb-6 p-4 bg-card border border-border rounded-lg">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Function Parameters
          </h3>

          {selectedFunction.inputs.length > 0 ? (
            <div className="space-y-3">
              {selectedFunction.inputs.map((input, index) => {
                const key = input.name || `param${index}`;
                const paramName = input.name || `parameter${index}`;
                const paramType = input.type;
                const hasError = validationErrors[key];
                const conversionError = conversionErrors[key];

                return (
                  <div key={key}>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      {paramName}({paramType})
                    </label>
                    <input
                      type="text"
                      className={`w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent ${
                        hasError || conversionError
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-border'
                      }`}
                      value={parameterValues[key] || ''}
                      onChange={(e) => handleParameterChange(key, e.target.value)}
                      placeholder={`Enter ${paramName}`}
                    />
                    {hasError && (
                      <p className="text-xs text-red-500 mt-1">
                        This field is required
                      </p>
                    )}
                    {conversionError && (
                      <p className="text-xs text-red-500 mt-1">
                        {conversionError}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">
              This function has no parameters
            </p>
          )}

          <div className="mt-4">
            {selectedFunction.stateMutability === 'view' ||
            selectedFunction.stateMutability === 'pure' ? (
              <ActionButton
                disabled={!isConnected || isCalling}
                onAction={handleCall}
                label="Call"
                variant="primary"
                isLoading={isCalling}
              />
            ) : (
              <ActionButton
                disabled={!isConnected || isExecuting || isConfirming}
                onAction={handleExecute}
                label="Execute"
                variant="primary"
                isLoading={isExecuting || isConfirming}
              />
            )}
          </div>
        </div>
      )}

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
