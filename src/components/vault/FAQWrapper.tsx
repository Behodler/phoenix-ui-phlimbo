import type { ReactNode } from 'react';

interface FAQWrapperProps {
  componentType: string;
  children: ReactNode;
  onTriggerFAQ: (componentName: string) => void;
}

export default function FAQWrapper({
  componentType,
  children,
  onTriggerFAQ,
}: FAQWrapperProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTriggerFAQ(componentType);
  };

  // Make entire wrapped component clickable with help cursor
  return (
    <div
      onClick={handleClick}
      className="inline-block cursor-help transition-opacity duration-200 hover:opacity-90"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as any);
        }
      }}
      aria-label={`Show FAQ for ${componentType}`}
    >
      {children}
    </div>
  );
}
