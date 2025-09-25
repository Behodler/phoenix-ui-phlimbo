import type { TabNavigationProps } from '../../types/vault';

export default function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
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
        You're depositing
      </div>
    </div>
  );
}