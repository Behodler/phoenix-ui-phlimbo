import type { TabNavigationProps } from '../../types/vault';
import FAQWrapper from '../vault/FAQWrapper';

export default function TabNavigation({ tabs, activeTab, onTabChange, onTriggerFAQ }: TabNavigationProps) {

  // Map tab names to FAQ component types
  const getFAQComponentType = (tab: string): string | null => {
    switch (tab) {
      case "Mint": return "MintTab";
      case "Deposit": return "DepositTab";
      case "Withdraw": return "WithdrawTab";
      case "Yield Funnel": return "YieldFunnelTab";
      case "Safety": return "SafetyTab";
      default: return null;
    }
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
              "px-5 py-3 text-sm font-medium transition-all whitespace-nowrap",
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

    </div>
  );
}