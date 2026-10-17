import type { ReactNode } from 'react';
import { BOX, FOCUS_RING } from './styles';

interface TokenAmountBoxProps {
  id: string;
  label: string;
  value: string;
  /** Omitted for a read-only (computed) box. */
  onChange?: (value: string) => void;
  readOnly?: boolean;
  balanceText: string;
  usdText: string;
  onMax?: () => void;
  /** Token chip or picker rendered to the right of the input. */
  token: ReactNode;
}

/** One amount box: label + balance, decimal input + token, USD estimate + MAX. */
export default function TokenAmountBox({ id, label, value, onChange, readOnly, balanceText, usdText, onMax, token }: TokenAmountBoxProps) {
  return (
    <div className={BOX}>
      <div className="flex justify-between text-[13px] text-muted-foreground">
        <label htmlFor={id}>{label}</label>
        <span>Balance: {balanceText}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          className={`flex-1 min-w-0 bg-transparent border-none text-foreground text-[30px] font-semibold p-0 placeholder:text-[rgba(240,245,248,0.35)] rounded-md ${FOCUS_RING} focus:outline-none`}
        />
        {token}
      </div>
      <div className="flex justify-between items-center min-h-[26px] text-[13px] text-muted-foreground">
        <span>{usdText}</span>
        {onMax && (
          <button
            type="button"
            onClick={onMax}
            className={`bg-transparent border-none text-pxusd-orange-300 text-[13px] font-bold py-1 rounded ${FOCUS_RING}`}
          >
            MAX
          </button>
        )}
      </div>
    </div>
  );
}
