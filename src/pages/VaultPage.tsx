import { useState, useEffect, useRef } from 'react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import type { Tab, VaultFormData, VaultConstants, TokenInfo, PositionInfo } from '../types/vault';
import { useToast } from '../components/ui/ToastProvider';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { useTokenBalance, useTokenAllowance, useTokenApproval, useBondingCurve, useAddLiquidity, useRemoveLiquidity } from '../hooks/useContractInteractions';
import { useApprovalTransaction } from '../hooks/useTransaction';
import { getErrorTitle, shouldOfferRetry } from '../utils/transactionErrors';
import { formatUnits, parseUnits } from 'viem';
import { behodler3TokenlaunchAbi } from '@behodler/wagmi-hooks';
import Header from '../components/layout/Header';
import TabNavigation from '../components/ui/TabNavigation';
import DepositForm from '../components/vault/DepositForm';
import WithdrawTab from '../components/vault/WithdrawTab';
import MintForm from '../components/vault/MintForm';
import TestnetFaucet from '../components/vault/TestnetFaucet';
import SafetyTab from '../components/vault/SafetyTab';
import Admin from '../components/vault/Admin';
import ContextBox from '../components/vault/ContextBox';
import FAQ from '../components/vault/FAQ';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import DOLA from "../assets/sDOLA.png";
import { log } from '../utils/logger';

export default function VaultPage() {
  // Detect chain ID to determine if Testnet Faucet should be shown
  const chainId = useChainId();
  const isMainnet = chainId === 1;

  // State to track if component has mounted (prevents flickering)
  const [isMounted, setIsMounted] = useState(false);

  // Wagmi hooks for wallet connection
  const { isConnected, address: walletAddress } = useAccount();

  // Contract addresses context
  const { addresses, networkType, loading: addressesLoading, error: addressesError } = useContractAddresses();

  // Debug logging for contract addresses
  useEffect(() => {
    log.debug('🎯 VaultPage: Contract addresses updated:', {
      addresses,
      networkType,
      loading: addressesLoading,
      error: addressesError,
      chainId
    });
  }, [addresses, networkType, addressesLoading, addressesError, chainId]);

  // Fetch the owner address from the bonding curve contract
  const { data: ownerAddress } = useReadContract({
    address: addresses?.bondingCurve as `0x${string}` | undefined,
    abi: behodler3TokenlaunchAbi,
    functionName: 'owner',
    query: {
      enabled: !!addresses?.bondingCurve,
    },
  });

  // Check if the connected wallet is the owner (case-insensitive comparison)
  const isOwner = isMounted && walletAddress && ownerAddress
    ? walletAddress.toLowerCase() === ownerAddress.toLowerCase()
    : false;

  // Determine tabs based on network and owner status
  // - Show Admin tab if user is the owner
  // - Show Testnet Faucet if not on mainnet
  // - Show Safety tab on all networks
  // - Show Mint tab for 1:1 DOLA to phUSD minting
  // - Show Deposit and Withdraw tabs for ContextBox-driven content
  const tabs: readonly Tab[] = (() => {
    if (!isMounted) {
      return ["Deposit to Mint", "Burn to Withdraw", "Mint", "Deposit", "Withdraw"];
    }

    const tabList: Tab[] = ["Deposit to Mint", "Burn to Withdraw", "Mint", "Deposit", "Withdraw"];

    if (!isMainnet) {
      tabList.push("Testnet Faucet");
    }

    // Safety tab is available on all networks
    tabList.push("Safety");

    if (isOwner) {
      tabList.push("Admin");
    }

    return tabList;
  })();

  const [activeTab, setActiveTab] = useState<Tab>("Deposit to Mint");

  // FAQ state - tracks which FAQ context to display
  const [faqComponent, setFaqComponent] = useState<string | undefined>("DepositTab");

  // Set mounted state after initial render to prevent flickering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Form state - separate amounts for deposit, withdraw, and mint to prevent cross-tab persistence
  // MUST be declared before useEffect that depends on these values to avoid TDZ errors
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [mintAmount, setMintAmount] = useState<string>("");
  const [formData, setFormData] = useState<VaultFormData>({
    amount: "", // This will be overridden by depositAmount, withdrawAmount, or mintAmount depending on active tab
    autoStake: false,
    slippageBps: 10, // 0.10%
  });

  // State for mock minting transaction
  const [isMinting, setIsMinting] = useState(false);

  // Sync formData.amount with the appropriate state variable when tab changes
  useEffect(() => {
    if (activeTab === "Deposit to Mint") {
      setFormData(prev => ({ ...prev, amount: depositAmount }));
    } else if (activeTab === "Burn to Withdraw") {
      setFormData(prev => ({ ...prev, amount: withdrawAmount }));
    } else if (activeTab === "Mint") {
      setFormData(prev => ({ ...prev, amount: mintAmount }));
    }
  }, [activeTab, depositAmount, withdrawAmount, mintAmount]);

  // Fetch bonding curve prices, withdraw fee, and pause state
  const {
    currentPrice: currentPriceRaw,
    withdrawalFeeBasisPoints: withdrawalFeeBasisPointsRaw,
    isPaused,
    refetch: refetchBondingCurve
  } = useBondingCurve(addresses?.bondingCurve as `0x${string}` | undefined);

  // Fetch DOLA balance from wallet's ERC20 token balance
  const {
    balance: dolaBalanceRaw,
    refetch: refetchDolaBalance
  } = useTokenBalance(
    walletAddress,
    addresses?.dolaToken as `0x${string}` | undefined
  );

  // Fetch phUSD balance from wallet's ERC20 token balance (following pattern from story 018)
  const {
    balance: phUSDBalanceRaw,
    refetch: refetchPhUSDBalance
  } = useTokenBalance(
    walletAddress,
    addresses?.bondingToken as `0x${string}` | undefined
  );


  // Fetch DOLA allowance for bonding curve contract
  const {
    allowance: dolaAllowanceRaw,
    isLoading: dolaAllowanceLoading,
    refetch: refetchAllowance
  } = useTokenAllowance(
    walletAddress,
    addresses?.bondingCurve as `0x${string}` | undefined,
    addresses?.dolaToken as `0x${string}` | undefined
  );

  // Fetch bonding token (phUSD) allowance for bonding curve contract
  // This is needed for withdrawals - bonding curve needs approval to burn user's phUSD
  const {
    allowance: bondingTokenAllowanceRaw,
    isLoading: bondingTokenAllowanceLoading,
    refetch: refetchBondingTokenAllowance
  } = useTokenAllowance(
    walletAddress,
    addresses?.bondingCurve as `0x${string}` | undefined,
    addresses?.bondingToken as `0x${string}` | undefined
  );

  // Convert bigint balance to decimal number (DOLA uses 18 decimals)
  const dolaBalanceDecimal = dolaBalanceRaw
    ? parseFloat(formatUnits(dolaBalanceRaw, 18))
    : 0;

  // Convert bigint balance to decimal number (phUSD uses 18 decimals)
  const phUSDBalanceDecimal = phUSDBalanceRaw
    ? parseFloat(formatUnits(phUSDBalanceRaw, 18))
    : 0;

  // Convert bigint allowance to decimal number (DOLA uses 18 decimals)
  const dolaAllowanceDecimal = dolaAllowanceRaw
    ? parseFloat(formatUnits(dolaAllowanceRaw, 18))
    : 0;

  // Convert bigint allowance to decimal number (bonding token uses 18 decimals)
  const bondingTokenAllowanceDecimal = bondingTokenAllowanceRaw
    ? parseFloat(formatUnits(bondingTokenAllowanceRaw, 18))
    : 0;

  // Convert withdraw fee from basis points to decimal rate
  // Basis points: 200 = 2%, 100 = 1%, etc.
  const withdrawalFeeRate = withdrawalFeeBasisPointsRaw !== undefined
    ? Number(withdrawalFeeBasisPointsRaw) / 10000
    : 0.02; // Fallback to 2% if not loaded

  // Format balance data for components (assuming 1:1 USD ratio for DOLA)
  const dolaBalance = {
    balance: {
      balance: dolaBalanceDecimal,
      balanceUsd: dolaBalanceDecimal,
      balanceRaw: dolaBalanceRaw // Pass raw BigInt for precision-sensitive operations
    }
  };

  // Format phUSD balance data for components (using current bonding curve price for USD value)
  const phUSDBalance = {
    balance: {
      balance: phUSDBalanceDecimal,
      balanceUsd: phUSDBalanceDecimal * (currentPriceRaw ? parseFloat(formatUnits(currentPriceRaw, 18)) : 0),
      valueRaw: phUSDBalanceRaw // Pass raw BigInt for precision-sensitive operations
    }
  };

  const isTransacting = false;

  // Toast notifications
  const { addToast, removeToast } = useToast();

  // Token approval hook
  const { approve } = useTokenApproval();

  // Add liquidity hook
  const {
    addLiquidity,
    isPending: isDepositPending,
    isConfirming: isDepositConfirming,
    isSuccess: isDepositSuccess,
    hash: depositHash,
    receipt: depositReceipt,
    error: depositError,
    isError: isDepositError,
  } = useAddLiquidity(addresses?.bondingCurve as `0x${string}` | undefined);

  // Remove liquidity hook
  const {
    removeLiquidity,
    isPending: isWithdrawPending,
    isConfirming: isWithdrawConfirming,
    isSuccess: isWithdrawSuccess,
    hash: withdrawHash,
    receipt: withdrawReceipt,
    error: withdrawError,
    isError: isWithdrawError,
  } = useRemoveLiquidity(addresses?.bondingCurve as `0x${string}` | undefined);

  // Store the deposit amount when transaction is initiated to prevent duplicate toasts
  // This ref captures the amount before form reset, avoiding useEffect re-trigger
  const lastDepositAmountRef = useRef<string>("");

  // Store the withdraw amount when transaction is initiated to prevent duplicate toasts
  const lastWithdrawAmountRef = useRef<string>("");

  // Convert current price from bonding curve (wei) to decimal rate
  // getCurrentMarginalPrice() returns the price of 1 phUSD in terms of DOLA (scaled by 1e18)
  // If dolaToPhUSDRate = 0.81, it means 1 phUSD costs 0.81 DOLA
  // For DOLA → phUSD (deposit): phUSDAmount = dolaAmount / dolaToPhUSDRate
  // For phUSD → DOLA (withdraw): dolaAmount = phUSDAmount * dolaToPhUSDRate
  const dolaToPhUSDRate = currentPriceRaw
    ? parseFloat(formatUnits(currentPriceRaw, 18))
    : 0; // 0 signals loading/error state to child components

  // Constants object for backward compatibility with existing components
  const constants: VaultConstants = {
    dolaToPhUSDRate,
  };

  // Convert blockchain balance to TokenInfo format for components
  const tokenInfo: TokenInfo = {
    name: "DOLA",
    balance: dolaBalance.balance?.balance ?? 0,
    balanceUsd: dolaBalance.balance?.balanceUsd ?? 0,
    balanceRaw: dolaBalance.balance?.balanceRaw, // Add raw BigInt for precision-sensitive operations
    icon: DOLA
  };

  // Mock token info for the Mint tab (fully mocked flow without blockchain)
  // Provides 10,000 DOLA for testing the mock mint flow
  const MOCK_DOLA_BALANCE = 10000;
  const mintTokenInfo: TokenInfo = {
    name: "DOLA",
    balance: MOCK_DOLA_BALANCE,
    balanceUsd: MOCK_DOLA_BALANCE,
    balanceRaw: parseUnits(MOCK_DOLA_BALANCE.toString(), 18),
    icon: DOLA
  };

  const positionInfo: PositionInfo = {
    value: phUSDBalance.balance?.balance ?? 0,
    valueUsd: phUSDBalance.balance?.balanceUsd ?? 0,
    valueRaw: phUSDBalance.balance?.valueRaw, // Add raw BigInt for precision-sensitive operations
    isStaked: true,
  };

  // Handle deposit success
  useEffect(() => {
    if (isDepositSuccess && depositReceipt && lastDepositAmountRef.current) {
      // Parse the transaction receipt to get the amount of bonding tokens minted
      // The addLiquidity function returns bondingTokensOut, which should be in the logs
      // For now, we'll extract it from the receipt logs
      let bondingTokensMinted = '0';

      try {
        // The addLiquidity function returns bondingTokensOut as a uint256
        // It should be emitted in the logs or we can decode the return value
        // For simplicity, we'll calculate the expected output based on the input amount
        // Use the ref value instead of formData.amount to prevent duplicate toasts
        const amount = parseFloat(lastDepositAmountRef.current);
        const estPhUSD = dolaToPhUSDRate > 0 ? amount / dolaToPhUSDRate : 0;
        bondingTokensMinted = estPhUSD.toFixed(4);
      } catch (error) {
        log.error('Error parsing receipt:', error);
      }

      // Show success toast with amount minted
      addToast({
        type: 'success',
        title: 'Deposit Successful',
        description: `Successfully deposited ${lastDepositAmountRef.current} DOLA and minted ${bondingTokensMinted} phUSD`,
        duration: 30000,
        action: {
          label: 'View Transaction',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${depositHash}`
              : `https://sepolia.etherscan.io/tx/${depositHash}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });

      // Refetch all affected blockchain data to update UI immediately
      // This fixes the bug where balances and bonding curve didn't update after transaction
      const refetchData = async () => {
        await Promise.all([
          refetchDolaBalance(), // User's DOLA balance decreased
          refetchPhUSDBalance(), // User's phUSD balance increased
          refetchBondingCurve(), // Bonding curve state changed (price, total raised, fee)
          refetchAllowance(), // Allowance may have been consumed during transaction
        ]);
      };
      refetchData();

      // Clear deposit amount after successful transaction
      setDepositAmount("");
      setFormData(prev => ({ ...prev, amount: "" }));

      // Clear the ref after successful toast display
      lastDepositAmountRef.current = "";
    }
  }, [isDepositSuccess, depositReceipt, depositHash, dolaToPhUSDRate, networkType, addToast, refetchDolaBalance, refetchPhUSDBalance, refetchBondingCurve, refetchAllowance]);

  // Handle withdraw success
  useEffect(() => {
    if (isWithdrawSuccess && withdrawReceipt && lastWithdrawAmountRef.current) {
      // Parse the transaction receipt to get the amount of DOLA received
      let dolaReceived = '0';
      let phUSDBurnt = '0';
      let feeAmount = '0';

      try {
        // Use the ref value instead of formData.amount to prevent duplicate toasts
        const amount = parseFloat(lastWithdrawAmountRef.current);
        phUSDBurnt = amount.toFixed(4);

        // Calculate fee and amount after fee
        const fee = amount * withdrawalFeeRate;
        feeAmount = fee.toFixed(4);
        const amountAfterFee = amount - fee;

        // Calculate DOLA received using bonding curve rate
        const estDOLA = dolaToPhUSDRate > 0 ? amountAfterFee * dolaToPhUSDRate : 0;
        dolaReceived = estDOLA.toFixed(4);
      } catch (error) {
        log.error('Error parsing receipt:', error);
      }

      // Show success toast with actual amounts burnt and redeemed
      addToast({
        type: 'success',
        title: 'Withdrawal Successful',
        description: `Burned ${phUSDBurnt} phUSD • Fee: ${feeAmount} phUSD (${(withdrawalFeeRate * 100).toFixed(1)}%) • Received: ${dolaReceived} DOLA`,
        duration: 30000,
        action: {
          label: 'View Transaction',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${withdrawHash}`
              : `https://sepolia.etherscan.io/tx/${withdrawHash}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });

      // Refetch all affected blockchain data to update UI immediately
      const refetchData = async () => {
        await Promise.all([
          refetchDolaBalance(), // User's DOLA balance increased
          refetchPhUSDBalance(), // User's phUSD balance decreased
          refetchBondingCurve(), // Bonding curve state changed (price, total raised, fee)
          refetchBondingTokenAllowance(), // Bonding token allowance may have been consumed during withdrawal
        ]);
      };
      refetchData();

      // Clear withdraw amount after successful transaction
      setWithdrawAmount("");
      setFormData(prev => ({ ...prev, amount: "" }));

      // Clear the ref after successful toast display
      lastWithdrawAmountRef.current = "";
    }
  }, [isWithdrawSuccess, withdrawReceipt, withdrawHash, dolaToPhUSDRate, withdrawalFeeRate, networkType, addToast, refetchDolaBalance, refetchPhUSDBalance, refetchBondingCurve]);

  // Handle deposit errors
  useEffect(() => {
    if (isDepositError && depositError) {
      log.error('Deposit transaction error:', depositError);

      // Extract error message
      let errorMessage = 'An error occurred during the deposit transaction.';

      // Check for common error patterns
      if (depositError.message.includes('User rejected') || depositError.message.includes('user rejected')) {
        errorMessage = 'Transaction was rejected in your wallet.';
      } else if (depositError.message.includes('insufficient')) {
        errorMessage = 'Insufficient amount or slippage tolerance too low. Try increasing slippage.';
      } else if (depositError.message.includes('gas')) {
        errorMessage = 'Gas estimation failed. The transaction may fail or require more gas.';
      } else if (depositError.message) {
        // Use the actual error message if available
        errorMessage = depositError.message;
      }

      addToast({
        type: 'error',
        title: 'Deposit Failed',
        description: errorMessage,
        duration: 16000,
      });

      // Clear the deposit amount ref to prevent stale state
      lastDepositAmountRef.current = "";
    }
  }, [isDepositError, depositError, addToast]);

  // Handle withdraw errors
  useEffect(() => {
    if (isWithdrawError && withdrawError) {
      log.error('Withdraw transaction error:', withdrawError);

      // Extract error message
      let errorMessage = 'An error occurred during the withdrawal transaction.';

      // Check for common error patterns
      if (withdrawError.message.includes('User rejected') || withdrawError.message.includes('user rejected')) {
        errorMessage = 'Transaction was rejected in your wallet.';
      } else if (withdrawError.message.includes('insufficient')) {
        errorMessage = 'Insufficient amount or slippage tolerance too low. Try increasing slippage.';
      } else if (withdrawError.message.includes('gas')) {
        errorMessage = 'Gas estimation failed. The transaction may fail or require more gas.';
      } else if (withdrawError.message) {
        // Use the actual error message if available
        errorMessage = withdrawError.message;
      }

      addToast({
        type: 'error',
        title: 'Withdrawal Failed',
        description: errorMessage,
        duration: 16000,
      });

      // Clear the withdraw amount ref to prevent stale state
      lastWithdrawAmountRef.current = "";
    }
  }, [isWithdrawError, withdrawError, addToast]);

  // DOLA approval transaction state management (for deposits)
  const approvalTransaction = useApprovalTransaction(
    async () => {
      // Execute the approval with addresses from context
      if (!addresses?.dolaToken || !addresses?.bondingCurve) {
        throw new Error('Contract addresses not loaded');
      }
      return approve(
        addresses.dolaToken as `0x${string}`,
        addresses.bondingCurve as `0x${string}`
        // Using default maxUint256 for unlimited approval
      );
    },
    {
      onSuccess: async (hash) => {
        // Refetch the allowance to update the UI immediately after approval transaction
        await refetchAllowance();

        addToast({
          type: 'success',
          title: 'Approval Successful',
          description: 'DOLA spending has been approved. You can now deposit.',
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
        log.error('Approval failed:', error);
      },
      onStatusChange: (status) => {

        // Handle status changes with appropriate toast notifications
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

  // Bonding token (phUSD) approval transaction state management (for withdrawals)
  const bondingTokenApprovalTransaction = useApprovalTransaction(
    async () => {
      // Execute the approval with addresses from context
      if (!addresses?.bondingToken || !addresses?.bondingCurve) {
        throw new Error('Contract addresses not loaded');
      }
      return approve(
        addresses.bondingToken as `0x${string}`,
        addresses.bondingCurve as `0x${string}`
        // Using default maxUint256 for unlimited approval
      );
    },
    {
      onSuccess: async (hash) => {
        // Refetch the bonding token allowance to update the UI immediately after approval transaction
        await refetchBondingTokenAllowance();

        addToast({
          type: 'success',
          title: 'Approval Successful',
          description: 'phUSD spending has been approved. You can now withdraw.',
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
        log.error('Bonding token approval failed:', error);
      },
      onStatusChange: (status) => {
        // Handle status changes with appropriate toast notifications
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

  // Event handlers
  const handleFormChange = (data: Partial<VaultFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));

    // Update the appropriate amount state based on active tab
    if (data.amount !== undefined) {
      if (activeTab === "Deposit to Mint") {
        setDepositAmount(data.amount);
      } else if (activeTab === "Burn to Withdraw") {
        setWithdrawAmount(data.amount);
      } else if (activeTab === "Mint") {
        setMintAmount(data.amount);
      }
    }
    // No need to reset approval transaction state - the blockchain allowance
    // (dolaAllowanceDecimal) is the source of truth and updates automatically
  };

  // Handle mint amount change for the Mint tab (simplified - no slippage)
  const handleMintAmountChange = (amount: string) => {
    setMintAmount(amount);
  };

  // Mock mint handler - simulates a successful mint without actual contract interaction
  // This is a fully mocked flow - no wallet connection required
  const handleMint = async () => {
    // Validate amount
    if (!mintAmount || mintAmount === '0' || mintAmount === '') {
      addToast({
        type: 'error',
        title: 'Invalid Amount',
        description: 'Please enter a valid amount greater than 0.',
      });
      return;
    }

    // Check against mock balance (no real blockchain balance needed)
    const parsedAmount = parseFloat(mintAmount);
    if (parsedAmount > MOCK_DOLA_BALANCE) {
      addToast({
        type: 'error',
        title: 'Insufficient Balance',
        description: `You only have ${MOCK_DOLA_BALANCE.toFixed(4)} DOLA available.`,
      });
      return;
    }

    try {
      setIsMinting(true);

      // Show pending toast
      addToast({
        type: 'info',
        title: 'Minting phUSD',
        description: 'Processing your mint transaction...',
        duration: 3000,
      });

      // Simulate a delay to mimic transaction processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Show success toast
      addToast({
        type: 'success',
        title: 'Mint Successful (Mock)',
        description: `Successfully minted ${parsedAmount.toFixed(4)} phUSD from ${parsedAmount.toFixed(4)} DOLA at 1:1 rate`,
        duration: 8000,
      });

      // Clear the mint amount
      setMintAmount("");

    } catch (error) {
      log.error('Mock mint failed:', error);
      addToast({
        type: 'error',
        title: 'Mint Failed',
        description: 'An error occurred during the mint transaction.',
        duration: 8000,
      });
    } finally {
      setIsMinting(false);
    }
  };

  // Handle DOLA approval button click (for deposits)
  const handleApprove = async (): Promise<void> => {


    if (!isConnected) {

      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    if (!addresses?.dolaToken || !addresses?.bondingCurve) {
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
      // Error handling is done in the transaction hook's onError callback
      // But we can add an additional toast here if needed
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

  // Handle bonding token (phUSD) approval button click (for withdrawals)
  const handleBondingTokenApprove = async (): Promise<void> => {
    if (!isConnected) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    if (!addresses?.bondingToken || !addresses?.bondingCurve) {
      addToast({
        type: 'error',
        title: 'Contract Addresses Not Loaded',
        description: 'Please wait for contract addresses to load and try again.',
      });
      return;
    }

    try {
      await bondingTokenApprovalTransaction.execute();
    } catch (error) {
      // Error handling is done in the transaction hook's onError callback
      // But we can add an additional toast here if needed
      if (bondingTokenApprovalTransaction.state.error) {
        const { error: txError } = bondingTokenApprovalTransaction.state;
        addToast({
          type: 'error',
          title: getErrorTitle(txError.type),
          description: txError.message,
          duration: 8000,
          action: shouldOfferRetry(txError.type) ? {
            label: 'Retry',
            onClick: () => bondingTokenApprovalTransaction.retry()
          } : undefined
        });
      }
    }
  };

  const handleDeposit = async (bondingCurveOutput?: number) => {
    if (!isConnected) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    // Validate amount string without converting through Number (preserves precision)
    if (!formData.amount || formData.amount === '0' || formData.amount === '') {
      addToast({
        type: 'error',
        title: 'Invalid Amount',
        description: 'Please enter a valid amount greater than 0.',
      });
      return;
    }

    if (!dolaBalance.balance || !phUSDBalance.balance) {
      addToast({
        type: 'error',
        title: 'Balance Error',
        description: 'Token balances are not available. Please refresh and try again.',
      });
      return;
    }

    // Convert to BigInt for comparison (maintains full precision)
    let inputAmountWei: bigint;
    try {
      inputAmountWei = parseUnits(formData.amount, 18);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Invalid Amount',
        description: 'Please enter a valid numeric amount.',
      });
      return;
    }

    // Use BigInt comparison if balanceRaw is available, otherwise fall back to number comparison
    const balanceRaw = dolaBalance.balance.balanceRaw;
    const isInsufficient = balanceRaw !== undefined
      ? inputAmountWei > balanceRaw
      : parseFloat(formData.amount) > dolaBalance.balance.balance;

    if (isInsufficient) {
      addToast({
        type: 'error',
        title: 'Insufficient Balance',
        description: `You only have ${dolaBalance.balance.balance.toFixed(4)} DOLA available.`,
      });
      return;
    }

    if (!addresses?.bondingCurve) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'Bonding curve contract address not loaded. Please try again.',
      });
      return;
    }

    try {
      // Capture the deposit amount before transaction to prevent duplicate toasts
      lastDepositAmountRef.current = formData.amount;

      // Show pending toast
      const pendingToastId = addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the transaction in your wallet.',
        duration: 30000,
      });

      // Calculate expected output and minimum received
      // Use bonding curve output if available (from DepositForm's quoteAddLiquidity call)
      // This ensures minReceived matches actual bonding curve output, not marginal price
      // bondingCurveOutput comes from the actual bonding curve contract quote
      const estPhUSD = bondingCurveOutput ?? (dolaToPhUSDRate > 0 ? parseFloat(formData.amount) / dolaToPhUSDRate : 0);

      // Apply slippage tolerance and add 0.1% safety buffer for blockchain state changes
      // Safety buffer accounts for other transactions executing between quote and our transaction
      const minReceived = estPhUSD * (1 - formData.slippageBps / 10000) * 0.999;

      // Use the already-parsed BigInt amount (maintains full precision)
      const inputAmount = inputAmountWei;
      const minBondingTokens = parseUnits(minReceived.toString(), 18);

      // Call addLiquidity
      const hash = await addLiquidity(inputAmount, minBondingTokens);

      // Remove pending toast
      removeToast(pendingToastId);

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

      // Wait for the transaction to be mined
      // The receipt will be available via the hook's state
      // We'll handle success in a useEffect below

    } catch (error) {
      log.error('Deposit failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Deposit Failed',
        description: errorMessage,
        duration: 8000,
      });
    }
  };


  const handleWithdraw = async (bondingCurveOutput?: number) => {
    if (!isConnected) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    // Validate amount string without converting through Number (preserves precision)
    if (!formData.amount || formData.amount === '0' || formData.amount === '') {
      addToast({
        type: 'error',
        title: 'Invalid Amount',
        description: 'Please enter a valid amount greater than 0.',
      });
      return;
    }

    if (!phUSDBalance.balance || !dolaBalance.balance) {
      addToast({
        type: 'error',
        title: 'Balance Error',
        description: 'Token balances are not available. Please refresh and try again.',
      });
      return;
    }

    // Convert to BigInt for comparison (maintains full precision)
    let inputAmountWei: bigint;
    try {
      inputAmountWei = parseUnits(formData.amount, 18);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Invalid Amount',
        description: 'Please enter a valid numeric amount.',
      });
      return;
    }

    // Use BigInt comparison if valueRaw is available, otherwise fall back to number comparison
    const valueRaw = phUSDBalance.balance.valueRaw;
    const isInsufficient = valueRaw !== undefined
      ? inputAmountWei > valueRaw
      : parseFloat(formData.amount) > phUSDBalance.balance.balance;

    if (isInsufficient) {
      const amount = parseFloat(formData.amount);
      const feeAmount = (amount * withdrawalFeeRate).toFixed(4);
      const amountAfterFee = amount - (amount * withdrawalFeeRate);
      const dolaReceived = (amountAfterFee * dolaToPhUSDRate).toFixed(4);
      addToast({
        type: 'error',
        title: 'Insufficient phUSD Balance',
        description: `Attempting to withdraw ${amount} phUSD (fee: ${feeAmount}, receive: ${dolaReceived} DOLA) but you only have ${phUSDBalance.balance.balance.toFixed(4)} phUSD available.`,
        duration: 8000,
      });
      return;
    }

    if (!addresses?.bondingCurve) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'Bonding curve contract address not loaded. Please try again.',
      });
      return;
    }

    try {
      // Capture the withdraw amount before transaction to prevent duplicate toasts
      lastWithdrawAmountRef.current = formData.amount;

      // Show pending toast
      const pendingToastId = addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the transaction in your wallet.',
        duration: 30000,
      });

      // Calculate fee and amount after fee using BigInt arithmetic
      const feeAmountWei = (inputAmountWei * BigInt(Math.floor(withdrawalFeeRate * 1e18))) / BigInt(1e18);
      const amountAfterFeeWei = inputAmountWei - feeAmountWei;
      const amountAfterFee = parseFloat(formatUnits(amountAfterFeeWei, 18));

      // Use bonding curve output if available (from WithdrawTab's quoteRemoveLiquidity call)
      // This ensures minReceived matches actual bonding curve output, not marginal price
      // bondingCurveOutput comes from the actual bonding curve contract quote
      const estDOLA = bondingCurveOutput ?? (dolaToPhUSDRate > 0 ? amountAfterFee * dolaToPhUSDRate : 0);

      // Apply slippage tolerance and add 0.1% safety buffer for blockchain state changes
      // Safety buffer accounts for other transactions executing between quote and our transaction
      const minReceived = estDOLA * (1 - formData.slippageBps / 10000) * 0.999;

      // Use the already-parsed BigInt amount (maintains full precision)
      const bondingTokenAmount = inputAmountWei;
      const minInputTokens = parseUnits(minReceived.toString(), 18);

      // Call removeLiquidity
      const hash = await removeLiquidity(bondingTokenAmount, minInputTokens);

      // Remove pending toast
      removeToast(pendingToastId);

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

      // Wait for the transaction to be mined
      // The receipt will be available via the hook's state
      // We'll handle success in the useEffect above

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Withdrawal Failed',
        description: errorMessage,
        duration: 8000,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-8 grid lg:grid-cols-3 gap-6">
        {/* Left: Main card */}
        <section className="lg:col-span-2">
          <div className="phoenix-card p-0 overflow-hidden">
            <TabNavigation
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onTriggerFAQ={setFaqComponent}
            />

            {/* Tab content */}
            {activeTab === "Deposit to Mint" ? (
              <ErrorBoundary>
                <DepositForm
                  formData={formData}
                  onFormChange={handleFormChange}
                  constants={constants}
                  tokenInfo={tokenInfo}
                  onDeposit={handleDeposit}
                  isTransacting={isTransacting || approvalTransaction.state.isPending || approvalTransaction.state.isConfirming || isDepositPending || isDepositConfirming}
                  needsApproval={parseFloat(formData.amount || '0') > dolaAllowanceDecimal}
                  onApprove={handleApprove}
                  isAllowanceLoading={dolaAllowanceLoading}
                  isPaused={isPaused === true}
                />
              </ErrorBoundary>
            ) : activeTab === "Burn to Withdraw" ? (
              <ErrorBoundary>
                <WithdrawTab
                  formData={formData}
                  onFormChange={handleFormChange}
                  constants={constants}
                  positionInfo={positionInfo}
                  onWithdraw={handleWithdraw}
                  isTransacting={isTransacting || bondingTokenApprovalTransaction.state.isPending || bondingTokenApprovalTransaction.state.isConfirming || isWithdrawPending || isWithdrawConfirming}
                  withdrawalFeeRate={withdrawalFeeRate}
                  needsApproval={parseFloat(formData.amount || '0') > bondingTokenAllowanceDecimal}
                  onApprove={handleBondingTokenApprove}
                  isAllowanceLoading={bondingTokenAllowanceLoading}
                  isPaused={isPaused === true}
                />
              </ErrorBoundary>
            ) : activeTab === "Mint" ? (
              <ErrorBoundary>
                <MintForm
                  amount={mintAmount}
                  onAmountChange={handleMintAmountChange}
                  tokenInfo={mintTokenInfo}
                  onMint={handleMint}
                  isTransacting={isMinting}
                  needsApproval={false}  // Mock flow - no approval needed
                  isAllowanceLoading={false}  // Mock flow - no allowance check
                  isPaused={isPaused === true}
                />
              </ErrorBoundary>
            ) : activeTab === "Testnet Faucet" ? (
              <TestnetFaucet />
            ) : activeTab === "Safety" ? (
              <ErrorBoundary>
                <SafetyTab />
              </ErrorBoundary>
            ) : activeTab === "Admin" ? (
              <Admin />
            ) : activeTab === "Deposit" ? (
              <div className="p-6">
                <h1 className="text-2xl font-bold text-card-foreground">Deposit</h1>
              </div>
            ) : activeTab === "Withdraw" ? (
              <div className="p-6">
                <h1 className="text-2xl font-bold text-card-foreground">Withdraw</h1>
              </div>
            ) : null}
          </div>
        </section>

        {/* Right: ContextBox (tab-driven) and FAQ */}
        <aside className="lg:col-span-1 space-y-6">
          <ContextBox visible={activeTab === "Deposit" || activeTab === "Withdraw"}>
            {activeTab === "Deposit" && (
              <h1 className="text-2xl font-bold text-card-foreground">Deposit</h1>
            )}
            {activeTab === "Withdraw" && (
              <h1 className="text-2xl font-bold text-card-foreground">Withdraw</h1>
            )}
          </ContextBox>

          {/* FAQ Component */}
          <FAQ componentName={faqComponent} />
        </aside>
      </main>
    </div>
  );
}