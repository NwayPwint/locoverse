'use client';

import { useEffect } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Remove',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-white border border-border rounded-lg shadow-lg w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading font-bold text-sm sm:text-base mb-2">{title}</h3>
        <p className="text-text-secondary text-xs sm:text-sm mb-5 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="btn-secondary !px-4 !min-h-[38px] !text-[11px]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`btn-primary !px-4 !min-h-[38px] !text-[11px] ${
              variant === 'danger' ? '!bg-red-500 !border-red-500 hover:!bg-red-600' : ''
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
