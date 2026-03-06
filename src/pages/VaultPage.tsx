import { useState, useEffect } from 'react';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import type { Tab, TokenInfo } from '../types/vault';
import { useToast } from '../components/ui/ToastProvider';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { parseUnits, maxUint256 } from 'viem';
import { phlimboEaAbi, phusdStableMinterAbi } from '@behodler/phase2-wagmi-hooks';
import { useTokenBalance, useTokenAllowance, useTokenApproval, useDepositViewPolling, useBalancerPrice } from '../hooks';
import { useWalletBalances } from '../contexts/WalletBalancesContext';
import { useApprovalTransaction } from '../hooks/useTransaction';
import { getErrorTitle, shouldOfferRetry } from '../utils/transactionErrors';
import Header from '../components/layout/Header';
import TabNavigation from '../components/ui/TabNavigation';
import MintForm from '../components/vault/MintForm';
import DepositToYieldForm from '../components/vault/DepositToYieldForm';
import WithdrawFromYieldForm from '../components/vault/WithdrawFromYieldForm';
import TestnetFaucet from '../components/vault/TestnetFaucet';
import EmergencyPauseFooter from '../components/vault/EmergencyPauseFooter';
import YieldFunnelTab from '../components/vault/YieldFunnelTab';
import MarketTab from '../components/vault/MarketTab';
import NFTListTab from '../components/vault/NFTListTab';
import Admin from '../components/vault/Admin';
import ContextBox from '../components/vault/ContextBox';
import YieldRewardsInfo from '../components/vault/YieldRewardsInfo';
import FAQ from '../components/vault/FAQ';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import DOLA from "../assets/sDOLA.png";
import USDC from "../assets/usdc-logo.svg";
import phUSDIcon from "../assets/phUSD.png";
import { isAllowlistedAdmin } from '../lib/adminAllowlist';
import { log } from '../utils/logger';

// Mint token type for switching between DOLA and USDC
type MintTokenType = 'DOLA' | 'USDC';

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

  // Wallet balances context - for refreshing navbar balances after transactions
  const { refreshWalletBalances } = useWalletBalances();

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

  // Fetch DOLA balance for connected wallet (used by Mint tab)
  const {
    balance: dolaBalanceRaw,
    refetch: refetchDolaBalance
  } = useTokenBalance(
    walletAddress,
    addresses?.Dola as `0x${string}` | undefined
  );

  // NOTE: phUSD balance for Deposit tab now comes from DepositView polling hook (phUsdBalanceFromView)
  // This individual hook is kept as fallback for non-Deposit tab contexts

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

  // Fetch USDC balance for connected wallet (used by Mint tab when USDC is selected)
  const {
    balance: usdcBalanceRaw,
    refetch: refetchUsdcBalance
  } = useTokenBalance(
    walletAddress,
    addresses?.USDC as `0x${string}` | undefined
  );

  // Fetch USDC allowance for PhusdStableMinter contract (for Mint tab when USDC is selected)
  const {
    allowance: usdcAllowanceRaw,
    isLoading: usdcAllowanceLoading,
    refetch: refetchUsdcAllowance
  } = useTokenAllowance(
    walletAddress,
    addresses?.PhusdStableMinter as `0x${string}` | undefined,
    addresses?.USDC as `0x${string}` | undefined
  );

  // NOTE: phUSD allowance for PhlimboEA now comes from DepositView polling hook (phUsdAllowanceFromView)
  // Loading state for allowance comes from DepositView

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

  // Check if wallet has admin access (owner OR allowlisted)
  const hasAdminAccess = isOwner || isAllowlistedAdmin(chainId, walletAddress);

  // Tab state needs to be declared early for DepositView polling
  const [activeTab, setActiveTab] = useState<Tab>("Mint");

  // ========== DEPOSITVIEW POLLING ==========
  // Use DepositView contract for consolidated Deposit tab data
  // Polling is active only when Deposit or Withdraw tab is selected
  const isDepositTabActive = activeTab === "Deposit" || activeTab === "Withdraw";
  const {
    data: depositViewData,
    isLoading: depositViewLoading,
    refresh: refreshDepositView,
  } = useDepositViewPolling(isDepositTabActive);

  // Extract values from DepositView data (replaces individual contract calls)
  const phUsdBalanceFromView = depositViewData?.userPhUSDBalance ?? 0n;
  const pendingPhUsdFromView = depositViewData?.pendingPhUSDRewards ?? 0n;
  const pendingStableFromView = depositViewData?.pendingStableRewards ?? 0n;
  const stakedBalanceFromView = depositViewData?.stakedBalance ?? 0n;
  const phUsdAllowanceFromView = depositViewData?.userAllowance ?? 0n;
  // phUSDRewardsPerSecond is available but not currently used (fixed APY from desiredAPYBps)
  const stableRewardsPerSecondFromView = depositViewData?.stableRewardsPerSecond ?? 0n;
  // ========== END DEPOSITVIEW POLLING ==========

  // ========== YIELD DATA READS FOR CONTEXTBOX ==========
  // Most yield data now comes from DepositView polling hook
  // We still need poolInfo for totalStaked and desiredAPYBps for phUSD APY

  // Fetch pool info to get totalStaked: getPoolInfo returns (totalStaked, accPhUSDPerShare, accStablePerShare, phUSDPerSecond, lastRewardTime)
  const { data: poolInfoData, isLoading: poolInfoLoading } = useReadContract({
    address: addresses?.PhlimboEA as `0x${string}` | undefined,
    abi: phlimboEaAbi,
    functionName: 'getPoolInfo',
    query: {
      enabled: !!addresses?.PhlimboEA,
    },
  });

  // Fetch desiredAPYBps for fixed phUSD APY (value in basis points, e.g., 1000 = 10%)
  const { data: desiredAPYBpsRaw, isLoading: desiredAPYBpsLoading } = useReadContract({
    address: addresses?.PhlimboEA as `0x${string}` | undefined,
    abi: phlimboEaAbi,
    functionName: 'desiredAPYBps',
    query: {
      enabled: !!addresses?.PhlimboEA,
    },
  });

  // Extract totalStaked from poolInfo (still needed for APY denominator)
  const totalStakedRaw = poolInfoData ? (poolInfoData as [bigint, bigint, bigint, bigint, bigint])[0] : 0n;

  // Calculate phUSD APY: desiredAPYBps / 100 gives percentage
  const phUsdApyCalculated = desiredAPYBpsRaw
    ? Number(desiredAPYBpsRaw) / 100
    : 0;

  // ========== BALANCER PRICE FOR MARKET TAB ==========
  // Fetch phUSD market price from Balancer e-CLP pool
  // This hook is called here so price data can be used in USDC APY calculation on mainnet
  const {
    price: phUsdMarketPrice,
    isLoading: isMarketPriceLoading,
    isError: isMarketPriceError,
  } = useBalancerPrice();
  // ========== END BALANCER PRICE FOR MARKET TAB ==========

  // ========== USDC APY CALCULATION ==========
  // APY Methodology: Per-second reward rate extrapolated to annual yield
  //
  // Formula: APY = (rewardsPerSecond * secondsPerYear / totalStaked) * 100
  //
  // Key points:
  // 1. rewardsPerSecond comes from the contract (scaled by 1e18)
  // 2. USDC rewards have 6 decimals, so we divide by 1e6 to get human values
  // 3. On mainnet, we adjust the denominator by phUSD market price to express
  //    APY in terms of USD value rather than token quantity
  // 4. When phUSD trades below $1, the USD-denominated APY increases because
  //    the same phUSD quantity represents less USD value
  //
  // stableRewardsPerSecond from DepositView represents the USDC rewards rate
  // On mainnet (chainId === 1), adjust denominator by phUSD market price
  const usdcApyCalculated = (() => {
    const rewardsRate = stableRewardsPerSecondFromView ? Number(stableRewardsPerSecondFromView) : 0;
    const secondsPerYear = 31536000;

    // Determine denominator: use totalStaked if non-zero, otherwise use user's phUSD balance
    let denominatorInPhUsd: number;
    if (totalStakedRaw > 0n) {
      // totalStaked is 18 decimals, convert to number
      denominatorInPhUsd = Number(totalStakedRaw) / 1e18;
    } else if (phUsdBalanceFromView > 0n) {
      // Fallback to user's phUSD balance if totalStaked is 0
      denominatorInPhUsd = Number(phUsdBalanceFromView) / 1e18;
    } else {
      return 0; // No valid denominator
    }

    if (denominatorInPhUsd === 0) return 0;

    // Determine phUSD price multiplier for mainnet adjustment
    // On mainnet: use actual market price if valid, otherwise default to $1
    // On testnets: always use $1 (original behavior)
    let phUsdPriceMultiplier = 1.0;
    if (isMainnet && phUsdMarketPrice !== null) {
      // Bounds checking: only use market price if within reasonable range (0 < price <= 2.0)
      // Price of 0 or negative would cause division issues
      // Price > 2.0 is unreasonable and likely an oracle error
      if (phUsdMarketPrice > 0 && phUsdMarketPrice <= 2.0) {
        phUsdPriceMultiplier = phUsdMarketPrice;
      }
      // If price is outside bounds, fallback to 1.0 (already set)
    }

    // Convert phUSD denominator to USD value
    // When phUSD < $1, this reduces the denominator, increasing the effective APY
    const denominatorInUsd = denominatorInPhUsd * phUsdPriceMultiplier;

    // rewardPerSecond is scaled by 1e18, and represents USDC (6 decimals) per second
    // Annual USDC yield = (rewardsRate / 1e18) * secondsPerYear
    // APY = (annualYield / totalStaked) * 100
    // Since USDC has 6 decimals and phUSD has 18 decimals, we need to normalize:
    // annualUsdcInUsdValue = (rewardsRate / 1e18) * secondsPerYear / 1e6 (to get USDC value)
    // denominator is now in USD terms (phUSD quantity * phUSD price)
    // So: APY = ((rewardsRate / 1e18) * secondsPerYear / 1e6) / denominatorInUsd * 100
    const annualUsdcRaw = (rewardsRate / 1e18) * secondsPerYear;
    // Convert from 6 decimals to actual USDC value
    const annualUsdcValue = annualUsdcRaw / 1e6;
    const apy = (annualUsdcValue / denominatorInUsd) * 100;

    return apy;
  })();

  // Total APY is the sum of phUSD and USDC APYs
  const totalApyCalculated = phUsdApyCalculated + usdcApyCalculated;

  // Combined loading state for yield data (now using DepositView loading state)
  const yieldDataLoading = depositViewLoading || poolInfoLoading || desiredAPYBpsLoading;
  // ========== END YIELD DATA READS FOR CONTEXTBOX ==========

  // Determine tabs based on network and owner status
  // - Show Admin tab if user is the owner
  // - Show Testnet Faucet if not on mainnet
  // - Show Market tab only on mainnet
  // - Show Mint tab for 1:1 DOLA to phUSD minting
  // - Show Deposit and Withdraw tabs for ContextBox-driven content
  // - Show Yield Funnel tab for claiming accumulated yield at a discount
  // - Safety/Emergency Pause is handled by the fixed footer, not a tab
  const tabs: readonly Tab[] = (() => {
    if (!isMounted) {
      return ["Mint", "Deposit", "Withdraw", "Yield Funnel"];
    }

    const tabList: Tab[] = ["Mint", "Deposit", "Withdraw", "Yield Funnel"];

    if (!isMainnet) {
      tabList.push("Testnet Faucet");
    }

    // Market tab is only available on mainnet
    if (isMainnet) {
      tabList.push("Market");
    }

    tabList.push("NFT");

    if (hasAdminAccess) {
      tabList.push("Admin");
    }

    return tabList;
  })();

  // FAQ state - tracks which FAQ context to display
  // Initialize to "MintTab" to match the default activeTab ("Mint")
  const [faqComponent, setFaqComponent] = useState<string | undefined>("MintTab");

  // Set mounted state after initial render to prevent flickering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Form state for mint and yield operations
  const [mintAmount, setMintAmount] = useState<string>("");
  const [depositToYieldAmount, setDepositToYieldAmount] = useState<string>("");
  const [withdrawFromYieldAmount, setWithdrawFromYieldAmount] = useState<string>("");

  // Mint token type state - for switching between DOLA and USDC
  const [mintTokenType, setMintTokenType] = useState<MintTokenType>('USDC');

  // Toggle function for mint token switching
  const toggleMintToken = () => {
    setMintTokenType(prev => prev === 'DOLA' ? 'USDC' : 'DOLA');
  };

  // State for transaction UI (all core transactions are now real: mint, deposit, withdraw, claim)
  const [isWithdrawingFromYield, setIsWithdrawingFromYield] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // Pause state - read from PhusdStableMinter contract (all pausable contracts are paused/unpaused together)
  // Standard OpenZeppelin Pausable ABI fragment
  const pausableAbi = [{
    type: 'function',
    name: 'paused',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view'
  }] as const;

  const { data: isPaused } = useReadContract({
    address: addresses?.PhusdStableMinter as `0x${string}` | undefined,
    abi: pausableAbi,
    functionName: 'paused',
    query: {
      enabled: !!addresses?.PhusdStableMinter,
    },
  });

  // Toast notifications
  const { addToast } = useToast();

  // Convert DOLA balance from raw bigint to display format
  const dolaBalance = dolaBalanceRaw ? parseFloat((Number(dolaBalanceRaw) / 1e18).toFixed(4)) : 0;

  // Convert USDC balance from raw bigint to display format (USDC has 6 decimals)
  const usdcBalance = usdcBalanceRaw ? parseFloat((Number(usdcBalanceRaw) / 1e6).toFixed(4)) : 0;

  // Convert phUSD balance from raw bigint to display format (for Deposit tab)
  // Now using DepositView data (phUsdBalanceFromView)
  const phUsdBalance = phUsdBalanceFromView ? parseFloat((Number(phUsdBalanceFromView) / 1e18).toFixed(4)) : 0;

  // Real token info for the Mint tab - conditional based on selected mint token type
  const mintTokenInfo: TokenInfo = mintTokenType === 'DOLA'
    ? {
        name: "DOLA",
        balance: dolaBalance,
        balanceUsd: dolaBalance, // 1:1 USD value assumption for stablecoins
        balanceRaw: dolaBalanceRaw ?? 0n,
        icon: DOLA
      }
    : {
        name: "USDC",
        balance: usdcBalance,
        balanceUsd: usdcBalance, // 1:1 USD value assumption for stablecoins
        balanceRaw: usdcBalanceRaw ?? 0n,
        icon: USDC
      };

  // Get current token decimals for amount conversion
  const mintTokenDecimals = mintTokenType === 'DOLA' ? 18 : 6;

  // Real token info for the Deposit tab using DepositView phUSD balance
  // Use market price for USD value on mainnet, fallback to 1:1 for testnets
  const phUsdPriceForBalance = (isMainnet && phUsdMarketPrice !== null && phUsdMarketPrice > 0 && phUsdMarketPrice <= 2.0)
    ? phUsdMarketPrice
    : 1.0;
  const depositTokenInfo: TokenInfo = {
    name: "phUSD",
    balance: phUsdBalance,
    balanceUsd: phUsdBalance * phUsdPriceForBalance,
    balanceRaw: phUsdBalanceFromView ?? 0n,
    icon: phUSDIcon
  };

  // Check if approval is needed for the current mint amount
  // Convert mint amount to wei for comparison with allowance (using appropriate decimals)
  const mintAmountWei = mintAmount && mintAmount !== '' && mintAmount !== '0'
    ? (() => {
        try {
          return parseUnits(mintAmount, mintTokenDecimals);
        } catch {
          return 0n;
        }
      })()
    : 0n;

  // Needs approval based on selected token type
  // For DOLA: check dolaAllowanceRaw
  // For USDC: check usdcAllowanceRaw
  const currentAllowanceRaw = mintTokenType === 'DOLA' ? dolaAllowanceRaw : usdcAllowanceRaw;
  const needsMintTokenApproval = currentAllowanceRaw !== undefined
    ? currentAllowanceRaw < mintAmountWei
    : true; // Default to needing approval if allowance hasn't loaded yet

  // Current allowance loading state
  const mintAllowanceLoading = mintTokenType === 'DOLA' ? dolaAllowanceLoading : usdcAllowanceLoading;

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

  // Needs approval for deposit if phUSD allowance is less than the deposit amount being requested
  // Using DepositView data (phUsdAllowanceFromView) instead of individual contract call
  const needsPhUsdApprovalForDeposit = phUsdAllowanceFromView !== undefined
    ? phUsdAllowanceFromView < depositAmountWei
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

  // USDC approval transaction state management (for Mint tab when USDC is selected)
  const usdcApprovalTransaction = useApprovalTransaction(
    async () => {
      if (!addresses?.USDC || !addresses?.PhusdStableMinter) {
        throw new Error('Contract addresses not loaded');
      }
      // Approve unlimited amount for better UX (single approval)
      return approve(
        addresses.USDC as `0x${string}`,
        addresses.PhusdStableMinter as `0x${string}`,
        maxUint256
      );
    },
    {
      onSuccess: async (hash) => {
        await refetchUsdcAllowance();

        addToast({
          type: 'success',
          title: 'Approval Successful',
          description: 'USDC spending has been approved for minting phUSD.',
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
        log.error('USDC approval failed:', error);
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

  // phUSD approval transaction for Deposit tab (approving PhlimboEA to spend phUSD)
  const depositApprovalTransaction = useApprovalTransaction(
    async () => {
      if (!addresses?.PhUSD || !addresses?.PhlimboEA) {
        throw new Error('Contract addresses not loaded');
      }
      // Approve unlimited amount for better UX (single approval)
      return approve(
        addresses.PhUSD as `0x${string}`,
        addresses.PhlimboEA as `0x${string}`,
        maxUint256
      );
    },
    {
      onSuccess: async (hash) => {
        // Refresh DepositView data to get updated allowance
        refreshDepositView();

        addToast({
          type: 'success',
          title: 'Approval Successful',
          description: 'phUSD spending has been approved for depositing to PhlimboEA.',
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
        log.error('phUSD approval for deposit failed:', error);
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

  // Claim transaction state for PhlimboEA.claim()
  const { data: claimHash, writeContractAsync: writeClaim, isPending: isClaimPending } = useWriteContract();
  const { isLoading: isClaimConfirming, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({
    hash: claimHash,
    query: {
      enabled: !!claimHash,
    },
  });

  // Withdraw transaction state for PhlimboEA.withdraw()
  const { data: withdrawHash, writeContractAsync: writeWithdraw, isPending: isWithdrawPending } = useWriteContract();
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({
    hash: withdrawHash,
    query: {
      enabled: !!withdrawHash,
    },
  });

  // Real claim handler - calls PhlimboEA.claim() to claim pending phUSD and USDC rewards
  const handleClaim = async () => {
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
    if (!addresses?.PhlimboEA) {
      addToast({
        type: 'error',
        title: 'Contract Not Ready',
        description: 'Please wait for contract addresses to load.',
      });
      return;
    }

    try {
      setIsClaiming(true);

      // Show signing toast
      addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the claim transaction in your wallet.',
        duration: 30000,
      });

      // Execute claim: PhlimboEA.claim()
      const hash = await writeClaim({
        address: addresses.PhlimboEA as `0x${string}`,
        abi: phlimboEaAbi,
        functionName: 'claim',
      });

      // Show pending confirmation toast
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
      log.error('Claim failed:', error);

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
          title: 'Claim Failed',
          description: errorMessage,
          duration: 16000,
        });
      }

      setIsClaiming(false);
    }
  };

  // Handle claim success in useEffect to prevent infinite loop
  useEffect(() => {
    if (isClaimSuccess && claimHash) {
      // Format pending values for display in toast (these were the values before claim)
      const pendingPhUsdDisplay = pendingPhUsdFromView
        ? (Number(pendingPhUsdFromView) / 1e18).toFixed(2)
        : '0.00';
      const pendingUsdcDisplay = pendingStableFromView
        ? (Number(pendingStableFromView) / 1e6).toFixed(2)  // USDC has 6 decimals
        : '0.00';

      // Trigger DepositView refresh after successful claim
      refreshDepositView();

      addToast({
        type: 'success',
        title: 'Claim Successful',
        description: `Successfully claimed ${pendingPhUsdDisplay} phUSD and ${pendingUsdcDisplay} USDC rewards`,
        duration: 30000,
        action: {
          label: 'View Transaction',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${claimHash}`
              : `https://sepolia.etherscan.io/tx/${claimHash}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });

      setIsClaiming(false);

      log.debug('Claim completed:', {
        pendingPhUsd: pendingPhUsdDisplay,
        pendingUsdc: pendingUsdcDisplay,
        txHash: claimHash,
      });

      // Refresh navbar wallet balances (phUSD and USDC balances increase from claimed rewards)
      refreshWalletBalances();
    }
  }, [isClaimSuccess, claimHash]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle mint amount change for the Mint tab (simplified - no slippage)
  const handleMintAmountChange = (amount: string) => {
    setMintAmount(amount);
  };

  // Handle mint token approval (DOLA or USDC) for minting
  const handleMintTokenApproval = async (): Promise<void> => {
    if (!walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    const tokenAddress = mintTokenType === 'DOLA' ? addresses?.Dola : addresses?.USDC;
    if (!tokenAddress || !addresses?.PhusdStableMinter) {
      addToast({
        type: 'error',
        title: 'Contract Not Ready',
        description: 'Please wait for contract addresses to load.',
      });
      return;
    }

    // Use the appropriate approval transaction based on token type
    const currentApprovalTransaction = mintTokenType === 'DOLA'
      ? approvalTransaction
      : usdcApprovalTransaction;

    try {
      await currentApprovalTransaction.execute();
    } catch {
      if (currentApprovalTransaction.state.error) {
        const { error: txError } = currentApprovalTransaction.state;
        addToast({
          type: 'error',
          title: getErrorTitle(txError.type),
          description: txError.message,
          duration: 16000,
          action: shouldOfferRetry(txError.type) ? {
            label: 'Retry',
            onClick: () => currentApprovalTransaction.retry()
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

    // Get the correct token address based on selected mint token type
    const tokenAddress = mintTokenType === 'DOLA' ? addresses?.Dola : addresses?.USDC;
    const currentBalance = mintTokenType === 'DOLA' ? dolaBalance : usdcBalance;

    // Check contract addresses are loaded
    if (!addresses?.PhusdStableMinter || !tokenAddress) {
      addToast({
        type: 'error',
        title: 'Contract Not Ready',
        description: 'Please wait for contract addresses to load.',
      });
      return;
    }

    // Check balance
    const parsedAmount = parseFloat(mintAmount);
    if (parsedAmount > currentBalance) {
      addToast({
        type: 'error',
        title: 'Insufficient Balance',
        description: `You only have ${currentBalance.toFixed(4)} ${mintTokenType} available.`,
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

      // Convert amount to wei (18 decimals for DOLA, 6 decimals for USDC)
      const amountWei = parseUnits(mintAmount, mintTokenDecimals);

      // Execute mint: PhusdStableMinter.mint(stablecoinAddress, amount)
      const hash = await writeMint({
        address: addresses.PhusdStableMinter as `0x${string}`,
        abi: phusdStableMinterAbi,
        functionName: 'mint',
        args: [tokenAddress as `0x${string}`, amountWei],
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
        description: `Successfully minted ${parsedAmount.toFixed(4)} phUSD from ${parsedAmount.toFixed(4)} ${mintTokenType} at 1:1 rate`,
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

      // Refetch balances (page-level for Mint tab functionality)
      refetchDolaBalance();
      refetchUsdcBalance();
      refetchPhUsdBalance();
      refetchDolaAllowance();
      refetchUsdcAllowance();

      // Refresh navbar wallet balances
      refreshWalletBalances();
    }
  }, [isMintSuccess, mintHash]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle deposit to yield amount change
  const handleDepositToYieldAmountChange = (amount: string) => {
    setDepositToYieldAmount(amount);
  };

  // Handle phUSD approval for depositing to PhlimboEA
  const handlePhUsdApprovalForDeposit = async (): Promise<void> => {
    if (!walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    if (!addresses?.PhUSD || !addresses?.PhlimboEA) {
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
    if (!addresses?.PhlimboEA || !addresses?.PhUSD) {
      addToast({
        type: 'error',
        title: 'Contract Not Ready',
        description: 'Please wait for contract addresses to load.',
      });
      return;
    }

    // Check balance
    const parsedAmount = parseFloat(depositToYieldAmount);
    if (parsedAmount > phUsdBalance) {
      addToast({
        type: 'error',
        title: 'Insufficient Balance',
        description: `You only have ${phUsdBalance.toFixed(4)} phUSD available.`,
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

      // Convert amount to wei (18 decimals for phUSD)
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
        description: `Successfully deposited ${parsedAmount.toFixed(4)} phUSD to earn yield in PhlimboEA`,
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

      // Trigger DepositView refresh to update balance and allowance
      refreshDepositView();

      // Refresh navbar wallet balances (phUSD balance decreases when deposited)
      refreshWalletBalances();
    }
  }, [isStakeSuccess, stakeHash]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle withdraw from yield amount change
  const handleWithdrawFromYieldAmountChange = (amount: string) => {
    setWithdrawFromYieldAmount(amount);
  };

  // Real withdraw from yield handler - calls PhlimboEA.withdraw(amount)
  // Withdraws staked phUSD and claims proportional pending rewards
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
    if (!addresses?.PhlimboEA) {
      addToast({
        type: 'error',
        title: 'Contract Not Ready',
        description: 'Please wait for contract addresses to load.',
      });
      return;
    }

    // Use real staked balance from DepositView polling
    const stakedBalanceDisplay = Number(stakedBalanceFromView) / 1e18;
    const parsedAmount = parseFloat(withdrawFromYieldAmount);
    if (parsedAmount > stakedBalanceDisplay) {
      addToast({
        type: 'error',
        title: 'Insufficient Staked Balance',
        description: `You only have ${stakedBalanceDisplay.toFixed(4)} phUSD staked.`,
      });
      return;
    }

    try {
      setIsWithdrawingFromYield(true);

      // Show signing toast
      addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the withdrawal transaction in your wallet.',
        duration: 30000,
      });

      // Convert amount to wei (18 decimals for phUSD)
      const amountWei = parseUnits(withdrawFromYieldAmount, 18);

      // Execute withdraw: PhlimboEA.withdraw(amount)
      const hash = await writeWithdraw({
        address: addresses.PhlimboEA as `0x${string}`,
        abi: phlimboEaAbi,
        functionName: 'withdraw',
        args: [amountWei],
      });

      // Show pending confirmation toast
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
      log.error('Withdraw from yield failed:', error);
      addToast({
        type: 'error',
        title: 'Withdrawal Failed',
        description: error instanceof Error ? error.message : 'An error occurred during the withdrawal transaction.',
        duration: 8000,
      });
    } finally {
      setIsWithdrawingFromYield(false);
    }
  };

  // Handle withdraw success in useEffect to prevent infinite loop
  useEffect(() => {
    if (isWithdrawSuccess && withdrawHash) {
      const parsedAmount = parseFloat(withdrawFromYieldAmount || '0');

      // Calculate proportional yield for display using real data from DepositView
      const stakedBalanceDisplay = Number(stakedBalanceFromView) / 1e18;
      const pendingPhUsdDisplay = Number(pendingPhUsdFromView) / 1e18;
      const pendingStableDisplay = Number(pendingStableFromView) / 1e6;  // USDC has 6 decimals
      const withdrawalPercentage = stakedBalanceDisplay > 0 ? parsedAmount / stakedBalanceDisplay : 0;
      const phUsdYield = (pendingPhUsdDisplay * withdrawalPercentage).toFixed(4);
      const usdcYield = (pendingStableDisplay * withdrawalPercentage).toFixed(4);

      addToast({
        type: 'success',
        title: 'Withdrawal Successful',
        description: `Successfully withdrew ${parsedAmount.toFixed(4)} phUSD + ${phUsdYield} phUSD yield + ${usdcYield} USDC yield`,
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

      // Clear the withdraw amount
      setWithdrawFromYieldAmount("");

      // Trigger DepositView refresh after successful withdrawal
      refreshDepositView();

      // Refresh navbar wallet balances (phUSD balance increases, USDC may increase from rewards)
      refreshWalletBalances();
    }
  }, [isWithdrawSuccess, withdrawHash]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 pb-20 grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        {/* Left: Main card */}
        <section className="min-w-0">
          <div className="phoenix-card p-0 overflow-hidden">
            <TabNavigation
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                // Clear FAQ when switching to a tab that has no FAQ data
                if (!["Mint", "Deposit", "Withdraw", "Yield Funnel", "Market", "NFT"].includes(tab)) {
                  setFaqComponent(undefined);
                }
              }}
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
                  onApprove={handleMintTokenApproval}
                  isTransacting={isMintPending || isMintConfirming || approvalTransaction.state.isPending || approvalTransaction.state.isConfirming || usdcApprovalTransaction.state.isPending || usdcApprovalTransaction.state.isConfirming}
                  needsApproval={needsMintTokenApproval && mintAmountWei > 0n}
                  isAllowanceLoading={mintAllowanceLoading}
                  isPaused={isPaused === true}
                  mintTokenType={mintTokenType}
                  onToggleMintToken={toggleMintToken}
                  tokenDecimals={mintTokenDecimals}
                />
              </ErrorBoundary>
            ) : activeTab === "Testnet Faucet" ? (
              <TestnetFaucet />
            ) : activeTab === "Admin" ? (
              <Admin />
            ) : activeTab === "Deposit" ? (
              <ErrorBoundary>
                <DepositToYieldForm
                  amount={depositToYieldAmount}
                  onAmountChange={handleDepositToYieldAmountChange}
                  tokenInfo={depositTokenInfo}
                  onDeposit={handleDepositToYield}
                  onApprove={handlePhUsdApprovalForDeposit}
                  isTransacting={isStakePending || isStakeConfirming || depositApprovalTransaction.state.isPending || depositApprovalTransaction.state.isConfirming}
                  needsApproval={needsPhUsdApprovalForDeposit && depositAmountWei > 0n}
                  isAllowanceLoading={depositViewLoading}
                  isPaused={isPaused === true}
                  phUsdMarketPrice={isMainnet ? phUsdMarketPrice : null}
                />
              </ErrorBoundary>
            ) : activeTab === "Withdraw" ? (
              <ErrorBoundary>
                <WithdrawFromYieldForm
                  amount={withdrawFromYieldAmount}
                  onAmountChange={handleWithdrawFromYieldAmountChange}
                  onWithdraw={handleWithdrawFromYield}
                  isTransacting={isWithdrawingFromYield || isWithdrawPending || isWithdrawConfirming}
                  isPaused={isPaused === true}
                  stakedBalance={stakedBalanceFromView}
                  pendingPhUsdRewards={pendingPhUsdFromView}
                  pendingStableRewards={pendingStableFromView}
                  onRefresh={refreshDepositView}
                  phUsdMarketPrice={isMainnet ? phUsdMarketPrice : null}
                />
              </ErrorBoundary>
            ) : activeTab === "Yield Funnel" ? (
              <ErrorBoundary>
                <YieldFunnelTab isPaused={isPaused === true} />
              </ErrorBoundary>
            ) : activeTab === "Market" ? (
              <ErrorBoundary>
                <MarketTab
                  price={phUsdMarketPrice}
                  isLoading={isMarketPriceLoading}
                  isError={isMarketPriceError}
                />
              </ErrorBoundary>
            ) : activeTab === "NFT" ? (
              <ErrorBoundary>
                <NFTListTab />
              </ErrorBoundary>
            ) : null}
          </div>
        </section>

        {/* Right: ContextBox (tab-driven) and FAQ */}
        <aside className="space-y-6">
          <ContextBox visible={activeTab === "Deposit" || activeTab === "Withdraw"}>
            {(activeTab === "Deposit" || activeTab === "Withdraw") && (
              <YieldRewardsInfo
                totalApy={totalApyCalculated}
                phUsdApy={phUsdApyCalculated}
                usdcApy={usdcApyCalculated}
                pendingPhUsd={pendingPhUsdFromView}
                pendingUsdc={pendingStableFromView}
                stakedBalance={stakedBalanceFromView}
                isLoading={yieldDataLoading}
                isConnected={!!walletAddress}
                onClaim={handleClaim}
                isClaiming={isClaiming || isClaimPending || isClaimConfirming}
                isUsdcDecimals6={true}
              />
            )}
          </ContextBox>

          {/* FAQ Component */}
          <FAQ componentName={faqComponent} />
        </aside>
      </main>

      <EmergencyPauseFooter />
    </div>
  );
}
