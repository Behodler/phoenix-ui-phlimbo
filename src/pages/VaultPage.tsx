import { useState } from 'react';
import type { Tab, VaultFormData, VaultConstants, TokenInfo, PositionInfo } from '../types/vault';
import { useWallet, useTokenBalance, useTransaction } from '../hooks';
import { useToast } from '../components/ui/ToastProvider';
import Header from '../components/layout/Header';
import TabNavigation from '../components/ui/TabNavigation';
import DepositForm from '../components/vault/DepositForm';
import WithdrawTab from '../components/vault/WithdrawTab';
import PositionCard from '../components/vault/PositionCard';

export default function VaultPage() {
  const tabs = ["Deposit to Mint", "Burn to Withdraw"] as const;
  const [activeTab, setActiveTab] = useState<Tab>("Deposit to Mint");

  // Blockchain hooks
  const { isConnected, connect } = useWallet();
  const dolaBalance = useTokenBalance('DOLA');
  const pxUSDBalance = useTokenBalance('pxUSD');
  const { executeDeposit, isLoading: isTransacting, error: transactionError } = useTransaction();

  // Toast notifications
  const { addToast } = useToast();

  // Form state
  const [formData, setFormData] = useState<VaultFormData>({
    amount: "",
    autoStake: false,
    slippageBps: 10, // 0.10%
  });

  // Approval state - in real app this would come from contract state
  const [isApproved, setIsApproved] = useState(false);

  // Constants - these could also come from hooks in a real implementation
  const constants: VaultConstants = {
    dolaToPxUSDRate: 1.33, // Updated to match mock blockchain exchange rate (0.2% slippage)
  };

  // Convert blockchain balance to TokenInfo format for components
  const tokenInfo: TokenInfo = {
    name: "DOLA",
    balance: dolaBalance.balance?.balance ?? 0,
    balanceUsd: dolaBalance.balance?.balanceUsd ?? 0,
  };

  const positionInfo: PositionInfo = {
    value: pxUSDBalance.balance?.balance ?? 0,
    valueUsd: pxUSDBalance.balance?.balanceUsd ?? 0,
    isStaked: true,
  };

  // Event handlers
  const handleFormChange = (data: Partial<VaultFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));

    // Reset approval when amount changes (in real app, check if new amount exceeds allowance)
    if (data.amount !== undefined) {
      const newAmount = parseFloat(data.amount || '0');
      // Mock logic: require approval for amounts > 100
      if (newAmount > 100 && isApproved) {
        setIsApproved(false);
      }
    }
  };

  const handleApprove = async (): Promise<void> => {
    if (!isConnected) {
      try {
        await connect();
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        addToast({
          type: 'error',
          title: 'Wallet Connection Failed',
          description: 'Could not connect to wallet. Please try again.',
        });
        return;
      }
    }

    // Mock approval transaction with delay
    try {
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simulate occasional approval failures
          if (Math.random() > 0.95) {
            reject(new Error('Approval failed: Transaction rejected'));
          } else {
            resolve(null);
          }
        }, 1500); // 1.5 second delay
      });

      setIsApproved(true);
      addToast({
        type: 'success',
        title: 'Approval Successful',
        description: 'DOLA spending has been approved. You can now deposit.',
      });
    } catch (error) {
      console.error('Approval failed:', error);
      addToast({
        type: 'error',
        title: 'Approval Failed',
        description: 'The approval transaction was rejected. Please try again.',
      });
    }
  };

  const handleDeposit = async () => {
    if (!isConnected) {
      try {
        await connect();
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        addToast({
          type: 'error',
          title: 'Wallet Connection Failed',
          description: 'Could not connect to wallet. Please try again.',
        });
        return;
      }
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
      const transaction = await executeDeposit(
        amount,
        dolaBalance.balance,
        pxUSDBalance.balance
      );
      console.log('Deposit successful:', transaction);

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

  const handleClaim = () => {
    console.log('Claim clicked');
  };

  const handleUnstake = () => {
    console.log('Unstake clicked');
  };

  const handleViewPortfolio = () => {
    console.log('View portfolio clicked');
  };

  const handleWithdraw = async () => {
    if (!isConnected) {
      try {
        await connect();
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        addToast({
          type: 'error',
          title: 'Wallet Connection Failed',
          description: 'Could not connect to wallet. Please try again.',
        });
        return;
      }
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
      addToast({
        type: 'error',
        title: 'Insufficient Balance',
        description: `You only have ${pxUSDBalance.balance.balance} pxUSD available.`,
      });
      return;
    }

    try {
      // Mock withdraw transaction with delay
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simulate occasional withdrawal failures
          if (Math.random() > 0.95) {
            reject(new Error('Withdraw failed: Transaction rejected'));
          } else {
            resolve(null);
          }
        }, 2000); // 2 second delay
      });

      // Calculate the output amount based on exchange rate (inverse of deposit rate)
      const pxUSDToDolaRate = 1 / constants.dolaToPxUSDRate;
      const outputAmount = (amount * pxUSDToDolaRate * 0.998).toFixed(4); // Apply slippage

      // Update mock balances (this would be handled by the blockchain in reality)
      // Decrease pxUSD balance, increase DOLA balance
      pxUSDBalance.balance.balance -= amount;
      pxUSDBalance.balance.balanceUsd -= amount;
      dolaBalance.balance.balance += parseFloat(outputAmount);
      dolaBalance.balance.balanceUsd += parseFloat(outputAmount);

      addToast({
        type: 'success',
        title: 'Withdraw Successful',
        description: `Burned ${amount} pxUSD and received ${outputAmount} DOLA`,
        duration: 6000,
      });

      // Clear form after successful transaction
      setFormData(prev => ({ ...prev, amount: "" }));
    } catch (error) {
      console.error('Withdraw failed:', error);
      addToast({
        type: 'error',
        title: 'Withdraw Failed',
        description: 'The withdraw transaction failed. Please try again.',
      });
    }
  };

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Header onConnect={handleConnect} isConnected={isConnected} />

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
                isTransacting={isTransacting}
                needsApproval={parseFloat(formData.amount || '0') > 100 && !isApproved}
                onApprove={handleApprove}
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

        {/* Right: Position card */}
        <aside className="lg:col-span-1">
          <PositionCard
            position={positionInfo}
            onClaim={handleClaim}
            onUnstake={handleUnstake}
            onViewPortfolio={handleViewPortfolio}
          />
        </aside>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-muted-foreground">
        <div className="border-t border-border pt-6">
          Mock blockchain functionality enabled. Transactions simulate 1-3 second delays with realistic gas fees and balance updates.
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