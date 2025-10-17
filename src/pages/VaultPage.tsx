import { useState, useEffect, useRef } from 'react';
import { useAccount, useChainId } from 'wagmi';
import type { Tab, VaultFormData, VaultConstants, TokenInfo, PositionInfo } from '../types/vault';
import { useToast } from '../components/ui/ToastProvider';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { useTokenBalance, useTokenAllowance, useTokenApproval, useBondingCurve, useAddLiquidity } from '../hooks/useContractInteractions';
import { useApprovalTransaction } from '../hooks/useTransaction';
import { getErrorTitle, shouldOfferRetry } from '../utils/transactionErrors';
import { formatUnits, parseUnits } from 'viem';
import Header from '../components/layout/Header';
import TabNavigation from '../components/ui/TabNavigation';
import DepositForm from '../components/vault/DepositForm';
import WithdrawTab from '../components/vault/WithdrawTab';
import TestnetFaucet from '../components/vault/TestnetFaucet';
import BondingCurveBox from '../components/vault/BondingCurveBox';
import FAQ from '../components/vault/FAQ';
import FAQWrapper from '../components/vault/FAQWrapper';
import DOLA from "../assets/sDOLA.png";

export default function VaultPage() {
  // Detect chain ID to determine if Testnet Faucet should be shown
  const chainId = useChainId();
  const isMainnet = chainId === 1;

  // State to track if component has mounted (prevents flickering)
  const [isMounted, setIsMounted] = useState(false);

  // Determine tabs based on network - hide faucet on mainnet
  const tabs = isMounted && !isMainnet
    ? (["Deposit to Mint", "Burn to Withdraw", "Testnet Faucet"] as const)
    : (["Deposit to Mint", "Burn to Withdraw"] as const);

  const [activeTab, setActiveTab] = useState<Tab>("Deposit to Mint");

  // FAQ testing state - for manual testing during development
  const [faqComponent, setFaqComponent] = useState<string | undefined>("BondingCurveBox");

  // Wagmi hooks for wallet connection
  const { isConnected, address: walletAddress } = useAccount();

  // Set mounted state after initial render to prevent flickering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Contract addresses context
  const { addresses, loading: addressesLoading, error: addressesError, networkType } = useContractAddresses();

  // Fetch bonding curve prices and withdraw fee
  const {
    currentPrice: currentPriceRaw,
    initialPrice: initialPriceRaw,
    finalPrice: finalPriceRaw,
    withdrawalFeeBasisPoints: withdrawalFeeBasisPointsRaw,
    isLoading: bondingCurveLoading,
    isError: bondingCurveError,
    refetch: refetchBondingCurve
  } = useBondingCurve(addresses?.bondingCurve as `0x${string}` | undefined);

  // Convert prices from wei (18 decimals) to decimal format
  const bondingCurveData = {
    startPrice: initialPriceRaw ? parseFloat(formatUnits(initialPriceRaw, 18)) : 0.74, // Fallback to mock
    endPrice: finalPriceRaw ? parseFloat(formatUnits(finalPriceRaw, 18)) : 1.00, // Fallback to mock
    currentPrice: currentPriceRaw ? parseFloat(formatUnits(currentPriceRaw, 18)) : 0.89, // Fallback to mock
  };

  // Fetch DOLA balance from wallet's ERC20 token balance
  const {
    balance: dolaBalanceRaw,
    isLoading: dolaBalanceLoading,
    isError: dolaBalanceError,
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
    isError: dolaAllowanceError,
    refetch: refetchAllowance
  } = useTokenAllowance(
    walletAddress,
    addresses?.bondingCurve as `0x${string}` | undefined,
    addresses?.dolaToken as `0x${string}` | undefined
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

  // Convert withdraw fee from basis points to decimal rate
  // Basis points: 200 = 2%, 100 = 1%, etc.
  const withdrawalFeeRate = withdrawalFeeBasisPointsRaw
    ? Number(withdrawalFeeBasisPointsRaw) / 10000
    : 0.02; // Fallback to 2% if not loaded

  // Format balance data for components (assuming 1:1 USD ratio for DOLA)
  const dolaBalance = {
    balance: {
      balance: dolaBalanceDecimal,
      balanceUsd: dolaBalanceDecimal
    }
  };

  // Format phUSD balance data for components (using current bonding curve price for USD value)
  const phUSDBalance = {
    balance: {
      balance: phUSDBalanceDecimal,
      balanceUsd: phUSDBalanceDecimal * (currentPriceRaw ? parseFloat(formatUnits(currentPriceRaw, 18)) : 0)
    }
  };
  const isTransacting = false;
  const transactionError: string | undefined = undefined;

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
  } = useAddLiquidity(addresses?.bondingCurve as `0x${string}` | undefined);

  // Form state
  const [formData, setFormData] = useState<VaultFormData>({
    amount: "",
    autoStake: false,
    slippageBps: 10, // 0.10%
  });

  // Store the deposit amount when transaction is initiated to prevent duplicate toasts
  // This ref captures the amount before form reset, avoiding useEffect re-trigger
  const lastDepositAmountRef = useRef<string>("");

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
    icon: DOLA
  };

  const positionInfo: PositionInfo = {
    value: phUSDBalance.balance?.balance ?? 0,
    valueUsd: phUSDBalance.balance?.balanceUsd ?? 0,
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
        console.error('Error parsing receipt:', error);
      }

      // Show success toast with amount minted
      addToast({
        type: 'success',
        title: 'Deposit Successful',
        description: `Successfully deposited ${lastDepositAmountRef.current} DOLA and minted ${bondingTokensMinted} phUSD`,
        duration: 8000,
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

      // Clear form after successful transaction
      setFormData(prev => ({ ...prev, amount: "" }));

      // Clear the ref after successful toast display
      lastDepositAmountRef.current = "";
    }
  }, [isDepositSuccess, depositReceipt, depositHash, dolaToPhUSDRate, networkType, addToast, refetchDolaBalance, refetchPhUSDBalance, refetchBondingCurve, refetchAllowance]);

  // Approval transaction state management
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
        console.error('Approval failed:', error);
      },
      onStatusChange: (status) => {

        // Handle status changes with appropriate toast notifications
        if (status === 'PENDING_SIGNATURE') {
          addToast({
            type: 'info',
            title: 'Confirm in Wallet',
            description: 'Please confirm the approval transaction in your wallet.',
            duration: 0, // Don't auto-dismiss
          });
        } else if (status === 'PENDING_CONFIRMATION') {
          addToast({
            type: 'info',
            title: 'Transaction Submitted',
            description: 'Waiting for blockchain confirmation...',
            duration: 0, // Don't auto-dismiss
          });
        }
      }
    }
  );

  // Event handlers
  const handleFormChange = (data: Partial<VaultFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
    // No need to reset approval transaction state - the blockchain allowance
    // (dolaAllowanceDecimal) is the source of truth and updates automatically
  };

  // Handle approval button click
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

  const handleDeposit = async () => {
    if (!isConnected) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
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

    if (amount > dolaBalance.balance.balance) {
      addToast({
        type: 'error',
        title: 'Insufficient Balance',
        description: `You only have ${dolaBalance.balance.balance} DOLA available.`,
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
        duration: 0,
      });

      // Calculate expected output and minimum received
      // For deposit: DOLA → phUSD conversion
      // If price = 0.81, then 1 phUSD costs 0.81 DOLA
      // To get phUSD from DOLA: phUSD = DOLA / price
      const estPhUSD = dolaToPhUSDRate > 0 ? amount / dolaToPhUSDRate : 0;
      const minReceived = estPhUSD * (1 - formData.slippageBps / 10000);

      // Scale parameters by 1e18 for contract call
      const inputAmount = parseUnits(amount.toString(), 18);
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
        duration: 0,
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
      console.error('Deposit failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Deposit Failed',
        description: errorMessage,
        duration: 8000,
      });
    }
  };


  const handleWithdraw = async () => {
    if (!isConnected) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
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

    if (amount > phUSDBalance.balance.balance) {
      const feeAmount = (amount * 0.02).toFixed(4);
      const dolaReceived = (amount * 0.98).toFixed(4);
      addToast({
        type: 'error',
        title: 'Insufficient phUSD Balance',
        description: `Attempting to withdraw ${amount} phUSD (fee: ${feeAmount}, receive: ${dolaReceived} DOLA) but you only have ${phUSDBalance.balance.balance.toFixed(4)} phUSD available.`,
        duration: 8000,
      });
      return;
    }

    // Calculate fee information
    const feeRate = 0.02; // 2% withdrawal fee
    const feeAmount = (amount * feeRate).toFixed(4);
    const expectedOutput = (amount * (1 - feeRate)).toFixed(4);

    // Show processing notification with fee reminder
    const processingToastId = addToast({
      type: 'info',
      title: 'Processing Withdrawal...',
      description: `Burning ${amount} phUSD with ${(feeRate * 100).toFixed(0)}% fee (${feeAmount} phUSD). You'll receive ${expectedOutput} DOLA.`,
      duration: 0, // Don't auto-dismiss while processing
    });

    try {
      // TODO: Implement actual withdrawal using wagmi hooks
      // const transaction = await executeWithdraw(amount, phUSDBalance.balance, dolaBalance.balance);

      // Simulate transaction delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Remove processing notification
      setTimeout(() => removeToast(processingToastId), 1000);

      // Show enhanced success toast with fee details
      addToast({
        type: 'success',
        title: 'Withdrawal Completed Successfully',
        description: `Burned ${amount} phUSD • Fee: ${feeAmount} phUSD (${(feeRate * 100).toFixed(0)}%) • Received: ${expectedOutput} DOLA`,
        duration: 8000,
        action: {
          label: 'View Transaction',
          onClick: () => {}
        }
      });

      // Clear form after successful transaction
      setFormData(prev => ({ ...prev, amount: "" }));
    } catch (error) {
      // Remove processing notification on error
      removeToast(processingToastId);

      console.error('Withdraw failed:', error);

      // Enhanced error notification with more context
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Withdrawal Failed',
        description: `Transaction could not be completed: ${errorMessage}. Please check your balance and try again.`,
        duration: 10000,
        action: {
          label: 'Retry',
          onClick: () => {
            // User can click to retry the same transaction
            handleWithdraw();
          }
        }
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
            />

            {/* Tab content */}
            {activeTab === "Deposit to Mint" ? (
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
              />
            ) : activeTab === "Burn to Withdraw" ? (
              <WithdrawTab
                formData={formData}
                onFormChange={handleFormChange}
                constants={constants}
                positionInfo={positionInfo}
                onWithdraw={handleWithdraw}
                isTransacting={isTransacting}
                withdrawalFeeRate={withdrawalFeeRate}
              />
            ) : (
              <TestnetFaucet />
            )}
          </div>
        </section>

        {/* Right: Bonding Curve Box and FAQ */}
        <aside className="lg:col-span-1 space-y-6">
          <BondingCurveBox
            startPrice={bondingCurveData.startPrice}
            endPrice={bondingCurveData.endPrice}
            currentPrice={bondingCurveData.currentPrice}
            isLoading={bondingCurveLoading}
            isError={bondingCurveError}
          />

          {/* FAQ Component - with manual testing controls */}
          <div className="space-y-4">
            {/* FAQWrapper Demo Section */}
            <div className="phoenix-card p-4">
              <h3 className="text-sm font-semibold text-card-foreground mb-3">FAQWrapper Demo</h3>

              {/* Example 1: Button */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2">Wrapped Button (help cursor on hover):</p>
                <FAQWrapper
                  componentType="BondingCurveBox"
                  onTriggerFAQ={setFaqComponent}
                >
                  <button className="px-4 py-2 bg-accent text-accent-foreground rounded-md text-sm hover:bg-accent/80">
                    Click for FAQ
                  </button>
                </FAQWrapper>
              </div>

              {/* Example 2: Text Box */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2">Wrapped Text Box (entire area clickable):</p>
                <FAQWrapper
                  componentType="DepositForm"
                  onTriggerFAQ={setFaqComponent}
                >
                  <div className="px-4 py-2 bg-card border border-border rounded-md text-sm">
                    Click Anywhere on This Text
                  </div>
                </FAQWrapper>
              </div>

              {/* Example 3: Text Span */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Wrapped Text Span:</p>
                <FAQWrapper
                  componentType="WithdrawTab"
                  onTriggerFAQ={setFaqComponent}
                >
                  <span className="text-sm text-card-foreground">Click this text for FAQ (help cursor)</span>
                </FAQWrapper>
              </div>
            </div>

            {/* Manual Testing Controls - temporary for development */}
            <div className="phoenix-card p-4">
              <h3 className="text-sm font-semibold text-card-foreground mb-3">FAQ Testing Controls</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFaqComponent("BondingCurveBox")}
                  className={`px-3 py-1 text-xs rounded border ${
                    faqComponent === "BondingCurveBox"
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-card border-border text-muted-foreground hover:bg-accent/5"
                  }`}
                >
                  BondingCurveBox
                </button>
                <button
                  onClick={() => setFaqComponent("DepositForm")}
                  className={`px-3 py-1 text-xs rounded border ${
                    faqComponent === "DepositForm"
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-card border-border text-muted-foreground hover:bg-accent/5"
                  }`}
                >
                  DepositForm
                </button>
                <button
                  onClick={() => setFaqComponent("WithdrawTab")}
                  className={`px-3 py-1 text-xs rounded border ${
                    faqComponent === "WithdrawTab"
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-card border-border text-muted-foreground hover:bg-accent/5"
                  }`}
                >
                  WithdrawTab
                </button>
                <button
                  onClick={() => setFaqComponent("InvalidComponent")}
                  className={`px-3 py-1 text-xs rounded border ${
                    faqComponent === "InvalidComponent"
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-card border-border text-muted-foreground hover:bg-accent/5"
                  }`}
                >
                  Invalid
                </button>
                <button
                  onClick={() => setFaqComponent(undefined)}
                  className={`px-3 py-1 text-xs rounded border ${
                    faqComponent === undefined
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-card border-border text-muted-foreground hover:bg-accent/5"
                  }`}
                >
                  None
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Current: {faqComponent || "None"}
                {faqComponent && !["BondingCurveBox", "DepositForm", "WithdrawTab"].includes(faqComponent) && " (should not render)"}
              </p>
            </div>

            <FAQ componentName={faqComponent} />
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-muted-foreground">
        <div className="border-t border-border pt-6 space-y-3">
          <p>RainbowKit wallet integration enabled. Connect your wallet to interact with Phoenix contracts.</p>
          <p>Withdraw at any time • 0% Deposit Fee • {(withdrawalFeeRate * 100).toFixed(1)}% Withdraw Fee</p>

          {/* Balance and Allowance Loading/Error Status */}
          <div className="border-t border-border pt-3">
            <p className="font-semibold mb-1">Balance & Allowance Status:</p>
            <div className="space-y-1">
              {dolaBalanceLoading && <p className="text-blue-400">Loading DOLA balance...</p>}
              {dolaBalanceError && <p className="text-red-400">Error loading DOLA balance. Please check your connection.</p>}
              {dolaAllowanceLoading && <p className="text-blue-400">Loading DOLA allowance...</p>}
              {dolaAllowanceError && <p className="text-red-400">Error loading DOLA allowance. Please check your connection.</p>}
              {!walletAddress && <p className="text-yellow-400">Connect wallet to view balance and allowance</p>}
              {walletAddress && !dolaBalanceLoading && !dolaBalanceError && (
                <p className="text-green-400">DOLA Balance: {dolaBalanceDecimal.toFixed(4)} DOLA (${dolaBalanceDecimal.toFixed(2)} USD)</p>
              )}
              {walletAddress && !dolaAllowanceLoading && !dolaAllowanceError && (
                <p className="text-green-400">DOLA Allowance: {dolaAllowanceDecimal.toFixed(4)} DOLA (approved for bonding curve)</p>
              )}
            </div>
          </div>

          {/* Contract Addresses Debug Info */}
          <div className="border-t border-border pt-3">
            <p className="font-semibold mb-1">Network & Contract Addresses:</p>
            <div className="space-y-1">
              <p>Network Type: <span className="text-accent">{networkType}</span></p>
              {addressesLoading && <p className="text-blue-400">Loading contract addresses...</p>}
              {addressesError && <p className="text-red-400">Error: {addressesError}</p>}
              {addresses && (
                <div className="space-y-1 mt-2">
                  <p>DOLA Token: <code className="text-accent">{addresses.dolaToken}</code></p>
                  <p>TOKE Token: <code className="text-accent">{addresses.tokeToken}</code></p>
                  <p>AutoDola Vault: <code className="text-accent">{addresses.autoDolaVault}</code></p>
                  <p>Tokemak Main Rewarder: <code className="text-accent">{addresses.tokemakMainRewarder}</code></p>
                  <p>Bonding Token (ERC20): <code className="text-accent">{addresses.bondingToken}</code></p>
                  <p>Bonding Curve (Minter): <code className="text-accent">{addresses.bondingCurve}</code></p>
                </div>
              )}
            </div>
          </div>

          {transactionError && (
            <div className="mt-2 text-red-500">
              Transaction Error: {transactionError}
            </div>
          )}
          {isTransacting && (
            <div className="mt-2 text-blue-500">
              Transaction processing...
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}