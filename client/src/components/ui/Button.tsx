'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: 'px-5 py-2 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-3.5 text-sm',
  };

  const variantClasses = {
    primary: 'bg-accent-action text-white hover:bg-accent-action/90',
    secondary: 'bg-transparent text-text-primary hover:bg-text-primary/5 border border-border',
  };

  return (
    <button
      className={`inline-flex items-center justify-center min-h-[44px] font-heading font-bold uppercase tracking-[0.2em] transition-all duration-200 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
