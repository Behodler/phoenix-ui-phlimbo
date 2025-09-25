import type { ActionButtonProps } from '../../types/vault';

export default function ActionButton({ disabled, onAction, label }: ActionButtonProps) {
  return (
    <div className="mt-6">
      <button
        disabled={disabled}
        onClick={onAction}
        className="w-full phoenix-btn-primary"
      >
        {label}
      </button>
      <div className="mt-3 text-xs text-muted-foreground">
        Withdraw and unstake at any time • 0% Deposit Fee
      </div>
    </div>
  );
}