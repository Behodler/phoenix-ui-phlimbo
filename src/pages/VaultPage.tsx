import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import type { Tab, TokenInfo } from '../types/vault';
import { PATH_TO_TAB, TAB_TO_PATH, DEFAULT_PATH } from '../lib/tabRoutes';
import { useToast } from '../components/ui/ToastProvider';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { parseUnits, maxUint256 } from 'viem';
import { phlimboV2Abi, phusdStableMinterAbi } from '@behodler/phase2-wagmi-hooks';
import { useTokenBalance, useTokenAllowance, useTokenApproval, useBalancerPrice, usePriceInterpolation } from '../hooks';
import { useWalletBalances } from '../contexts/WalletBalancesContext';
import { useApprovalTransaction } from '../hooks/useTransaction';
import { getErrorTitle, shouldOfferRetry } from '../utils/transactionErrors';
import Header from '../components/layout/Header';
import TabNavigation from '../components/ui/TabNavigation';
import MintForm from '../components/vault/MintForm';
import TestnetFaucet from '../components/vault/TestnetFaucet';
import EmergencyPauseFooter from '../components/vault/EmergencyPauseFooter';
import YieldFunnelTab from '../components/vault/YieldFunnelTab';
import MarketTab from '../components/vault/MarketTab';
import NFTListTab, { type NFTSubTab } from '../components/vault/NFTListTab';
import StakeTab from '../components/vault/stake/StakeTab';
import Admin from '../components/vault/Admin';
import FAQ from '../components/vault/FAQ';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import DOLA from "../assets/sDOLA.png";
import USDC from "../assets/usdc-logo.svg";
import USDe from "../assets/USDe.png";
import { isAllowlistedAdmin } from '../lib/adminAllowlist';
import { log } from '../utils/logger';

// Mint token symbol union — single source of truth used by VaultPage and MintForm
export type MintTokenSymbol = 'DOLA' | 'USDC' | 'USDe';

// Configuration entry describing a single selectable mint token
export interface MintTokenConfig {
  symbol: MintTokenSymbol;
  name: string;            // Human-readable name ("DOLA" / "USD Coin")
  address: string | undefined; // Contract address — may be undefined before wallet connect
  decimals: number;        // Token decimals (18 for DOLA, 6 for USDC)
  icon: string;            // Imported asset icon
  balance: number;         // Human-readable balance
  balanceRaw: bigint;      // Raw on-chain balance
  balanceUsd: number;      // Dollar value (1:1 assumption for stablecoins)
}

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

  // Fetch USDe balance for connected wallet (used by Mint tab when USDe is selected)
  const {
    balance: usdeBalanceRaw,
    refetch: refetchUsdeBalance
  } = useTokenBalance(
    walletAddress,
    addresses?.USDe as `0x${string}` | undefined
  );

  // Fetch USDe allowance for PhusdStableMinter contract (for Mint tab when USDe is selected)
  const {
    allowance: usdeAllowanceRaw,
    isLoading: usdeAllowanceLoading,
    refetch: refetchUsdeAllowance
  } = useTokenAllowance(
    walletAddress,
    addresses?.PhusdStableMinter as `0x${string}` | undefined,
    addresses?.USDe as `0x${string}` | undefined
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
    abi: phlimboV2Abi,
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

  // Tab state needs to be declared early for DepositView polling.
  // Initial value is derived from the URL so a hard reload on /staking
  // or /nft starts on the right tab without a mount-time effect.
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>(
    () => PATH_TO_TAB[location.pathname] ?? "Mint"
  );

  // URL → tab sync. Handles browser back/forward navigation across the
  // deep-linked routes. Intentionally does not depend on `activeTab` —
  // including it would create an outbound→inbound loop with the tab-click
  // handler below.
  useEffect(() => {
    const tabFromUrl = PATH_TO_TAB[location.pathname];
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const [nftSubTab, setNftSubTab] = useState<NFTSubTab>('mint');

  // ========== BALANCER PRICE FOR MARKET TAB ==========
  // Fetch phUSD market price from Balancer 50/50 balanced pool (Market tab).
  const {
    price: phUsdMarketPrice,
    isLoading: isMarketPriceLoading,
    isError: isMarketPriceError,
  } = useBalancerPrice();
  const { displayPrice: phUsdDisplayPrice } = usePriceInterpolation(phUsdMarketPrice);
  // ========== END BALANCER PRICE FOR MARKET TAB ==========

  // NOTE (story 069): the legacy Deposit/Withdraw tabs were removed. Their
  // phUSD stake/withdraw/claim functionality now lives on the Stake tab's
  // phUSD panel (usePhUsdStakePool), which owns its own DepositView polling.
  // The DepositView polling + USDC/phUSD APY derivations that previously fed
  // those tabs (and their ContextBox/YieldRewardsInfo) were removed here.

  // Determine tabs based on network and owner status
  // - Show Admin tab if user is the owner
  // - Show Testnet Faucet if not on mainnet
  // - Show Market tab only on mainnet
  // - Show Mint tab for 1:1 DOLA to phUSD minting
  // - Show Stake tab for phUSD + stablecoin staking
  // - Show Yield Funnel tab for claiming accumulated yield at a discount
  // - Safety/Emergency Pause is handled by the fixed footer, not a tab
  const tabs: readonly Tab[] = (() => {
    if (!isMounted) {
      return ["Mint", "Stake", "Yield Funnel"];
    }

    const tabList: Tab[] = ["Mint", "Stake", "Yield Funnel"];

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

  // Form state for the mint operation
  const [mintAmount, setMintAmount] = useState<string>("");

  // Mint token type state - default to USDC to preserve existing behavior
  const [mintTokenType, setMintTokenType] = useState<MintTokenSymbol>('USDC');

  // Select a specific mint token by symbol
  const selectMintToken = (symbol: MintTokenSymbol) => {
    setMintTokenType(symbol);
  };

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

  // Convert USDe balance from raw bigint to display format (USDe has 18 decimals)
  const usdeBalance = usdeBalanceRaw ? parseFloat((Number(usdeBalanceRaw) / 1e18).toFixed(4)) : 0;

  // Single source of truth for all selectable mint tokens.
  // Adding a new token here drives every downstream lookup below (info, decimals, mint handler)
  // without touching the UI branches.
  const mintTokens: MintTokenConfig[] = [
    {
      symbol: 'DOLA',
      name: 'DOLA',
      address: addresses?.Dola,
      decimals: 18,
      icon: DOLA,
      balance: dolaBalance,
      balanceRaw: dolaBalanceRaw ?? 0n,
      balanceUsd: dolaBalance, // 1:1 USD assumption
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: addresses?.USDC,
      decimals: 6,
      icon: USDC,
      balance: usdcBalance,
      balanceRaw: usdcBalanceRaw ?? 0n,
      balanceUsd: usdcBalance, // 1:1 USD assumption
    },
    {
      symbol: 'USDe',
      name: 'USDe',
      address: addresses?.USDe,
      decimals: 18,
      icon: USDe,
      balance: usdeBalance,
      balanceRaw: usdeBalanceRaw ?? 0n,
      balanceUsd: usdeBalance, // 1:1 USD assumption (consistent with DOLA/USDC)
    },
  ];

  // Look up the active mint token entry. Fall back to the first token if somehow not found.
  const activeMintToken: MintTokenConfig =
    mintTokens.find((t) => t.symbol === mintTokenType) ?? mintTokens[0];

  // Real token info for the Mint tab sourced from the active mint token entry
  const mintTokenInfo: TokenInfo = {
    name: activeMintToken.name,
    balance: activeMintToken.balance,
    balanceUsd: activeMintToken.balanceUsd,
    balanceRaw: activeMintToken.balanceRaw,
    icon: activeMintToken.icon,
  };

  // Get current token decimals for amount conversion
  const mintTokenDecimals = activeMintToken.decimals;

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
  // For USDe: check usdeAllowanceRaw
  const currentAllowanceRaw =
    mintTokenType === 'DOLA' ? dolaAllowanceRaw :
    mintTokenType === 'USDC' ? usdcAllowanceRaw :
    usdeAllowanceRaw;
  const needsMintTokenApproval = currentAllowanceRaw !== undefined
    ? currentAllowanceRaw < mintAmountWei
    : true; // Default to needing approval if allowance hasn't loaded yet

  // Current allowance loading state
  const mintAllowanceLoading =
    mintTokenType === 'DOLA' ? dolaAllowanceLoading :
    mintTokenType === 'USDC' ? usdcAllowanceLoading :
    usdeAllowanceLoading;

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

  // USDe approval transaction state management (for Mint tab when USDe is selected)
  const usdeApprovalTransaction = useApprovalTransaction(
    async () => {
      if (!addresses?.USDe || !addresses?.PhusdStableMinter) {
        throw new Error('Contract addresses not loaded');
      }
      // Approve unlimited amount for better UX (single approval)
      return approve(
        addresses.USDe as `0x${string}`,
        addresses.PhusdStableMinter as `0x${string}`,
        maxUint256
      );
    },
    {
      onSuccess: async (hash) => {
        await refetchUsdeAllowance();

        addToast({
          type: 'success',
          title: 'Approval Successful',
          description: 'USDe spending has been approved for minting phUSD.',
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
        log.error('USDe approval failed:', error);
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

    const tokenAddress =
      mintTokenType === 'DOLA' ? addresses?.Dola :
      mintTokenType === 'USDC' ? addresses?.USDC :
      addresses?.USDe;
    if (!tokenAddress || !addresses?.PhusdStableMinter) {
      addToast({
        type: 'error',
        title: 'Contract Not Ready',
        description: 'Please wait for contract addresses to load.',
      });
      return;
    }

    // Use the appropriate approval transaction based on token type
    const currentApprovalTransaction =
      mintTokenType === 'DOLA' ? approvalTransaction :
      mintTokenType === 'USDC' ? usdcApprovalTransaction :
      usdeApprovalTransaction;

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

    // Look up the correct token address and balance from the active mint token entry
    const tokenAddress = activeMintToken.address;
    const currentBalance = activeMintToken.balance;

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
      refetchUsdeBalance();
      refetchPhUsdBalance();
      refetchDolaAllowance();
      refetchUsdcAllowance();
      refetchUsdeAllowance();

      // Refresh navbar wallet balances
      refreshWalletBalances();
    }
  }, [isMintSuccess, mintHash]); // eslint-disable-line react-hooks/exhaustive-deps
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
                if (!["Mint", "Yield Funnel", "Market", "NFT"].includes(tab)) {
                  setFaqComponent(undefined);
                }
                // Sync URL with the active tab when it maps to a friendly
                // path. Tabs without a friendly path fall back to "/".
                // `replace: false` pushes a history entry so the browser
                // back button walks through prior tab selections.
                const targetPath = TAB_TO_PATH[tab] ?? DEFAULT_PATH;
                if (targetPath !== location.pathname) {
                  navigate(targetPath, { replace: false });
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
                  mintTokens={mintTokens}
                  mintTokenType={mintTokenType}
                  onSelectMintToken={selectMintToken}
                  tokenDecimals={mintTokenDecimals}
                />
              </ErrorBoundary>
            ) : activeTab === "Stake" ? (
              <ErrorBoundary>
                <StakeTab />
              </ErrorBoundary>
            ) : activeTab === "Testnet Faucet" ? (
              <TestnetFaucet />
            ) : activeTab === "Admin" ? (
              <Admin />
            ) : activeTab === "Yield Funnel" ? (
              <ErrorBoundary>
                <YieldFunnelTab isPaused={isPaused === true} />
              </ErrorBoundary>
            ) : activeTab === "Market" ? (
              <ErrorBoundary>
                <MarketTab
                  price={phUsdMarketPrice}
                  displayPrice={phUsdDisplayPrice}
                  isLoading={isMarketPriceLoading}
                  isError={isMarketPriceError}
                />
              </ErrorBoundary>
            ) : activeTab === "NFT" ? (
              <ErrorBoundary>
                <NFTListTab subTab={nftSubTab} onSubTabChange={setNftSubTab} canSeeStakePreview={hasAdminAccess} />
              </ErrorBoundary>
            ) : null}
          </div>

          {/* Whale Mint (nudge) panel hidden alongside the Liquid Sky Phoenix row. */}
        </section>

        {/* Right: FAQ */}
        <aside className="space-y-6">
          {/* FAQ Component */}
          <FAQ componentName={faqComponent} />
        </aside>
      </main>

      <EmergencyPauseFooter />
    </div>
  );
}
