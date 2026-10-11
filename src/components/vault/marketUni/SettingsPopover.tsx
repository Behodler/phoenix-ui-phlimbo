import { FOCUS_RING } from './styles';

interface SettingsPopoverProps {
  options: readonly number[];
  slippage: number;
  onSelect: (slip: number) => void;
  deadlineMinutes: number;
}

/** Slippage tolerance pills + static transaction deadline row. */
export default function SettingsPopover({ options, slippage, onSelect, deadlineMinutes }: SettingsPopoverProps) {
  return (
    <div
      id="mku-settings"
      className="absolute top-[68px] right-4 z-[5] w-[280px] max-w-[calc(100%-2rem)] bg-pxusd-teal-700 border border-pxusd-teal-400 rounded-[14px] p-4 flex flex-col gap-3 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
    >
      <span className="text-[13px] font-semibold text-foreground">Slippage tolerance</span>
      <div className="flex gap-2">
        {options.map((v) => {
          const on = v === slippage;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(v)}
              className={`flex-1 h-10 rounded-[10px] text-sm font-semibold ${FOCUS_RING} ${on ? 'text-pxusd-orange-300' : 'text-foreground bg-pxusd-teal-800 border border-pxusd-teal-600'}`}
              style={on ? { background: 'rgba(255,140,66,0.18)', border: '1px solid var(--pxusd-orange-400)' } : undefined}
            >
              {v}%
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[13px] text-muted-foreground">
        <span>Transaction deadline</span>
        <span className="text-foreground">{deadlineMinutes} min</span>
      </div>
    </div>
  );
}
