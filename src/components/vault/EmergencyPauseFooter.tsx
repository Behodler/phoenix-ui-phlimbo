import { useState, useCallback } from 'react';
import SafetyTab from './SafetyTab';

export default function EmergencyPauseFooter() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const handleOpenModal = useCallback(() => {
    // Increment resetKey to trigger checkbox reset in SafetyTab
    setResetKey((prev) => prev + 1);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <>
      {/* Fixed footer at viewport bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-red-500/30">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-red-400 font-medium hidden sm:block">
            Emergency controls
          </span>
          <button
            onClick={handleOpenModal}
            className="w-full sm:w-auto px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            Emergency Pause
          </button>
        </div>
      </div>

      {/* Modal overlay with SafetyTab content */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Emergency Pause</h3>
              <button
                onClick={handleCloseModal}
                className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>
            <SafetyTab resetKey={resetKey} />
          </div>
        </div>
      )}
    </>
  );
}
