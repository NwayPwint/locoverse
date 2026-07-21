'use client';

import { ReactNode } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import NotificationToast from '@/components/layout/NotificationToast';
import ToastContainer from '@/components/ui/ToastContainer';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      <ToastProvider>
        <AuthProvider>
          <LoadingOverlay />
          <NotificationToast />
          <ToastContainer />
          {children}
        </AuthProvider>
      </ToastProvider>
    </GoogleOAuthProvider>
  );
}
