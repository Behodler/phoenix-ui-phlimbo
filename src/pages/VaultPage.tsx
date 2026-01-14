import { useState, useEffect } from 'react';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import type { Tab, TokenInfo } from '../types/vault';
import { useToast } from '../components/ui/ToastProvider';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { parseUnits, maxUint256 } from 'viem';
import { phlimboEaAbi, phusdStableMinterAbi } from '@behodler/phase2-wagmi-hooks';
import { useTokenBalance, useTokenAllowance, useTokenApproval } from '../hooks/useContractInteractions';
import { useApprovalTransaction } from '../hooks/useTransaction';
import { getErrorTitle, shouldOfferRetry } from '../utils/transactionErrors';
import Header from '../components/layout/Header';
import TabNavigation from '../components/ui/TabNavigation';
import MintForm from '../components/vault/MintForm';
import DepositToYieldForm from '../components/vault/DepositToYieldForm';
import WithdrawFromYieldForm from '../components/vault/WithdrawFromYieldForm';
import TestnetFaucet from '../components/vault/TestnetFaucet';
import SafetyTab from '../components/vault/SafetyTab';
import YieldFunnelTab from '../components/vault/YieldFunnelTab';
import Admin from '../components/vault/Admin';
import ContextBox from '../components/vault/ContextBox';
import YieldRewardsInfo from '../components/vault/YieldRewardsInfo';
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
  const { address: walletAddress } = useAccount();

  // Contract addresses context
  const { addresses, networkType, loading: addressesLoading, error: addressesError } = useContractAddresses();

  // Debug logging for contract addresses
  useEffect(() => {
    log.debug('VaultPage: Contract addresses updated:', {
      addresses,
      networkType,
      loading: addressesLoading,
      error: addressesError,
      chainId
    });
  }, [addresses, networkType, addressesLoading, addressesError, chainId]);

  // Token approval hook for DOLA
  const { approve } = useTokenApproval();

  // Fetch DOLA balance for connected wallet
  const {
    balance: dolaBalanceRaw,
    refetch: refetchDolaBalance
  } = useTokenBalance(
    walletAddress,
    addresses?.Dola as `0x${string}` | undefined
  );

  // Fetch DOLA allowance for PhusdStableMinter contract (for Mint tab)
  const {
    allowance: dolaAllowanceRaw,
    isLoading: dolaAllowanceLoading,
    refetch: refetchDolaAllowance
  } = useTokenAllowance(
    walletAddress,
    addresses?.PhusdStableMinter as `0x${string}` | undefined,
    addresses?.Dola as `0x${string}` | undefined
  );

  // Fetch DOLA allowance for PhlimboEA contract (for Deposit tab)
  const {
    allowance: dolaAllowanceForPhlimboRaw,
    isLoading: dolaAllowanceForPhlimboLoading,
    refetch: refetchDolaAllowanceForPhlimbo
  } = useTokenAllowance(
    walletAddress,
    addresses?.PhlimboEA as `0x${string}` | undefined,
    addresses?.Dola as `0x${string}` | undefined
  );

  // Fetch phUSD balance for connected wallet (to refetch after mint)
  const {
    refetch: refetchPhUsdBalance
  } = useTokenBalance(
    walletAddress,
    addresses?.PhUSD as `0x${string}` | undefined
  );

  // Fetch the owner address from the PhlimboEA contract (new architecture)
  const { data: ownerAddress } = useReadContract({
    address: addresses?.PhlimboEA as `0x${string}` | undefined,
    abi: phlimboEaAbi,
    functionName: 'owner',
    query: {
      enabled: !!addresses?.PhlimboEA,
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
  // - Show Yield Funnel tab for claiming accumulated yield at a discount
  const tabs: readonly Tab[] = (() => {
    if (!isMounted) {
      return ["Mint", "Deposit", "Withdraw", "Yield Funnel"];
    }

    const tabList: Tab[] = ["Mint", "Deposit", "Withdraw", "Yield Funnel"];

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

  const [activeTab, setActiveTab] = useState<Tab>("Mint");

  // FAQ state - tracks which FAQ context to display
  const [faqComponent, setFaqComponent] = useState<string | undefined>("DepositTab");

  // Set mounted state after initial render to prevent flickering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Form state for mint and yield operations
  const [mintAmount, setMintAmount] = useState<string>("");
  const [depositToYieldAmount, setDepositToYieldAmount] = useState<string>("");
  const [withdrawFromYieldAmount, setWithdrawFromYieldAmount] = useState<string>("");

  // State for mock transactions (withdraw/claim still mocked, mint and deposit are now real)
  const [isWithdrawingFromYield, setIsWithdrawingFromYield] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // Pause state - in the new architecture, we'll use a simple mock for now
  // TODO: Fetch actual pause state from the appropriate Phase 2 contract
  const [isPaused] = useState(false);

  // Toast notifications
  const { addToast } = useToast();

  // Convert DOLA balance from raw bigint to display format
  const dolaBalance = dolaBalanceRaw ? parseFloat((Number(dolaBalanceRaw) / 1e18).toFixed(4)) : 0;

  // Real token info for the Mint tab using actual DOLA balance
  const mintTokenInfo: TokenInfo = {
    name: "DOLA",
    balance: dolaBalance,
    balanceUsd: dolaBalance, // 1:1 USD value assumption for stablecoins
    balanceRaw: dolaBalanceRaw ?? 0n,
    icon: DOLA
  };

  // Check if approval is needed for the current mint amount
  // Convert mint amount to wei for comparison with allowance
  const mintAmountWei = mintAmount && mintAmount !== '' && mintAmount !== '0'
    ? (() => {
        try {
          return parseUnits(mintAmount, 18);
        } catch {
          return 0n;
        }
      })()
    : 0n;

  // Needs approval if allowance is less than the mint amount being requested
  const needsDolaApproval = dolaAllowanceRaw !== undefined
    ? dolaAllowanceRaw < mintAmountWei
    : true; // Default to needing approval if allowance hasn't loaded yet

  // Convert deposit amount to wei for comparison with allowance (for Deposit tab)
  const depositAmountWei = depositToYieldAmount && depositToYieldAmount !== '' && depositToYieldAmount !== '0'
    ? (() => {
        try {
          return parseUnits(depositToYieldAmount, 18);
        } catch {
          return 0n;
        }
      })()
    : 0n;

  // Needs approval for deposit if allowance is less than the deposit amount being requested
  const needsDolaApprovalForDeposit = dolaAllowanceForPhlimboRaw !== undefined
    ? dolaAllowanceForPhlimboRaw < depositAmountWei
    : true; // Default to needing approval if allowance hasn't loaded yet

  // Mint transaction state using wagmi hooks (similar to pause transaction in SafetyTab)
  const { data: mintHash, writeContractAsync: writeMint, isPending: isMintPending } = useWriteContract();
  const { isLoading: isMintConfirming, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({
    hash: mintHash,
    query: {
      enabled: !!mintHash,
    },
  });

  // DOLA approval transaction state management
  const approvalTransaction = useApprovalTransaction(
    async () => {
      if (!addresses?.Dola || !addresses?.PhusdStableMinter) {
        throw new Error('Contract addresses not loaded');
      }
      // Approve unlimited amount for better UX (single approval)
      return approve(
        addresses.Dola as `0x${string}`,
        addresses.PhusdStableMinter as `0x${string}`,
        maxUint256
      );
    },
    {
      onSuccess: async (hash) => {
        await refetchDolaAllowance();

        addToast({
          type: 'success',
          title: 'Approval Successful',
          description: 'DOLA spending has been approved for minting phUSD.',
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
        log.error('DOLA approval failed:', error);
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

  // DOLA approval transaction for Deposit tab (approving PhlimboEA to spend DOLA)
  const depositApprovalTransaction = useApprovalTransaction(
    async () => {
      if (!addresses?.Dola || !addresses?.PhlimboEA) {
        throw new Error('Contract addresses not loaded');
      }
      // Approve unlimited amount for better UX (single approval)
      return approve(
        addresses.Dola as `0x${string}`,
        addresses.PhlimboEA as `0x${string}`,
        maxUint256
      );
    },
    {
      onSuccess: async (hash) => {
        await refetchDolaAllowanceForPhlimbo();

        addToast({
          type: 'success',
          title: 'Approval Successful',
          description: 'DOLA spending has been approved for depositing to PhlimboEA.',
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
        log.error('DOLA approval for deposit failed:', error);
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

  // Stake transaction state for Deposit tab using wagmi hooks
  const { data: stakeHash, writeContractAsync: writeStake, isPending: isStakePending } = useWriteContract();
  const { isLoading: isStakeConfirming, isSuccess: isStakeSuccess } = useWaitForTransactionReceipt({
    hash: stakeHash,
    query: {
      enabled: !!stakeHash,
    },
  });

  // Mock yield/rewards data for YieldRewardsInfo component
  // These are placeholder values until real contract integration is implemented
  const mockYieldData = {
    totalApy: 12.5,      // 12.5% total APY
    phUsdApy: 10.0,      // 10% fixed PhUSD APY
    usdcApy: 2.5,        // 2.5% variable USDC APY
    pendingPhUsd: "125.50",  // Mock pending PhUSD rewards
    pendingUsdc: "18.75",    // Mock pending USDC rewards
    stakedBalance: "1250.00", // Mock staked phUSD balance
  };

  // Mock claim handler - simulates claiming rewards without actual contract interaction
  const handleClaim = async () => {
    try {
      setIsClaiming(true);

      // Show pending toast
      addToast({
        type: 'info',
        title: 'Claiming Rewards',
        description: 'Processing your claim transaction...',
        duration: 3000,
      });

      // Simulate a delay to mimic transaction processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Show success toast
      addToast({
        type: 'success',
        title: 'Claim Successful (Mock)',
        description: `Successfully claimed ${mockYieldData.pendingPhUsd} phUSD and ${mockYieldData.pendingUsdc} USDC rewards`,
        duration: 8000,
      });

      log.debug('Mock claim completed:', {
        pendingPhUsd: mockYieldData.pendingPhUsd,
        pendingUsdc: mockYieldData.pendingUsdc,
      });

    } catch (error) {
      log.error('Mock claim failed:', error);
      addToast({
        type: 'error',
        title: 'Claim Failed',
        description: 'An error occurred during the claim transaction.',
        duration: 8000,
      });
    } finally {
      setIsClaiming(false);
    }
  };

  // Handle mint amount change for the Mint tab (simplified - no slippage)
  const handleMintAmountChange = (amount: string) => {
    setMintAmount(amount);
  };

  // Handle DOLA approval for minting
  const handleDolaApproval = async (): Promise<void> => {
    if (!walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    if (!addresses?.Dola || !addresses?.PhusdStableMinter) {
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

  // Real mint handler - executes PhusdStableMinter.mint(stablecoin, amount)
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

    // Check wallet connection
    if (!walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    // Check contract addresses are loaded
    if (!addresses?.PhusdStableMinter || !addresses?.Dola) {
      addToast({
        type: 'error',
        title: 'Contract Not Ready',
        description: 'Please wait for contract addresses to load.',
      });
      return;
    }

    // Check balance
    const parsedAmount = parseFloat(mintAmount);
    if (parsedAmount > dolaBalance) {
      addToast({
        type: 'error',
        title: 'Insufficient Balance',
        description: `You only have ${dolaBalance.toFixed(4)} DOLA available.`,
      });
      return;
    }

    try {
      // Show pending toast
      addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the mint transaction in your wallet.',
        duration: 30000,
      });

      // Convert amount to wei (18 decimals for DOLA)
      const amountWei = parseUnits(mintAmount, 18);

      // Execute mint: PhusdStableMinter.mint(stablecoinAddress, amount)
      const hash = await writeMint({
        address: addresses.PhusdStableMinter as `0x${string}`,
        abi: phusdStableMinterAbi,
        functionName: 'mint',
        args: [addresses.Dola as `0x${string}`, amountWei],
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
      log.error('Mint failed:', error);

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
          title: 'Mint Failed',
          description: errorMessage,
          duration: 16000,
        });
      }
    }
  };

  // Handle mint success in useEffect to prevent infinite loop
  useEffect(() => {
    if (isMintSuccess && mintHash) {
      const parsedAmount = parseFloat(mintAmount || '0');

      addToast({
        type: 'success',
        title: 'Mint Successful',
        description: `Successfully minted ${parsedAmount.toFixed(4)} phUSD from ${parsedAmount.toFixed(4)} DOLA at 1:1 rate`,
        duration: 30000,
        action: {
          label: 'View Transaction',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${mintHash}`
              : `https://sepolia.etherscan.io/tx/${mintHash}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });

      // Clear the mint amount
      setMintAmount("");

      // Refetch balances
      refetchDolaBalance();
      refetchPhUsdBalance();
      refetchDolaAllowance();
    }
  }, [isMintSuccess, mintHash]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle deposit to yield amount change
  const handleDepositToYieldAmountChange = (amount: string) => {
    setDepositToYieldAmount(amount);
  };

  // Handle DOLA approval for depositing to PhlimboEA
  const handleDolaApprovalForDeposit = async (): Promise<void> => {
    if (!walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    if (!addresses?.Dola || !addresses?.PhlimboEA) {
      addToast({
        type: 'error',
        title: 'Contract Not Ready',
        description: 'Please wait for contract addresses to load.',
      });
      return;
    }

    try {
      await depositApprovalTransaction.execute();
    } catch {
      if (depositApprovalTransaction.state.error) {
        const { error: txError } = depositApprovalTransaction.state;
        addToast({
          type: 'error',
          title: getErrorTitle(txError.type),
          description: txError.message,
          duration: 16000,
          action: shouldOfferRetry(txError.type) ? {
            label: 'Retry',
            onClick: () => depositApprovalTransaction.retry()
          } : undefined
        });
      }
    }
  };

  // Real deposit to yield handler - executes PhlimboEA.stake(amount, userAddress)
  const handleDepositToYield = async () => {
    // Validate amount
    if (!depositToYieldAmount || depositToYieldAmount === '0' || depositToYieldAmount === '') {
      addToast({
        type: 'error',
        title: 'Invalid Amount',
        description: 'Please enter a valid amount greater than 0.',
      });
      return;
    }

    // Check wallet connection
    if (!walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    // Check contract addresses are loaded
    if (!addresses?.PhlimboEA || !addresses?.Dola) {
      addToast({
        type: 'error',
        title: 'Contract Not Ready',
        description: 'Please wait for contract addresses to load.',
      });
      return;
    }

    // Check balance
    const parsedAmount = parseFloat(depositToYieldAmount);
    if (parsedAmount > dolaBalance) {
      addToast({
        type: 'error',
        title: 'Insufficient Balance',
        description: `You only have ${dolaBalance.toFixed(4)} DOLA available.`,
      });
      return;
    }

    try {
      // Show pending toast
      addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the deposit transaction in your wallet.',
        duration: 30000,
      });

      // Convert amount to wei (18 decimals for DOLA)
      const amountWei = parseUnits(depositToYieldAmount, 18);

      // Execute stake: PhlimboEA.stake(amount, recipient)
      const hash = await writeStake({
        address: addresses.PhlimboEA as `0x${string}`,
        abi: phlimboEaAbi,
        functionName: 'stake',
        args: [amountWei, walletAddress],
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
      log.error('Deposit to yield failed:', error);

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
          title: 'Deposit Failed',
          description: errorMessage,
          duration: 16000,
        });
      }
    }
  };

  // Handle stake success in useEffect to prevent infinite loop
  useEffect(() => {
    if (isStakeSuccess && stakeHash) {
      const parsedAmount = parseFloat(depositToYieldAmount || '0');

      addToast({
        type: 'success',
        title: 'Deposit Successful',
        description: `Successfully deposited ${parsedAmount.toFixed(4)} DOLA to earn yield in PhlimboEA`,
        duration: 30000,
        action: {
          label: 'View Transaction',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${stakeHash}`
              : `https://sepolia.etherscan.io/tx/${stakeHash}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });

      // Clear the deposit amount
      setDepositToYieldAmount("");

      // Refetch balances
      refetchDolaBalance();
      refetchDolaAllowanceForPhlimbo();
    }
  }, [isStakeSuccess, stakeHash]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle withdraw from yield amount change
  const handleWithdrawFromYieldAmountChange = (amount: string) => {
    setWithdrawFromYieldAmount(amount);
  };

  // Mock withdraw from yield handler - simulates a successful withdrawal without actual contract interaction
  // This is a fully mocked flow - no wallet connection required
  const handleWithdrawFromYield = async () => {
    // Validate amount
    if (!withdrawFromYieldAmount || withdrawFromYieldAmount === '0' || withdrawFromYieldAmount === '') {
      addToast({
        type: 'error',
        title: 'Invalid Amount',
        description: 'Please enter a valid amount greater than 0.',
      });
      return;
    }

    // Mock staked balance check (60 phUSD staked as per story spec)
    const MOCK_STAKED_BALANCE = 60;
    const parsedAmount = parseFloat(withdrawFromYieldAmount);
    if (parsedAmount > MOCK_STAKED_BALANCE) {
      addToast({
        type: 'error',
        title: 'Insufficient Staked Balance',
        description: `You only have ${MOCK_STAKED_BALANCE.toFixed(4)} phUSD staked.`,
      });
      return;
    }

    try {
      setIsWithdrawingFromYield(true);

      // Calculate proportional yield (mock values from story)
      const MOCK_PHUSD_YIELD = 2;
      const MOCK_USDC_YIELD = 7.3;
      const withdrawalPercentage = parsedAmount / MOCK_STAKED_BALANCE;
      const phUsdYield = (MOCK_PHUSD_YIELD * withdrawalPercentage).toFixed(4);
      const usdcYield = (MOCK_USDC_YIELD * withdrawalPercentage).toFixed(4);
      const totalPhUsd = (parsedAmount + parseFloat(phUsdYield)).toFixed(4);

      // Show pending toast
      addToast({
        type: 'info',
        title: 'Claiming Yield',
        description: 'Processing your withdrawal and claim transaction...',
        duration: 3000,
      });

      // Simulate a delay to mimic transaction processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Show success toast
      addToast({
        type: 'success',
        title: 'Claim Successful (Mock)',
        description: `Successfully withdrew ${parsedAmount.toFixed(4)} phUSD principal + ${phUsdYield} phUSD yield + ${usdcYield} USDC yield (Total: ${totalPhUsd} phUSD + ${usdcYield} USDC)`,
        duration: 8000,
      });

      // Clear the withdraw amount
      setWithdrawFromYieldAmount("");

    } catch (error) {
      log.error('Mock withdraw from yield failed:', error);
      addToast({
        type: 'error',
        title: 'Withdrawal Failed',
        description: 'An error occurred during the withdrawal transaction.',
        duration: 8000,
      });
    } finally {
      setIsWithdrawingFromYield(false);
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
            {activeTab === "Mint" ? (
              <ErrorBoundary>
                <MintForm
                  amount={mintAmount}
                  onAmountChange={handleMintAmountChange}
                  tokenInfo={mintTokenInfo}
                  onMint={handleMint}
                  onApprove={handleDolaApproval}
                  isTransacting={isMintPending || isMintConfirming || approvalTransaction.state.isPending || approvalTransaction.state.isConfirming}
                  needsApproval={needsDolaApproval && mintAmountWei > 0n}
                  isAllowanceLoading={dolaAllowanceLoading}
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
              <ErrorBoundary>
                <DepositToYieldForm
                  amount={depositToYieldAmount}
                  onAmountChange={handleDepositToYieldAmountChange}
                  tokenInfo={mintTokenInfo}
                  onDeposit={handleDepositToYield}
                  onApprove={handleDolaApprovalForDeposit}
                  isTransacting={isStakePending || isStakeConfirming || depositApprovalTransaction.state.isPending || depositApprovalTransaction.state.isConfirming}
                  needsApproval={needsDolaApprovalForDeposit && depositAmountWei > 0n}
                  isAllowanceLoading={dolaAllowanceForPhlimboLoading}
                  isPaused={isPaused === true}
                />
              </ErrorBoundary>
            ) : activeTab === "Withdraw" ? (
              <ErrorBoundary>
                <WithdrawFromYieldForm
                  amount={withdrawFromYieldAmount}
                  onAmountChange={handleWithdrawFromYieldAmountChange}
                  onWithdraw={handleWithdrawFromYield}
                  isTransacting={isWithdrawingFromYield}
                  isPaused={isPaused === true}
                />
              </ErrorBoundary>
            ) : activeTab === "Yield Funnel" ? (
              <ErrorBoundary>
                <YieldFunnelTab />
              </ErrorBoundary>
            ) : null}
          </div>
        </section>

        {/* Right: ContextBox (tab-driven) and FAQ */}
        <aside className="lg:col-span-1 space-y-6">
          <ContextBox visible={activeTab === "Deposit" || activeTab === "Withdraw"}>
            {(activeTab === "Deposit" || activeTab === "Withdraw") && (
              <YieldRewardsInfo
                totalApy={mockYieldData.totalApy}
                phUsdApy={mockYieldData.phUsdApy}
                usdcApy={mockYieldData.usdcApy}
                pendingPhUsd={mockYieldData.pendingPhUsd}
                pendingUsdc={mockYieldData.pendingUsdc}
                stakedBalance={mockYieldData.stakedBalance}
                isLoading={false}
                isConnected={true} // Mock: always show fake rewards data for now
                onClaim={handleClaim}
                isClaiming={isClaiming}
              />
            )}
          </ContextBox>

          {/* FAQ Component */}
          <FAQ componentName={faqComponent} />
        </aside>
      </main>
    </div>
  );
}
