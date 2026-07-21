'use client';

import { useAuth } from '@/contexts/AuthContext';

interface LoadingOverlayProps {
  show?: boolean;
}

export default function LoadingOverlay({ show }: LoadingOverlayProps) {
  const { isLoading } = useAuth();

  if (!(show ?? isLoading)) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-end gap-[3px] h-8">
          {[0.4, 0.7, 1, 0.6, 0.8, 0.5].map((h, i) => (
            <div
              key={i}
              className="w-[3px] bg-accent-action origin-bottom animate-wave"
              style={{
                height: `${h * 32}px`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
        <span className="text-text-secondary text-sm font-mono">Loading...</span>
      </div>
    </div>
  );
}
