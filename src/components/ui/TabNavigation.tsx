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
      case "Market": return "MarketTab";
      case "NFT": return "NFTTab";
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
              "px-5 py-3 text-sm font-medium transition-all whitespace-nowrap relative",
              activeTab === tab
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {tab}
            {tab === "NFT" && (
              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-gradient-to-r from-pink-400 via-orange-400 to-yellow-400 text-white shadow-sm animate-pulse">
                NEW
              </span>
            )}
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