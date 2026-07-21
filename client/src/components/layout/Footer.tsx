'use client';

import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith('/chat')) return null;

  return (
    <footer className="relative py-8 mt-16">
      <div className="absolute left-0 right-0 top-1/2 h-px bg-accent-action" />
      <p className="relative mx-auto w-fit bg-background px-4 text-[8px] sm:text-xs font-mono text-text-secondary tracking-wide">
        LocoVerse: Crafting crazy dreams into musical verses.
      </p>
    </footer>
  );
}
