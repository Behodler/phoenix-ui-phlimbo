import type { ReactNode } from 'react';
import { LoadingSpinner } from './ActionButton';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isLoading = false,
  disabled = false
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg max-w-md w-full p-6 shadow-2xl">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>

        <div className="mb-6 text-muted-foreground">
          {children}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={disabled || isLoading}
            className="flex-1 phoenix-btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && <LoadingSpinner />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export { ConfirmationDialog };