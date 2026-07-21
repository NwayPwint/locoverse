'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSuccess(res.data.message);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-heading font-extrabold text-text-primary">Reset your password</h1>
          <p className="text-text-secondary mt-2">Enter your email and we&apos;ll send you a reset link</p>
        </div>

        <div className="card">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle size={48} className="mx-auto text-accent-action mb-4" />
              <p className="text-text-primary font-medium mb-2">Check your email</p>
              <p className="text-text-secondary text-sm mb-6">{success}</p>
              <Link href="/login" className="text-accent-action font-bold text-sm hover:underline">
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-text-primary mb-2">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-10"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full disabled:opacity-50"
              >
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>

        {!success && (
          <p className="text-center mt-6">
            <Link href="/login" className="inline-flex items-center gap-1 text-text-secondary text-sm hover:text-accent-action transition-colors">
              <ArrowLeft size={14} />
              Back to login
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
