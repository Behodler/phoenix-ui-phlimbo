import type { ActionButtonProps } from '../../types/vault';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md';
  className?: string;
}

function LoadingSpinner({ size = 'sm', className = '' }: LoadingSpinnerProps) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  return (
    <svg
      className={`animate-spin ${sizeClass} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}

export default function ActionButton({
  disabled,
  onAction,
  label,
  isLoading = false,
  variant = 'primary'
}: ActionButtonProps) {
  const getButtonClass = () => {
    if (variant === 'approve') {
      return 'w-full phoenix-btn-secondary';
    }
    return 'w-full phoenix-btn-primary';
  };

  return (
    <div className="mt-6">
      <button
        disabled={disabled || isLoading}
        onClick={onAction}
        className={`${getButtonClass()} ${(disabled || isLoading) ? 'opacity-50 cursor-not-allowed' : ''} flex items-center justify-center gap-2`}
      >
        {isLoading && <LoadingSpinner />}
        {label}
      </button>
      <div className="mt-3 text-xs text-muted-foreground">
        Withdraw at any time • 0% Deposit Fee
      </div>
    </div>
  );
}

export { LoadingSpinner };