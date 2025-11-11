import ConfirmationDialog from '../ui/ConfirmationDialog';

interface PauseConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export default function PauseConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false
}: PauseConfirmationDialogProps) {
  return (
    <ConfirmationDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Emergency Pause Warning"
      confirmLabel="Pause Application"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
      isLoading={isLoading}
    >
      <div className="space-y-4">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <p className="text-red-400 font-bold text-lg mb-2">⚠️ WARNING ⚠️</p>
          <p className="text-foreground font-semibold">
            This operation will pause the entire application!
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <p className="text-foreground">
            Only invoke if you suspect an exploit or security vulnerability.
          </p>

          <p className="text-yellow-400 font-medium">
            1000 EYE will be burnt from your wallet permanently.
          </p>

          <p className="text-muted-foreground">
            This action cannot be undone. The application will remain paused until the owner unpauses it.
          </p>
        </div>
      </div>
    </ConfirmationDialog>
  );
}
