'use client';

import Link from 'next/link';
import { UserPlus, Search, MessageCircle, Disc, Pencil, Heart } from 'lucide-react';
import Button from '@/components/ui/Button';

const steps = [
  {
    num: '01',
    icon: UserPlus,
    title: 'Create Your Profile',
    desc: 'Sign up with your email or Google account. Add a display name, avatar, and bio so other creators can get to know you.',
    color: 'text-accent-action',
    bg: 'bg-accent-action/10',
  },
  {
    num: '02',
    icon: Disc,
    title: 'Add Skills & Vibes',
    desc: 'Tag your instruments, production skills, and vocal abilities. Then pick vibe tags that describe your musical personality — Chill, Experimental, Melodic, and more.',
    color: 'text-purple-500',
    bg: 'bg-purple-400/10',
  },
  {
    num: '03',
    icon: Search,
    title: 'Discover Collaborators',
    desc: 'Browse profiles filtered by skills and vibes. See who shares your musical taste and find your perfect creative match.',
    color: 'text-accent-warm',
    bg: 'bg-accent-warm/10',
  },
  {
    num: '04',
    icon: MessageCircle,
    title: 'Connect & Chat',
    desc: 'Send a Loco request to people you want to collaborate with. Once connected, chat in real-time — share ideas, send voice notes, and plan your next track.',
    color: 'text-accent-action',
    bg: 'bg-accent-action/10',
  },
  {
    num: '05',
    icon: Pencil,
    title: 'Create Together',
    desc: 'Use the Creator Hub to compose songs with a built-in structure editor. Write lyrics, arrange verses, choruses, and bridges — all on-platform.',
    color: 'text-purple-500',
    bg: 'bg-purple-400/10',
  },
  {
    num: '06',
    icon: Heart,
    title: 'Share & Get Feedback',
    desc: 'Share your songs and posts on the Vibes feed. Get likes, comments, and feedback from the community to grow as a creator.',
    color: 'text-accent-warm',
    bg: 'bg-accent-warm/10',
  },
];

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-white border-b border-border py-12 md:py-20 px-4 md:px-6">
        <div className="max-w-6xl mx-auto text-center">
          <span className="text-accent-action font-mono font-semibold text-xs uppercase tracking-[0.15em]">Guide</span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading font-extrabold mt-3 mb-4">
            How LocoVerse Works
          </h1>
          <p className="text-text-secondary text-sm md:text-base max-w-lg mx-auto leading-relaxed">
            A step-by-step guide to getting started and making the most of LocoVerse.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-12 md:py-20 px-4 md:px-6">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="bg-white border border-border p-6 md:p-8">
                <div className={`w-10 h-10 md:w-12 md:h-12 ${step.bg} flex items-center justify-center mb-4`}>
                  <Icon size={20} className={step.color} />
                </div>
                <div className={`${step.color} font-mono font-bold text-xs mb-2 tracking-wider`}>{step.num}</div>
                <h2 className="text-base md:text-lg font-heading font-bold mb-2">{step.title}</h2>
                <p className="text-text-secondary text-sm leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 md:py-16 px-4 md:px-6 bg-white border-t border-border">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl font-heading font-extrabold mb-3">
            Ready to Start?
          </h2>
          <p className="text-text-secondary text-sm mb-6">
            Join LocoVerse for free and start creating today.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button variant="primary" size="lg">
                Sign Up — Free
              </Button>
            </Link>
            <Link href="/">
              <Button variant="secondary" size="lg">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
