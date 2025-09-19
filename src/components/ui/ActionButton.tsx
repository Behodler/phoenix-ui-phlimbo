import type { ActionButtonProps } from '../../types/vault';

export default function ActionButton({ disabled, onAction, label }: ActionButtonProps) {
  return (
    <div className="mt-6">
      <button
        disabled={disabled}
        onClick={onAction}
        className="w-full rounded-xl bg-lime-400 px-4 py-3 font-semibold text-neutral-900 disabled:opacity-40"
      >
        {label}
      </button>
      <div className="mt-3 text-xs text-neutral-500">
        Withdraw and unstake at any time • 0% Deposit Fee
      </div>
    </div>
  );
}