'use client';

import { useState } from 'react';
import { X, Flag } from 'lucide-react';
import api from '@/lib/api';

interface ReportModalProps {
  targetType: 'user' | 'post' | 'shared_song' | 'message';
  targetId: string;
  onClose: () => void;
}

const REASON_OPTIONS = [
  'Spam or misleading content',
  'Harassment or bullying',
  'Inappropriate or offensive content',
  'Impersonation',
  'Other',
];

export default function ReportModal({ targetType, targetId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/blocks/reports', { targetType, targetId, reason: reason.trim() });
      setSubmitted(true);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white border border-border w-full max-w-sm rounded-lg shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Flag size={16} className="text-red-400" />
            <h3 className="text-sm font-heading font-bold">Report</h3>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {submitted ? (
          <div className="p-6 text-center">
            <p className="text-sm text-text-primary font-medium mb-1">Thanks for your report</p>
            <p className="text-xs text-text-secondary mb-4">We&apos;ll review it and take appropriate action.</p>
            <button onClick={onClose} className="btn-primary !px-4 !min-h-[36px] !text-[11px]">
              Done
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <p className="text-xs text-text-secondary">Why are you reporting this {targetType.replace('_', ' ')}?</p>
            <div className="space-y-1.5">
              {REASON_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                    reason === opt ? 'bg-accent-action/10 text-accent-action' : 'hover:bg-surface-hover text-text-primary'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={opt}
                    checked={reason === opt}
                    onChange={(e) => setReason(e.target.value)}
                    className="accent-accent-action"
                  />
                  {opt}
                </label>
              ))}
            </div>
            {reason === 'Other' && (
              <textarea
                value={reason === 'Other' ? '' : reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe the issue..."
                rows={3}
                className="input-field text-xs resize-none"
              />
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="btn-secondary !px-3 !min-h-[34px] !text-[11px]">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason.trim() || submitting}
                className="btn-primary !px-3 !min-h-[34px] !text-[11px] disabled:opacity-40"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
