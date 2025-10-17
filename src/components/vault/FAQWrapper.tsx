import { useState } from 'react';
import type { ReactNode } from 'react';

interface FAQWrapperProps {
  componentType: string;
  icon?: boolean;
  children: ReactNode;
  onTriggerFAQ: (componentName: string) => void;
}

export default function FAQWrapper({
  componentType,
  icon = false,
  children,
  onTriggerFAQ,
}: FAQWrapperProps) {
  const [isHovering, setIsHovering] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTriggerFAQ(componentType);
  };

  if (icon) {
    // Icon mode: Render children normally with a clickable question mark icon at top right
    return (
      <div className="relative inline-block">
        {children}
        <button
          onClick={handleClick}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className="absolute -top-1 -right-1 z-10 w-6 h-6 rounded-full bg-accent/20 hover:bg-accent/40 border border-accent/50 hover:border-accent flex items-center justify-center transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          aria-label={`Show FAQ for ${componentType}`}
          title={`Show FAQ for ${componentType}`}
        >
          <svg
            className={`w-4 h-4 text-accent transition-colors duration-200 ${
              isHovering ? 'text-accent-foreground' : ''
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    );
  }

  // Direct click mode: Make entire wrapped component clickable
  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`inline-block transition-all duration-200 ${
        isHovering ? 'cursor-pointer opacity-90' : 'cursor-pointer'
      }`}
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
