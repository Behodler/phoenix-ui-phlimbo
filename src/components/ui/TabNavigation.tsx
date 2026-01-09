import type { TabNavigationProps } from '../../types/vault';
import FAQWrapper from '../vault/FAQWrapper';

export default function TabNavigation({ tabs, activeTab, onTabChange, onTriggerFAQ }: TabNavigationProps) {
  // Get description text based on active tab
  const getTabDescription = () => {
    if (activeTab === "Mint") return "You're minting 1:1";
    if (activeTab === "Deposit") return "You're depositing";
    if (activeTab === "Withdraw") return "You're withdrawing";
    if (activeTab === "Testnet Faucet") return "You're minting test tokens";
    if (activeTab === "Safety") return "Emergency pause controls";
    return "";
  };

  // Map tab names to FAQ component types
  const getFAQComponentType = (tab: string): string | null => {
    if (tab === "Mint") return "MintTab";
    return null;
  };

  return (
    <div className="flex items-end border-b border-border">
      {tabs.map((tab) => {
        const faqType = getFAQComponentType(tab);
        const button = (
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
        );

        // Wrap with FAQWrapper only if this tab should have FAQ
        if (faqType && onTriggerFAQ) {
          return (
            <FAQWrapper
              key={tab}
              componentType={faqType}
              onTriggerFAQ={onTriggerFAQ}
            >
              {button}
            </FAQWrapper>
          );
        }

        return button;
      })}
      <div className="ml-auto px-4 py-3 text-sm text-muted-foreground">
        {getTabDescription()}
      </div>
    </div>
  );
}