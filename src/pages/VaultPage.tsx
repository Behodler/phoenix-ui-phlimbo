import { useState } from 'react';
import type { Tab, VaultFormData, VaultConstants, TokenInfo, PositionInfo } from '../types/vault';
import Header from '../components/layout/Header';
import TabNavigation from '../components/ui/TabNavigation';
import DepositForm from '../components/vault/DepositForm';
import PositionCard from '../components/vault/PositionCard';
import TabPlaceholder from '../components/ui/TabPlaceholder';

export default function VaultPage() {
  const tabs = ["Deposit to Mint", "Burn to Withdraw"] as const;
  const [activeTab, setActiveTab] = useState<Tab>("Deposit to Mint");

  // Form state
  const [formData, setFormData] = useState<VaultFormData>({
    amount: "",
    autoStake: false,
    slippageBps: 10, // 0.10%
  });

  // Mock data - these would come from hooks/API calls in real implementation
  const constants: VaultConstants = {
    dolaToAutoDolaRate: 0.9642,
    gasFeeUsd: 0.27,
  };

  const tokenInfo: TokenInfo = {
    name: "DOLA",
    balance: 0.00,
    balanceUsd: 0.00,
  };

  const positionInfo: PositionInfo = {
    value: 50.1043,
    valueUsd: 49.88,
    isStaked: true,
  };

  // Event handlers
  const handleFormChange = (data: Partial<VaultFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const handleConnect = () => {
    console.log('Connect wallet clicked');
  };

  const handleDeposit = () => {
    console.log('Deposit clicked with data:', formData);
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

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
      <Header onConnect={handleConnect} />

      <main className="mx-auto max-w-5xl px-4 py-8 grid lg:grid-cols-3 gap-6">
        {/* Left: Main card */}
        <section className="lg:col-span-2">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-0 overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/5">
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
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-neutral-500">
        <div className="border-t border-neutral-800 pt-6">
          This is a static mockup for development. Replace wired values with live data and handlers.
        </div>
      </footer>
    </div>
  );
}