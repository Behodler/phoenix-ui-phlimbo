import type { TabNavigationProps } from '../../types/vault';
import FAQWrapper from '../vault/FAQWrapper';

export default function TabNavigation({ tabs, activeTab, onTabChange, onTriggerFAQ }: TabNavigationProps) {
  // Get description text based on active tab
  const getTabDescription = () => {
    if (activeTab === "Deposit to Mint") return "You're depositing";
    if (activeTab === "Burn to Withdraw") return "You're withdrawing";
    if (activeTab === "Testnet Faucet") return "You're minting test tokens";
    return "";
  };

  // Map tab names to FAQ component types
  const getFAQComponentType = (tab: string): string | null => {
    if (tab === "Deposit to Mint") return "DepositTab";
    if (tab === "Burn to Withdraw") return "WithdrawTab";
    return null;
  };

  return (
    <div className="flex border-b border-border">
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