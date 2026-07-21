'use client';

import Link from 'next/link';
import { Disc3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function FloatingStudioButton() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <Link
      href="/creator-hub"
      className="hidden fixed bottom-24 right-6 z-50 w-14 h-14 items-center justify-center bg-accent-action text-white rounded-full shadow-lg hover:bg-accent-action/90 transition-all duration-200"
      title="Studio"
    >
      <Disc3 size={22} />
    </Link>
  );
}