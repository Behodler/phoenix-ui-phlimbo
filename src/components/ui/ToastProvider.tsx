import { createContext, useContext, useReducer, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Toast, ToastState, ToastContext } from '../../types/toast';
import ToastComponent from './Toast';

// Initial state
const initialState: ToastState = {
  toasts: [],
};

// Action types
type ToastAction =
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'REMOVE_TOAST'; payload: { id: string } }
  | { type: 'CLEAR_ALL_TOASTS' };

// Reducer
function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, action.payload],
      };
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter(toast => toast.id !== action.payload.id),
      };
    case 'CLEAR_ALL_TOASTS':
      return {
        ...state,
        toasts: [],
      };
    default:
      return state;
  }
}

// Context
const ToastContext = createContext<ToastContext | null>(null);

// Provider component
export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(toastReducer, initialState);

  // Generate unique ID for toasts
  const generateId = useCallback(() => {
    return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Actions
  const addToast = useCallback((toastData: Omit<Toast, 'id'>): string => {
    const id = generateId();
    const toast: Toast = {
      ...toastData,
      id,
      duration: toastData.duration ?? 4000, // Default 4 seconds
    };

    dispatch({ type: 'ADD_TOAST', payload: toast });
    return id;
  }, [generateId]);

  const removeToast = useCallback((id: string): void => {
    dispatch({ type: 'REMOVE_TOAST', payload: { id } });
  }, []);

  const clearAllToasts = useCallback((): void => {
    dispatch({ type: 'CLEAR_ALL_TOASTS' });
  }, []);

  const contextValue: ToastContext = {
    ...state,
    addToast,
    removeToast,
    clearAllToasts,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Toast container */}
      {state.toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
          {state.toasts.map(toast => (
            <div
              key={toast.id}
              className="toast-enter animate-slide-in-right"
            >
              <ToastComponent
                toast={toast}
                onRemove={removeToast}
              />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// Hook
export function useToast(): ToastContext {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export default useToast;