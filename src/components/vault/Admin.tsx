import { useState, useEffect } from 'react';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '../../wagmiConfig';
import {
  phlimboEaAbi,
  phusdStableMinterAbi,
  iYieldStrategyAbi,
} from '@behodler/phase2-wagmi-hooks';
import { pauserAbi } from '../../lib/pauserAbi';
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
 * Contract configurations for admin panel - Phase 2 contracts
 */
const getContractConfigs = (): ContractConfig[] => [
  {
    name: 'PhUSD',
    addressKey: 'PhUSD',
    abi: mintableErc20Abi as Abi,
  },
  {
    name: 'Pauser',
    addressKey: 'Pauser',
    abi: pauserAbi as Abi,
  },
  {
    name: 'YieldStrategyDola',
    addressKey: 'YieldStrategyDola',
    abi: iYieldStrategyAbi as Abi,
  },
  {
    name: 'YieldStrategyUSDT',
    addressKey: 'YieldStrategyUSDT',
    abi: iYieldStrategyAbi as Abi,
  },
  {
    name: 'YieldStrategyUSDS',
    addressKey: 'YieldStrategyUSDS',
    abi: iYieldStrategyAbi as Abi,
  },
  {
    name: 'PhusdStableMinter',
    addressKey: 'PhusdStableMinter',
    abi: phusdStableMinterAbi as Abi,
  },
  {
    name: 'PhlimboEA',
    addressKey: 'PhlimboEA',
    abi: phlimboEaAbi as Abi,
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
 * Provides administrative controls for the Phoenix protocol contract owners.
 * This component is only rendered when the connected wallet address matches
 * the owner address of any Phase 2 protocol contract.
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

  // Fetch the owner address from the PhlimboEA contract (new Phase 2 architecture)
  const { data: ownerAddress } = useReadContract({
    address: addresses?.PhlimboEA as `0x${string}` | undefined,
    abi: phlimboEaAbi,
    functionName: 'owner',
    query: {
      enabled: !!addresses?.PhlimboEA,
    },
  });

  // Fetch principal from YieldStrategyDola (principal deposited via PhusdStableMinter)
  const { data: phusdStableMinterPrincipal, refetch: refetchPrincipal, error: principalError } = useReadContract({
    address: addresses?.YieldStrategyDola as `0x${string}` | undefined,
    abi: iYieldStrategyAbi,
    functionName: 'principalOf',
    args: addresses?.Dola && addresses?.PhusdStableMinter
      ? [addresses.Dola as `0x${string}`, addresses.PhusdStableMinter as `0x${string}`]
      : undefined,
    query: {
      enabled: !!addresses?.YieldStrategyDola && !!addresses?.Dola && !!addresses?.PhusdStableMinter,
    },
  });

  // Fetch total balance from YieldStrategyDola (principal + yield for PhusdStableMinter)
  // Uses totalBalanceOf per IYieldStrategy interface specification
  // This is used for calculating yield display: yield = totalBalanceOf - principalOf
  const { data: phusdStableMinterTotalBalance, refetch: refetchTotalBalance, error: totalBalanceError } = useReadContract({
    address: addresses?.YieldStrategyDola as `0x${string}` | undefined,
    abi: iYieldStrategyAbi,
    functionName: 'totalBalanceOf',
    args: addresses?.Dola && addresses?.PhusdStableMinter
      ? [addresses.Dola as `0x${string}`, addresses.PhusdStableMinter as `0x${string}`]
      : undefined,
    query: {
      enabled: !!addresses?.YieldStrategyDola && !!addresses?.Dola && !!addresses?.PhusdStableMinter,
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
  // Total = phusdStableMinterTotalBalance (queries YieldStrategyDola.totalBalanceOf)
  // Principal = principal tracked for PhusdStableMinter deposits (queries YieldStrategyDola.principalOf)
  // Yield = Total - Principal (calculated from YieldStrategyDola's tracked principal + yield)
  const principal = phusdStableMinterPrincipal !== undefined ? phusdStableMinterPrincipal : 0n;
  const totalVaultBalance = phusdStableMinterTotalBalance !== undefined ? phusdStableMinterTotalBalance : 0n;
  const yield_ = totalVaultBalance > principal ? totalVaultBalance - principal : 0n;

  // Format for display (convert from wei to DOLA)
  const principalDisplay = (Number(principal) / 1e18).toFixed(2);
  const yieldDisplay = (Number(yield_) / 1e18).toFixed(2);
  const totalDisplay = (Number(totalVaultBalance) / 1e18).toFixed(2);

  // Debug logging for balance queries
  useEffect(() => {
    console.log('[Admin] Balance Query Debug:', {
      phusdStableMinterPrincipal: phusdStableMinterPrincipal?.toString(),
      phusdStableMinterTotalBalance: phusdStableMinterTotalBalance?.toString(),
      principal: principal.toString(),
      totalVaultBalance: totalVaultBalance.toString(),
      yield_: yield_.toString(),
      addresses: {
        YieldStrategyDola: addresses?.YieldStrategyDola,
        Dola: addresses?.Dola,
        PhusdStableMinter: addresses?.PhusdStableMinter,
      },
      errors: {
        principalError: principalError?.message,
        totalBalanceError: totalBalanceError?.message,
      }
    });

    if (principalError) {
      console.error('[Admin] Principal Query Error:', principalError);
    }
    if (totalBalanceError) {
      console.error('[Admin] Total Balance Query Error:', totalBalanceError);
    }
  }, [phusdStableMinterPrincipal, phusdStableMinterTotalBalance, principal, totalVaultBalance, yield_, addresses, principalError, totalBalanceError]);

  /**
   * Discover owned contracts by checking ownership of each contract
   */
  useEffect(() => {
    const discoverOwnedContracts = async () => {
      if (!isConnected || !walletAddress || !addresses) {
        console.log('Contract discovery skipped:', {
          isConnected,
          hasWallet: !!walletAddress,
          hasAddresses: !!addresses,
        });
        setOwnedContracts([]);
        return;
      }

      console.log('Starting contract ownership discovery...');
      console.log('Available addresses:', addresses);
      console.log('Connected wallet:', walletAddress);

      setIsLoadingOwnership(true);

      try {
        const contractConfigs = getContractConfigs();
        console.log('Contract configs to check:', contractConfigs.map(c => ({ name: c.name, key: c.addressKey })));

        const ownedConfigsPromises = contractConfigs.map(async (config) => {
          try {
            const contractAddress = addresses[config.addressKey];

            console.log(`Checking ${config.name}:`, {
              addressKey: config.addressKey,
              contractAddress,
              hasAddress: !!contractAddress,
            });

            if (!contractAddress) {
              console.warn(`${config.name}: No address found for key "${config.addressKey}"`);
              return null;
            }

            console.log(`${config.name}: Calling owner() at ${contractAddress}...`);

            // Try to read the owner() function using wagmi's readContract
            try {
              const ownerAddr = await readContract(wagmiConfig, {
                address: contractAddress as `0x${string}`,
                abi: config.abi,
                functionName: 'owner',
              });

              console.log(`${config.name}: Successfully read owner address:`, ownerAddr);

              console.log(`${config.name}: Owner check:`, {
                contractOwner: ownerAddr,
                walletAddress,
                matches: (ownerAddr as string).toLowerCase() === walletAddress.toLowerCase(),
              });

              // Compare addresses (case-insensitive)
              if ((ownerAddr as string).toLowerCase() === walletAddress.toLowerCase()) {
                console.log(`${config.name}: Owned by connected wallet!`);
                return config;
              } else {
                console.log(`${config.name}: Not owned by connected wallet`);
              }
            } catch (ownerError) {
              console.warn(`${config.name}: Failed to read owner() function:`, ownerError);
              // Contract might not have an owner() function, skip it
            }

            return null;
          } catch (error) {
            console.error(`Error checking ownership for ${config.name}:`, error);
            return null;
          }
        });

        const ownedConfigs = (await Promise.all(ownedConfigsPromises)).filter(
          (config): config is ContractConfig => config !== null
        );

        console.log('Ownership discovery complete:', {
          totalChecked: contractConfigs.length,
          ownedCount: ownedConfigs.length,
          ownedContracts: ownedConfigs.map(c => c.name),
        });

        setOwnedContracts(ownedConfigs);
      } catch (error) {
        console.error('Error discovering owned contracts:', error);
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
      setSelectedFunctionName('');
      setSelectedFunction(null);
      setParameterValues({});
      setValidationErrors({});
      setConversionErrors({});
    }
  }, [selectedContractKey, ownedContracts]);

  /**
   * Get function details when a function is selected
   */
  useEffect(() => {
    if (!selectedFunctionName || !selectedContractKey) {
      setSelectedFunction(null);
      setParameterValues({});
      setValidationErrors({});
      setConversionErrors({});
      return;
    }

    const selectedContract = ownedContracts.find(
      (contract) => contract.addressKey === selectedContractKey
    );

    if (!selectedContract) return;

    const func = (selectedContract.abi as AbiFunction[]).find(
      (item): item is AbiFunction =>
        item.type === 'function' && item.name === selectedFunctionName
    );

    if (func) {
      setSelectedFunction(func);
      // Initialize parameter values with empty strings
      const initialValues: Record<string, string> = {};
      func.inputs.forEach((input) => {
        initialValues[input.name || `param_${func.inputs.indexOf(input)}`] = '';
      });
      setParameterValues(initialValues);
      setValidationErrors({});
      setConversionErrors({});
    }
  }, [selectedFunctionName, selectedContractKey, ownedContracts]);

  /**
   * Handle transaction success
   */
  useEffect(() => {
    if (isTxSuccess && txHash) {
      addToast({
        type: 'success',
        title: 'Transaction Successful',
        description: 'Your transaction has been confirmed on the blockchain.',
        duration: 30000,
        action: {
          label: 'View Transaction',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${txHash}`
              : networkType === 'local'
              ? `http://localhost:8545`
              : `https://sepolia.etherscan.io/tx/${txHash}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });
      setIsExecuting(false);
    }
  }, [isTxSuccess, txHash, networkType, addToast]);

  /**
   * Handle parameter value change
   */
  const handleParameterChange = (paramName: string, value: string) => {
    setParameterValues((prev) => ({
      ...prev,
      [paramName]: value,
    }));

    // Clear any previous validation error for this parameter
    setValidationErrors((prev) => ({
      ...prev,
      [paramName]: false,
    }));

    // Clear any conversion error for this parameter
    setConversionErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[paramName];
      return newErrors;
    });
  };

  /**
   * Build function arguments from parameter values
   */
  const buildFunctionArgs = (): unknown[] | null => {
    if (!selectedFunction) return null;

    const args: unknown[] = [];
    const newValidationErrors: Record<string, boolean> = {};
    const newConversionErrors: Record<string, string> = {};
    let hasError = false;

    for (const input of selectedFunction.inputs) {
      const paramName = input.name || `param_${selectedFunction.inputs.indexOf(input)}`;
      const value = parameterValues[paramName] || '';

      // Check for empty required fields
      if (!value && value !== '0') {
        newValidationErrors[paramName] = true;
        hasError = true;
        continue;
      }

      try {
        // Handle numeric types (uint, int variants)
        if (isNumericType(input.type)) {
          // Expand any exponential notation
          const expanded = expandExpInt(value);
          args.push(BigInt(expanded));
        }
        // Handle boolean types
        else if (isBooleanType(input.type)) {
          args.push(convertBooleanParameter(value));
        }
        // Handle address types
        else if (input.type === 'address') {
          if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
            newConversionErrors[paramName] = 'Invalid address format';
            hasError = true;
            continue;
          }
          args.push(value as `0x${string}`);
        }
        // Handle bytes types
        else if (input.type.startsWith('bytes')) {
          if (!/^0x[a-fA-F0-9]*$/.test(value)) {
            newConversionErrors[paramName] = 'Invalid bytes format (must start with 0x)';
            hasError = true;
            continue;
          }
          args.push(value as `0x${string}`);
        }
        // Default: pass as string
        else {
          args.push(value);
        }
      } catch (error) {
        newConversionErrors[paramName] = error instanceof Error ? error.message : 'Conversion failed';
        hasError = true;
      }
    }

    setValidationErrors(newValidationErrors);
    setConversionErrors(newConversionErrors);

    if (hasError) return null;
    return args;
  };

  /**
   * Handle read call (view/pure functions)
   */
  const handleCallFunction = async () => {
    if (!selectedFunction) return;

    const args = buildFunctionArgs();
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

      const result = await readContract(wagmiConfig, {
        address: contractAddress as `0x${string}`,
        abi: selectedContract.abi,
        functionName: selectedFunction.name,
        args: args as any,
      });

      console.log(`[Admin Panel] Result:`, result);

      // Format result for display
      let displayResult: string;
      if (typeof result === 'bigint') {
        displayResult = result.toString();
      } else if (typeof result === 'object') {
        displayResult = JSON.stringify(result, (_, v) =>
          typeof v === 'bigint' ? v.toString() : v
        , 2);
      } else {
        displayResult = String(result);
      }

      addToast({
        type: 'success',
        title: 'Call Successful',
        description: `Result: ${displayResult}`,
        duration: 30000,
      });
    } catch (error) {
      console.error('[Admin Panel] Call error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Call Failed',
        description: errorMessage,
        duration: 16000,
      });
    } finally {
      setIsCalling(false);
    }
  };

  /**
   * Handle execute transaction (state-changing functions)
   */
  const handleExecuteFunction = async () => {
    if (!selectedFunction) return;

    const args = buildFunctionArgs();
    if (!args) return;

    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to execute transactions.',
        duration: 12000,
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
        duration: 30000,
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
        duration: 30000,
      });

      console.log(`[Admin Panel] Transaction submitted:`, hash);

      // Success will be handled by useEffect when transaction confirms

    } catch (error) {
      console.error('[Admin Panel] Execute error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Transaction Failed',
        description: errorMessage,
        duration: 16000,
      });
      setIsExecuting(false);
    }
  };

  /**
   * Handle mint yield button click
   * Mints DOLA to the AutoDOLA underlying vault for testing
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

    if (!addresses?.Dola || !addresses?.AutoDOLA) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'Contract addresses not loaded. Please try again.',
      });
      return;
    }

    setIsMinting(true);

    try {
      // Mint a fixed amount for testing (1000 DOLA = 1000 * 1e18 wei)
      const mintAmount = BigInt(1000) * BigInt(1e18);

      // Show pending toast
      const pendingToastId = addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the mint yield transaction in your wallet.',
        duration: 30000,
      });

      // Call the mint function on the DOLA token contract, minting to AutoDOLA vault
      const hash = await writeContractAsync({
        address: addresses.Dola as `0x${string}`,
        abi: mintableErc20Abi,
        functionName: 'mint',
        args: [addresses.AutoDOLA as `0x${string}`, mintAmount],
      });

      // Remove pending toast
      removeToast(pendingToastId);

      // Show confirming toast
      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for blockchain confirmation...',
        duration: 30000,
        action: {
          label: 'View on Explorer',
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

      // Wait for confirmation and refetch balances
      setTimeout(() => {
        addToast({
          type: 'success',
          title: 'Yield Minted Successfully',
          description: `Successfully minted 1000 DOLA to AutoDOLA vault!`,
          duration: 30000,
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
        // Refetch balance breakdown after minting yield
        refetchPrincipal();
        refetchTotalBalance();
        setIsMinting(false);
      }, 2000);

    } catch (error) {
      console.error('Mint yield failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Mint Yield Failed',
        description: errorMessage,
        duration: 16000,
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
          Administrative functions for Phoenix Phase 2 protocol contracts
        </p>
      </div>

      {/* Owner Info Box */}
      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-foreground">PhlimboEA Owner:</span>
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
            label={!isConnected ? "Connect Wallet" : "Mint Test Yield (1000 DOLA)"}
            variant="primary"
            isLoading={isMinting}
          />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Mints 1000 DOLA to AutoDOLA vault for testing yield accumulation
          </p>
        </div>
      )}

      {/* YieldStrategyDola Balance Breakdown */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          YieldStrategyDola Balance Breakdown
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Principal (PhusdStableMinter):</span>
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
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={() => {
              refetchPrincipal();
              refetchTotalBalance();
            }}
            className="text-xs text-accent hover:text-accent/80 underline"
          >
            Refresh Balances
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
          <strong>Note:</strong> Principal represents DOLA deposited through PhusdStableMinter.
          Yield is vault balance growth beyond principal. PhUSD values are based on principal only,
          while the protocol utilizes yield separately.
          <span className="block mt-2">
            Values are fetched directly from YieldStrategyDola using the IYieldStrategy interface:
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
            Select Contract
          </label>
          <select
            value={selectedContractKey}
            onChange={(e) => setSelectedContractKey(e.target.value)}
            disabled={isLoadingOwnership || ownedContracts.length === 0}
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">
              {isLoadingOwnership
                ? 'Loading...'
                : ownedContracts.length === 0
                ? 'No owned contracts found'
                : 'Select a contract'}
            </option>
            {ownedContracts.map((contract) => (
              <option key={contract.addressKey} value={contract.addressKey}>
                {contract.name}
              </option>
            ))}
          </select>
        </div>

        {/* Functions Dropdown */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-2">
            Select Function
          </label>
          <select
            value={selectedFunctionName}
            onChange={(e) => setSelectedFunctionName(e.target.value)}
            disabled={!selectedContractKey || availableFunctions.length === 0}
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">
              {!selectedContractKey
                ? 'Select a contract first'
                : 'Select a function'}
            </option>
            {availableFunctions.map((funcName) => (
              <option key={funcName} value={funcName}>
                {funcName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Function Parameters */}
      {selectedFunction && selectedFunction.inputs.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Parameters for {selectedFunction.name}
          </h3>
          <div className="space-y-4">
            {selectedFunction.inputs.map((input, index) => {
              const paramName = input.name || `param_${index}`;
              return (
                <div key={paramName}>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {paramName} ({input.type})
                  </label>
                  <input
                    type="text"
                    value={parameterValues[paramName] || ''}
                    onChange={(e) => handleParameterChange(paramName, e.target.value)}
                    placeholder={`Enter ${input.type}`}
                    className={`w-full px-3 py-2 bg-background border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                      validationErrors[paramName] || conversionErrors[paramName]
                        ? 'border-red-500'
                        : 'border-border'
                    }`}
                  />
                  {validationErrors[paramName] && (
                    <p className="text-xs text-red-500 mt-1">This field is required</p>
                  )}
                  {conversionErrors[paramName] && (
                    <p className="text-xs text-red-500 mt-1">{conversionErrors[paramName]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {selectedFunction && (
        <div className="flex gap-4">
          {/* Call button for view/pure functions */}
          {(selectedFunction.stateMutability === 'view' || selectedFunction.stateMutability === 'pure') && (
            <ActionButton
              disabled={isCalling}
              onAction={handleCallFunction}
              label="Call"
              variant="primary"
              isLoading={isCalling}
            />
          )}

          {/* Execute button for state-changing functions */}
          {selectedFunction.stateMutability !== 'view' && selectedFunction.stateMutability !== 'pure' && (
            <ActionButton
              disabled={isExecuting || isConfirming}
              onAction={handleExecuteFunction}
              label="Execute"
              variant="primary"
              isLoading={isExecuting || isConfirming}
            />
          )}
        </div>
      )}

      {/* Admin Notice */}
      <div className="mt-6 p-4 bg-card border border-border rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>Phase 2 Contracts:</strong> This admin panel manages the new Phoenix Phase 2 protocol contracts
          including PhUSD, Pauser, YieldStrategies (Dola, USDT, USDS), PhusdStableMinter, and PhlimboEA.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          <strong>Dynamic ABI Loading:</strong> ABIs are statically imported from <code className="px-1 py-0.5 bg-background rounded">@behodler/phase2-wagmi-hooks</code>.
        </p>
      </div>
    </div>
  );
}
