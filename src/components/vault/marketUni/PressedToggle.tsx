import type { ReactNode } from 'react';
import { FOCUS_RING } from './styles';

export interface PressedToggleOption<T extends string> {
  value: T;
  content: ReactNode;
  selected: boolean;
}

interface PressedToggleProps<T extends string> {
  ariaLabel: string;
  options: PressedToggleOption<T>[];
  onSelect: (value: T) => void;
  /** Container classes (layout, fill, border). */
  groupClassName: string;
  /** Classes shared by every button. */
  buttonClassName: string;
  onClassName: string;
  offClassName: string;
}

/**
 * `role="group"` of `aria-pressed` buttons — a toggle that picks an action or
 * option without the tab semantics of SegmentedControl.
 */
export default function PressedToggle<T extends string>({
  ariaLabel,
  options,
  onSelect,
  groupClassName,
  buttonClassName,
  onClassName,
  offClassName,
}: PressedToggleProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={groupClassName}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.selected}
          onClick={() => onSelect(o.value)}
          className={`${buttonClassName} ${o.selected ? onClassName : offClassName} ${FOCUS_RING}`}
        >
          {o.content}
        </button>
      ))}
    </div>
  );
}
