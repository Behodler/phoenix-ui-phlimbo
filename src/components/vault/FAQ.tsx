import { useState } from 'react';
import type { FAQProps, FAQData } from '../../types/vault';
import faqDataJson from '../../assets/faq-data.json';

export default function FAQ({ componentName }: FAQProps) {
  // Don't render if no component name is provided
  if (!componentName) {
    return null;
  }

  // State for tracking which items are expanded
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  // Load FAQ data from JSON file based on component name
  const faqData: FAQData | undefined = (faqDataJson as Record<string, FAQData>)[componentName];

  // Only show FAQ if we have data for this component
  if (!faqData) {
    return null;
  }

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className="phoenix-card p-6">
      <div className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <h2 className="text-lg sm:text-xl font-bold text-card-foreground">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Common questions about {componentName}
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {faqData.items.map((item, index) => (
            <div
              key={index}
              className="border border-border rounded-lg overflow-hidden"
            >
              {/* Question Header */}
              <button
                onClick={() => toggleItem(index)}
                className="w-full px-4 py-3 text-left bg-card hover:bg-accent/5 transition-colors duration-200 flex items-center justify-between group"
              >
                <span className="text-sm sm:text-base font-medium text-card-foreground">
                  {item.title}
                </span>
                <svg
                  className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                    expandedItems.has(index) ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Answer Body */}
              {expandedItems.has(index) && (
                <div className="px-4 py-3 border-t border-border bg-accent/5">
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {item.body}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}