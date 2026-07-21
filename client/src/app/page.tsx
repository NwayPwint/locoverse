'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Music, Search, MessageCircle, Guitar, Piano, Mic, Drum, Wind, PenLine, Sliders, Headphones } from 'lucide-react';
import Button from '@/components/ui/Button';

const skills = [
  { icon: Guitar, label: 'Guitar' },
  { icon: Piano, label: 'Piano' },
  { icon: Mic, label: 'Vocals' },
  { icon: Drum, label: 'Drums' },
  { icon: Wind, label: 'Saxophone' },
  { icon: Music, label: 'Production' },
  { icon: PenLine, label: 'Songwriting' },
  { icon: Sliders, label: 'Mixing' },
];

const features = [
  {
    icon: Music,
    num: '01',
    title: 'Build Your Profile',
    desc: 'Add your skills, choose your vibe, and let others know what you are looking for.',
  },
  {
    icon: Search,
    num: '02',
    title: 'Discover People',
    desc: 'Browse profiles by skills and vibes. Find your perfect creative match.',
  },
  {
    icon: MessageCircle,
    num: '03',
    title: 'Connect & Create',
    desc: 'Start chatting, share ideas, and take the collaboration outside the platform.',
  },
];

const testimonials = [
  {
    name: 'Alex Rivera',
    role: 'Producer & Beatmaker',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    text: 'Found my vocalist here. We have been making lo-fi tracks together for 3 months now!',
  },
  {
    name: 'Sam Chen',
    role: 'Guitarist & Songwriter',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    text: 'The vibe tags are genius. I matched with someone who loves the same obscure jazz fusion as me.',
  },
  {
    name: 'Jordan Lee',
    role: 'Singer & Lyricist',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
    text: 'Finally a platform that does not feel like a competition. Just real people making music.',
  },
];

export default function Home() {
  return (
    <main className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 md:px-6 py-20 md:py-28 text-center overflow-hidden min-h-[80vh]">
        <div className="absolute inset-0">
          <Image
            src="/images/hero.png"
            alt=""
            fill
            className="object-cover blur-[2px] scale-105"
            priority
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>

        <div className="relative z-10 animate-fade-in max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/90 px-4 py-2 rounded-md text-xs uppercase tracking-[0.2em] font-mono mb-8 border border-white/10">
            <span className="w-1.5 h-1.5 bg-accent-action rounded-full" />
            For Music Hobbyists
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-extrabold text-white mb-6 tracking-tight leading-[1.1]">
            Find Your
            <br />
            <span className="text-accent-action">Creative Partners</span>
          </h1>

          <p className="text-white/60 text-base md:text-lg max-w-lg mx-auto mb-10 leading-relaxed">
            A space for music lovers to discover collaborators, share ideas, and create together.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button variant="primary" size="lg">
                Get Started — It&apos;s Free
              </Button>
            </Link>
            <Link href="/guide">
              <Button variant="secondary" size="lg" className="border-white/30 text-white hover:bg-white/10">
                See How It Works
              </Button>
            </Link>
          </div>

          <div className="mt-14 flex items-center justify-center gap-6 text-white/50 text-sm">
            <div className="flex -space-x-3">
              {[
                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face',
                'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face',
              ].map((src, i) => (
                <div key={i} className="w-9 h-9 rounded-full border border-white/20 overflow-hidden">
                  <Image src={src} alt="" width={36} height={36} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <p>Joined by <span className="text-white font-semibold">2,400+</span> creators</p>
          </div>
        </div>
      </section>

      {/* Marquee Section */}
      <section className="py-4 md:py-5 bg-surface border-y border-border overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...skills, ...skills].map((skill, i) => {
            const Icon = skill.icon;
            return (
              <span key={i} className="mx-6 md:mx-8 text-text-secondary text-sm md:text-base font-medium inline-flex items-center gap-2">
                <Icon size={16} className="md:hidden" />
                <Icon size={18} className="hidden md:block" />
                {skill.label}
              </span>
            );
          })}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <span className="text-accent-action font-mono font-semibold text-xs uppercase tracking-[0.15em]">How It Works</span>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-heading font-extrabold mt-3 mb-4 md:mb-6">
              Three Steps to Collaboration
            </h2>
            <p className="text-text-secondary text-sm md:text-lg max-w-xl mx-auto">
              No auditions. No pressure. Just find people who vibe with your music.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.num} className="bg-background border border-border p-6 md:p-8">
                  <div className="w-10 h-10 bg-accent-action/10 flex items-center justify-center mb-4">
                    <Icon size={20} className="text-accent-action" />
                  </div>
                  <div className="text-accent-action font-mono font-bold text-xs mb-2 tracking-wider">{feature.num}</div>
                  <h3 className="text-lg font-heading font-bold mb-2">{feature.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-14 md:py-20 px-4 md:px-6 overflow-hidden border-y border-border">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1920&h=400&fit=crop&q=60"
            alt=""
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-background/90" />
        </div>
        <div className="relative max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
          {[
            { value: '2.4K+', label: 'Creators' },
            { value: '850+', label: 'Collaborations' },
            { value: '12K+', label: 'Messages' },
            { value: '98%', label: 'Positive Vibes' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl md:text-4xl font-heading font-extrabold text-accent-action mb-1">{stat.value}</div>
              <div className="text-text-secondary text-xs md:text-sm uppercase tracking-wider font-mono">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <span className="text-accent-action font-mono font-semibold text-xs uppercase tracking-[0.15em]">Community</span>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-heading font-extrabold mt-3">
              What Creators Say
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
            {testimonials.map((testimonial) => (
              <div key={testimonial.name} className="bg-background border border-border p-6 md:p-8">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-11 h-11 rounded-full overflow-hidden border border-border">
                    <Image
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      width={44}
                      height={44}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="font-heading font-bold text-sm">{testimonial.name}</div>
                    <div className="text-text-secondary text-xs font-mono">{testimonial.role}</div>
                  </div>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed">
                  &ldquo;{testimonial.text}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 md:py-28 px-4 md:px-6 overflow-hidden bg-surface border-t border-border">
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-heading font-extrabold mb-4 md:mb-6">
            Ready to Find Your Sound?
          </h2>
          <p className="text-text-secondary text-sm md:text-lg mb-8 md:mb-10 max-w-lg mx-auto">
            Join thousands of music hobbyists who are already creating together.
          </p>
          <Link href="/register" className="inline-flex items-center justify-center min-h-[44px] px-8 md:px-10 py-3 md:py-4 bg-accent-action text-white font-heading font-bold uppercase tracking-[0.2em] hover:bg-accent-warm transition-all duration-200 text-sm md:text-lg gap-2">
            <Headphones size={18} className="md:hidden" />
            <Headphones size={22} className="hidden md:block" />
            Join LocoVerse — Free
          </Link>
        </div>
      </section>
    </main>
  );
}
