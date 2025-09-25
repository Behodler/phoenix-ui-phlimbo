import type { Tab } from '../../types/vault';

interface TabPlaceholderProps {
  activeTab: Tab;
}

export default function TabPlaceholder({ activeTab }: TabPlaceholderProps) {
  return (
    <div className="p-10 text-center text-sm text-muted-foreground">
      <div className="text-lg mb-2 font-semibold text-foreground">{activeTab}</div>
      <p>
        Template placeholder. Add your content for the{" "}
        <span className="font-medium text-foreground">{activeTab}</span> tab here.
      </p>
    </div>
  );
}