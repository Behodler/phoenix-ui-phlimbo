import type { TabNavigationProps } from '../../types/vault';

export default function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex border-b border-neutral-800">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={[
            "px-5 py-3 text-sm font-medium transition",
            activeTab === tab
              ? "text-white border-b-2 border-lime-400"
              : "text-neutral-400 hover:text-neutral-200",
          ].join(" ")}
        >
          {tab}
        </button>
      ))}
      <div className="ml-auto px-4 py-3 text-sm text-neutral-400">
        You're depositing
      </div>
    </div>
  );
}