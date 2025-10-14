import { useState } from 'react';
import { useAccount } from 'wagmi';
import type { Tab, VaultFormData, VaultConstants, TokenInfo, PositionInfo } from '../types/vault';
import { useToast } from '../components/ui/ToastProvider';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { useTokenBalance, useTokenAllowance, useTokenApproval } from '../hooks/useContractInteractions';
import { useApprovalTransaction } from '../hooks/useTransaction';
import { getErrorTitle, shouldOfferRetry } from '../utils/transactionErrors';
import { formatUnits } from 'viem';
import Header from '../components/layout/Header';
import TabNavigation from '../components/ui/TabNavigation';
import DepositForm from '../components/vault/DepositForm';
import WithdrawTab from '../components/vault/WithdrawTab';
import BondingCurveBox from '../components/vault/BondingCurveBox';
import FAQ from '../components/vault/FAQ';
import DOLA from "../assets/sDOLA.png";

export default function VaultPage() {
  const tabs = ["Deposit to Mint", "Burn to Withdraw"] as const;
  const [activeTab, setActiveTab] = useState<Tab>("Deposit to Mint");

  // FAQ testing state - for manual testing during development
  const [faqComponent, setFaqComponent] = useState<string | undefined>("BondingCurveBox");

  // Wagmi hooks for wallet connection
  const { isConnected, address: walletAddress } = useAccount();

  // Contract addresses context
  const { addresses, loading: addressesLoading, error: addressesError, networkType } = useContractAddresses();

  // Fetch DOLA balance from wallet's ERC20 token balance
  const {
    balance: dolaBalanceRaw,
    isLoading: dolaBalanceLoading,
    isError: dolaBalanceError
  } = useTokenBalance(
    walletAddress,
    addresses?.dolaToken as `0x${string}` | undefined
  );


  // Fetch DOLA allowance for bonding curve contract
  const {
    allowance: dolaAllowanceRaw,
    isLoading: dolaAllowanceLoading,
    isError: dolaAllowanceError
  } = useTokenAllowance(
    walletAddress,
    addresses?.bondingCurve as `0x${string}` | undefined,
    addresses?.dolaToken as `0x${string}` | undefined
  );

  // Convert bigint balance to decimal number (DOLA uses 18 decimals)
  const dolaBalanceDecimal = dolaBalanceRaw
    ? parseFloat(formatUnits(dolaBalanceRaw, 18))
    : 0;

  // Convert bigint allowance to decimal number (DOLA uses 18 decimals)
  const dolaAllowanceDecimal = dolaAllowanceRaw
    ? parseFloat(formatUnits(dolaAllowanceRaw, 18))
    : 0;

  // Format balance data for components (assuming 1:1 USD ratio for DOLA)
  const dolaBalance = {
    balance: {
      balance: dolaBalanceDecimal,
      balanceUsd: dolaBalanceDecimal
    }
  };

  // Mock pxUSD balance - will be implemented in future story
  const pxUSDBalance = { balance: { balance: 0.0, balanceUsd: 0.0 } };
  const isTransacting = false;
  const transactionError: string | undefined = undefined;

  // Toast notifications
  const { addToast, removeToast } = useToast();

  // Token approval hook
  const { approve } = useTokenApproval();

  // Form state
  const [formData, setFormData] = useState<VaultFormData>({
    amount: "",
    autoStake: false,
    slippageBps: 10, // 0.10%
  });

  // Constants - these could also come from hooks in a real implementation
  const constants: VaultConstants = {
    dolaToPxUSDRate: 1.33, // Updated to match mock blockchain exchange rate (0.2% slippage)
  };

  // Bonding curve data - these would come from smart contract in real implementation
  const bondingCurveData = {
    startPrice: 0.74,
    endPrice: 1.00,
    currentPrice: 0.89, // Current price in the bonding curve progression
  };

  // Convert blockchain balance to TokenInfo format for components
  const tokenInfo: TokenInfo = {
    name: "DOLA",
    balance: dolaBalance.balance?.balance ?? 0,
    balanceUsd: dolaBalance.balance?.balanceUsd ?? 0,
    icon: DOLA
  };

  const positionInfo: PositionInfo = {
    value: pxUSDBalance.balance?.balance ?? 0,
    valueUsd: pxUSDBalance.balance?.balanceUsd ?? 0,
    isStaked: true,
  };

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
      onSuccess: (hash) => {
        console.log('[VaultPage] onSuccess callback triggered with hash:', hash);
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
        // Note: We're not setting isApproved flag anymore since approval is tracked
        // via allowance from the blockchain. After successful approval, the allowance
        // hook will automatically refresh and show the new allowance.
      },
      onError: (error) => {
        console.error('Approval failed:', error);
      },
      onStatusChange: (status) => {
        console.log('[VaultPage] Transaction status changed to:', status);
        // Handle status changes with appropriate toast notifications
        if (status === 'PENDING_SIGNATURE') {
          console.log('[VaultPage] Showing "Confirm in Wallet" toast');
          addToast({
            type: 'info',
            title: 'Confirm in Wallet',
            description: 'Please confirm the approval transaction in your wallet.',
            duration: 0, // Don't auto-dismiss
          });
        } else if (status === 'PENDING_CONFIRMATION') {
          console.log('[VaultPage] Showing "Transaction Submitted" toast');
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

    // Reset approval transaction state when amount changes and exceeds allowance
    if (data.amount !== undefined) {
      const newAmount = parseFloat(data.amount || '0');
      // Reset transaction state if amount exceeds current allowance
      if (newAmount > dolaAllowanceDecimal && approvalTransaction.state.isSuccess) {
        approvalTransaction.reset();
      }
    }
  };

  // Handle approval button click
  const handleApprove = async (): Promise<void> => {
    console.log('[VaultPage] handleApprove called');
    console.log('[VaultPage] Wallet connected:', isConnected);
    console.log('[VaultPage] Addresses:', addresses);

    if (!isConnected) {
      console.log('[VaultPage] Wallet not connected, showing error');
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet using the button in the header.',
      });
      return;
    }

    if (!addresses?.dolaToken || !addresses?.bondingCurve) {
      console.log('[VaultPage] Contract addresses not loaded, showing error');
      addToast({
        type: 'error',
        title: 'Contract Addresses Not Loaded',
        description: 'Please wait for contract addresses to load and try again.',
      });
      return;
    }

    console.log('[VaultPage] About to execute approval transaction');
    try {
      await approvalTransaction.execute();
      console.log('[VaultPage] Approval transaction execute() completed');
    } catch (error) {
      console.log('[VaultPage] Approval transaction execute() threw error:', error);
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

    if (!dolaBalance.balance || !pxUSDBalance.balance) {
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

    try {
      // TODO: Implement actual deposit using wagmi hooks
      // const transaction = await executeDeposit(amount, dolaBalance.balance, pxUSDBalance.balance);
      console.log('Deposit transaction would be executed here:', amount);

      // Calculate the output amount based on exchange rate from mock blockchain (0.998 with slippage)
      const outputAmount = (amount * 0.998).toFixed(4);

      // Show success toast
      addToast({
        type: 'success',
        title: 'Deposit Successful',
        description: `Deposited ${amount} DOLA and received ${outputAmount} pxUSD`,
        duration: 6000,
      });

      // Clear form after successful transaction
      setFormData(prev => ({ ...prev, amount: "" }));
    } catch (error) {
      console.error('Deposit failed:', error);
      addToast({
        type: 'error',
        title: 'Deposit Failed',
        description: 'The deposit transaction failed. Please try again.',
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

    if (!pxUSDBalance.balance || !dolaBalance.balance) {
      addToast({
        type: 'error',
        title: 'Balance Error',
        description: 'Token balances are not available. Please refresh and try again.',
      });
      return;
    }

    if (amount > pxUSDBalance.balance.balance) {
      const feeAmount = (amount * 0.02).toFixed(4);
      const dolaReceived = (amount * 0.98).toFixed(4);
      addToast({
        type: 'error',
        title: 'Insufficient pxUSD Balance',
        description: `Attempting to withdraw ${amount} pxUSD (fee: ${feeAmount}, receive: ${dolaReceived} DOLA) but you only have ${pxUSDBalance.balance.balance.toFixed(4)} pxUSD available.`,
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
      description: `Burning ${amount} pxUSD with ${(feeRate * 100).toFixed(0)}% fee (${feeAmount} pxUSD). You'll receive ${expectedOutput} DOLA.`,
      duration: 0, // Don't auto-dismiss while processing
    });

    try {
      // TODO: Implement actual withdrawal using wagmi hooks
      // const transaction = await executeWithdraw(amount, pxUSDBalance.balance, dolaBalance.balance);
      console.log('Withdrawal transaction would be executed here:', amount);

      // Simulate transaction delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Remove processing notification
      setTimeout(() => removeToast(processingToastId), 1000);

      // Show enhanced success toast with fee details
      addToast({
        type: 'success',
        title: 'Withdrawal Completed Successfully',
        description: `Burned ${amount} pxUSD • Fee: ${feeAmount} pxUSD (${(feeRate * 100).toFixed(0)}%) • Received: ${expectedOutput} DOLA`,
        duration: 8000,
        action: {
          label: 'View Transaction',
          onClick: () => console.log('View transaction')
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
                isTransacting={isTransacting || approvalTransaction.state.isPending || approvalTransaction.state.isConfirming}
                needsApproval={parseFloat(formData.amount || '0') > dolaAllowanceDecimal && !approvalTransaction.state.isSuccess}
                onApprove={handleApprove}
                isAllowanceLoading={dolaAllowanceLoading}
              />
            ) : (
              <WithdrawTab
                formData={formData}
                onFormChange={handleFormChange}
                constants={constants}
                positionInfo={positionInfo}
                onWithdraw={handleWithdraw}
                isTransacting={isTransacting}
              />
            )}
          </div>
        </section>

        {/* Right: Bonding Curve Box and FAQ */}
        <aside className="lg:col-span-1 space-y-6">
          <BondingCurveBox
            startPrice={bondingCurveData.startPrice}
            endPrice={bondingCurveData.endPrice}
            currentPrice={bondingCurveData.currentPrice}
          />

          {/* FAQ Component - with manual testing controls */}
          <div className="space-y-4">
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