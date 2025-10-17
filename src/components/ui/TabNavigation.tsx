import type { TabNavigationProps } from '../../types/vault';

export default function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
  // Get description text based on active tab
  const getTabDescription = () => {
    if (activeTab === "Deposit to Mint") return "You're depositing";
    if (activeTab === "Burn to Withdraw") return "You're withdrawing";
    if (activeTab === "Testnet Faucet") return "You're minting test tokens";
    return "";
  };

  return (
    <div className="flex border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={[
            "px-5 py-3 text-sm font-medium transition-all",
            activeTab === tab
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {tab}
        </button>
      ))}
      <div className="ml-auto px-4 py-3 text-sm text-muted-foreground">
        {getTabDescription()}
      </div>
    </div>
  );
}