import { useState, useEffect } from 'react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import type { Tab, TokenInfo } from '../types/vault';
import { useToast } from '../components/ui/ToastProvider';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { parseUnits } from 'viem';
import { phlimboEaAbi } from '@behodler/phase2-wagmi-hooks';
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

  // State for mock transactions
  const [isMinting, setIsMinting] = useState(false);
  const [isDepositingToYield, setIsDepositingToYield] = useState(false);
  const [isWithdrawingFromYield, setIsWithdrawingFromYield] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // Pause state - in the new architecture, we'll use a simple mock for now
  // TODO: Fetch actual pause state from the appropriate Phase 2 contract
  const [isPaused] = useState(false);

  // Toast notifications
  const { addToast } = useToast();

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

  // Handle deposit to yield amount change
  const handleDepositToYieldAmountChange = (amount: string) => {
    setDepositToYieldAmount(amount);
  };

  // Mock deposit to yield handler - simulates a successful deposit without actual contract interaction
  // This is a fully mocked flow - no wallet connection required
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

    // Check against mock balance (no real blockchain balance needed)
    const parsedAmount = parseFloat(depositToYieldAmount);
    if (parsedAmount > MOCK_DOLA_BALANCE) {
      addToast({
        type: 'error',
        title: 'Insufficient Balance',
        description: `You only have ${MOCK_DOLA_BALANCE.toFixed(4)} DOLA available.`,
      });
      return;
    }

    try {
      setIsDepositingToYield(true);

      // Show pending toast
      addToast({
        type: 'info',
        title: 'Depositing DOLA',
        description: 'Processing your deposit transaction...',
        duration: 3000,
      });

      // Simulate a delay to mimic transaction processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Show success toast
      addToast({
        type: 'success',
        title: 'Deposit Successful (Mock)',
        description: `Successfully deposited ${parsedAmount.toFixed(4)} DOLA to earn yield in phUSD and USDC`,
        duration: 8000,
      });

      // Clear the deposit amount
      setDepositToYieldAmount("");

    } catch (error) {
      log.error('Mock deposit to yield failed:', error);
      addToast({
        type: 'error',
        title: 'Deposit Failed',
        description: 'An error occurred during the deposit transaction.',
        duration: 8000,
      });
    } finally {
      setIsDepositingToYield(false);
    }
  };

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
              <ErrorBoundary>
                <DepositToYieldForm
                  amount={depositToYieldAmount}
                  onAmountChange={handleDepositToYieldAmountChange}
                  tokenInfo={mintTokenInfo}
                  onDeposit={handleDepositToYield}
                  isTransacting={isDepositingToYield}
                  needsApproval={false}  // Mock flow - no approval needed
                  isAllowanceLoading={false}  // Mock flow - no allowance check
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
