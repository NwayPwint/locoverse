'use client';

import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const styles = {
  success: 'border-accent-success/30 bg-accent-success/5 text-accent-success',
  error: 'border-red-200 bg-red-50 text-red-600',
  info: 'border-border bg-white text-text-primary',
};

export default function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2 border px-4 py-3 shadow-lg text-sm font-mono animate-in slide-in-from-right ${styles[toast.type]}`}
          >
            <Icon size={16} className="shrink-0 mt-0.5" />
            <p className="flex-1">{toast.message}</p>
            <button onClick={() => dismissToast(toast.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
