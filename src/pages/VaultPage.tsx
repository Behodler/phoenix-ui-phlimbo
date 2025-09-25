import { useState } from 'react';
import type { Tab, VaultFormData, VaultConstants, TokenInfo, PositionInfo } from '../types/vault';
import { useWallet, useTokenBalance, useTransaction } from '../hooks';
import Header from '../components/layout/Header';
import TabNavigation from '../components/ui/TabNavigation';
import DepositForm from '../components/vault/DepositForm';
import PositionCard from '../components/vault/PositionCard';
import TabPlaceholder from '../components/ui/TabPlaceholder';

export default function VaultPage() {
  const tabs = ["Deposit to Mint", "Burn to Withdraw"] as const;
  const [activeTab, setActiveTab] = useState<Tab>("Deposit to Mint");

  // Blockchain hooks
  const { isConnected, connect } = useWallet();
  const dolaBalance = useTokenBalance('DOLA');
  const pxUSDBalance = useTokenBalance('pxUSD');
  const { executeDeposit, isLoading: isTransacting, error: transactionError } = useTransaction();

  // Form state
  const [formData, setFormData] = useState<VaultFormData>({
    amount: "",
    autoStake: false,
    slippageBps: 10, // 0.10%
  });

  // Constants - these could also come from hooks in a real implementation
  const constants: VaultConstants = {
    dolaToAutoDolaRate: 0.9642,
    gasFeeUsd: 0.27,
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
  };

  const handleDeposit = async () => {
    if (!isConnected) {
      try {
        await connect();
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        return;
      }
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      console.error('Invalid amount');
      return;
    }

    if (!dolaBalance.balance || !pxUSDBalance.balance) {
      console.error('Token balances not available');
      return;
    }

    if (amount > dolaBalance.balance.balance) {
      console.error('Insufficient DOLA balance');
      return;
    }

    try {
      const transaction = await executeDeposit(
        amount,
        dolaBalance.balance,
        pxUSDBalance.balance
      );
      console.log('Deposit successful:', transaction);
      // Clear form after successful transaction
      setFormData(prev => ({ ...prev, amount: "" }));
    } catch (error) {
      console.error('Deposit failed:', error);
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
              />
            ) : (
              <TabPlaceholder activeTab={activeTab} />
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