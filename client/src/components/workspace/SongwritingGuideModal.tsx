'use client';

import { useState } from 'react';
import { X, Music, FileText, Sparkles, Disc, Radio, Mic, Share2, LucideIcon } from 'lucide-react';

interface SongwritingGuideModalProps {
  onClose: () => void;
}

type Lang = 'en' | 'my';

const content: Record<Lang, {
  headerTitle: string;
  headerSub: string;
  gotIt: string;
  toggleLabel: string;
  steps: { num: string; icon: LucideIcon; title: string; desc: string; color: string; bg: string }[];
}> = {
  en: {
    headerTitle: 'Songwriting Guide',
    headerSub: 'How to create music on LocoVerse',
    gotIt: 'Got it',
    toggleLabel: 'မြန်မာ',
    steps: [
      { num: '01', icon: Music, title: 'Create a Song', desc: 'In the Creator Hub, click "New Song" to start. Give it a title, set the BPM and time signature — these set the rhythmic foundation for your track.', color: 'text-accent-action', bg: 'bg-accent-action/10' },
      { num: '02', icon: FileText, title: 'Add Sections', desc: 'Songs are built from sections — Verse, Chorus, Bridge, etc. Click "Add Section" to add a new block, then drag to reorder. Each section holds its own lyrics, chords, and melody.', color: 'text-purple-500', bg: 'bg-purple-400/10' },
      { num: '03', icon: Sparkles, title: 'Write Lyrics + AI Help', desc: 'Type your lyrics directly in any section. Or click the "Generate" button to use AI — describe the vibe you want and it will suggest lyrics you can edit and refine.', color: 'text-accent-warm', bg: 'bg-accent-warm/10' },
      { num: '04', icon: Disc, title: 'Add Chords', desc: 'Type chords (e.g. Am F G C) in the chords field of any section. Use the "Chord Helper" button for AI-suggested progressions based on your song key, genre, and mood.', color: 'text-accent-action', bg: 'bg-accent-action/10' },
      { num: '05', icon: Radio, title: 'Compose Melody', desc: 'Click "Open Piano Roll" in any section to create a melody visually. Click cells on the grid to place notes — rows are pitches (C3–C6), columns are time steps. You can also connect a MIDI keyboard and hit "Rec" to record in real-time.', color: 'text-purple-500', bg: 'bg-purple-400/10' },
      { num: '06', icon: Mic, title: 'Record Audio', desc: 'Each section has a record button. Record yourself singing or playing, then play it back. Add recordings to multiple sections and export them all as a single WAV file.', color: 'text-accent-warm', bg: 'bg-accent-warm/10' },
      { num: '07', icon: Share2, title: 'Export & Share', desc: 'When your song is ready, click "Share" to publish it. You can share the full song or a single section. Get an embed code to put it on any website, or export a mixed WAV of all recordings.', color: 'text-accent-action', bg: 'bg-accent-action/10' },
    ],
  },
  my: {
    headerTitle: 'သီချင်းရေးနည်းလမ်းညွှန်',
    headerSub: 'LocoVerse မှာ သီချင်းတစ်ပုဒ်ကို အစကနေအဆုံး ဘယ်လိုဖန်တီးမလဲဆိုတာကို ဒီအဆင့်လေးတွေအတိုင်း လေ့လာကြည့်လိုက်ရအောင်',
    gotIt: 'ရပါပြီ',
    toggleLabel: 'English',
    steps: [
      { num: '၀၁', icon: Music, title: 'Create a Song', desc: 'Creator Hub ထဲမှာ "New Song" ကိုနှိပ်ပြီး စတင်ပါ။ သီချင်းခေါင်းစဉ်ပေးပါ၊ BPM (အမြန်နှုန်း) နဲ့ Time Signature (စည်းချက်ပုံစံ) ကို သတ်မှတ်ပေးပါ။ ဒါတွေက သင့်သီချင်းအတွက် အခြေခံအုတ်မြစ်တွေ ဖြစ်ပါတယ်။', color: 'text-accent-action', bg: 'bg-accent-action/10' },
      { num: '၀၂', icon: FileText, title: 'Add Sections', desc: 'သီချင်းတစ်ပုဒ်မှာ Verse (အပိုဒ်)၊ Chorus (အဆိုပိုဒ်)၊ Bridge (တေးသွားပြောင်းသည့်ပိုဒ်) စတာတွေ ပါဝင်ပါတယ်။ "Add Section" ကိုနှိပ်ပြီး အပိုင်းအသစ်တွေ ထည့်ပါ၊ လိုသလို အစီအစဉ် ပြန်စီနိုင်ပါတယ်။ အပိုင်းတစ်ခုစီမှာ သူ့ရဲ့ သီးသန့်စာသား၊ Chord နဲ့ တေးသွား (Melody) တွေ ထည့်သွင်းနိုင်ပါတယ်။', color: 'text-purple-500', bg: 'bg-purple-400/10' },
      { num: '၀၃', icon: Sparkles, title: 'Write Lyrics + AI Help', desc: 'သီချင်းစာသားတွေကို စိတ်ကြိုက် ရေးသားနိုင်ပါတယ်။ (သို့) "Generate" ခလုတ်ကိုနှိပ်ပြီး AI ကို အသုံးပြုနိုင်ပါတယ်။ ကိုယ်လိုချင်တဲ့ ခံစားချက်ကို ပြောပြပေးလိုက်ရင် AI က သီချင်းစာသားတွေကို အကြံပြုပေးမှာဖြစ်ပြီး၊ ကိုယ်ကြိုက်သလို ပြန်ပြင်နိုင်ပါတယ်။', color: 'text-accent-warm', bg: 'bg-accent-warm/10' },
      { num: '၀၄', icon: Disc, title: 'Add Chords', desc: 'အပိုင်းတစ်ခုစီမှာ Chord တွေကို (ဥပမာ - Am, F, G, C) ကိုယ်တိုင် ရိုက်ထည့်နိုင်ပါတယ်။ "Chord Helper" ခလုတ်ကိုနှိပ်ပြီး သင့်သီချင်းရဲ့ Mood နဲ့ Genre အလိုက် အသင့်တော်ဆုံး Chord Progression တွေကို AI ကနေတစ်ဆင့် အကြံပြုချက် ရယူနိုင်ပါတယ်။', color: 'text-accent-action', bg: 'bg-accent-action/10' },
      { num: '၀၅', icon: Radio, title: 'Compose Melody', desc: 'အပိုင်းတိုင်းမှာ "Open Piano Roll" ကိုနှိပ်ပြီး တေးသွားတွေကို ပုံစံထုတ်နိုင်ပါတယ်။ Grid (ကွက်လပ်) ထဲမှာ Note တွေကို နှိပ်ပြီး နေရာချပေးရုံပါပဲ။ အတန်းတွေက အသံအမြင့် (Pitches) ကို ကိုယ်စားပြုပြီး၊ ကော်လံတွေကတော့ အချိန်ကာလကို ပြပါတယ်။ MIDI Keyboard ချိတ်ဆက်ပြီးလည်း အချိန်နဲ့တပြေးညီ တိုက်ရိုက် Record လုပ်နိုင်ပါတယ်။', color: 'text-purple-500', bg: 'bg-purple-400/10' },
      { num: '၀၆', icon: Mic, title: 'Record Audio', desc: 'အပိုင်းတစ်ခုစီတိုင်းမှာ "Record" ခလုတ် ပါရှိပါတယ်။ ကိုယ်တိုင်ဆိုတာ (သို့) တူရိယာတီးခတ်တာကို Record လုပ်ပြီး ပြန်နားထောင်နိုင်ပါတယ်။ အပိုင်းမျိုးစုံမှာ အသံတွေ သွင်းပြီးတဲ့အခါ သူတို့ကို ပေါင်းစပ်ပြီး WAV ဖိုင်တစ်ခုအနေနဲ့ ထုတ်ယူနိုင်ပါတယ်။', color: 'text-accent-warm', bg: 'bg-accent-warm/10' },
      { num: '၀၇', icon: Share2, title: 'Export & Share', desc: 'သီချင်းပြီးသွားပြီဆိုရင် "Share" ကိုနှိပ်ပြီး တင်လိုက်ပါ။ သီချင်းတစ်ပုဒ်လုံးကို ဖြစ်ဖြစ်၊ အပိုင်းတစ်ခုတည်းကိုပဲ ဖြစ်ဖြစ် မျှဝေနိုင်ပါတယ်။ Website တွေမှာ ထည့်သုံးဖို့ Embed Code ယူနိုင်သလို၊ ပေါင်းစပ်ထားတဲ့ (Mixed) WAV ဖိုင်ကိုလည်း Download ရယူနိုင်ပါတယ်။', color: 'text-accent-action', bg: 'bg-accent-action/10' },
    ],
  },
};

export default function SongwritingGuideModal({ onClose }: SongwritingGuideModalProps) {
  const [lang, setLang] = useState<Lang>('en');
  const c = content[lang];

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white border border-border w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em]">{c.headerTitle}</h2>
            <p className="text-[10px] font-mono text-text-secondary mt-0.5 leading-relaxed">{c.headerSub}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'en' ? 'my' : 'en')}
              className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider border border-border text-text-secondary hover:text-text-primary hover:border-text-primary transition-colors"
            >
              {c.toggleLabel}
            </button>
            <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {c.steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="flex gap-4 p-4 border border-border">
                <div className={`w-10 h-10 shrink-0 ${step.bg} flex items-center justify-center`}>
                  <Icon size={18} className={step.color} />
                </div>
                <div className="min-w-0">
                  <div className={`${step.color} font-mono font-bold text-[10px] mb-0.5 tracking-wider`}>{step.num}</div>
                  <h3 className="text-sm font-heading font-bold mb-1">{step.title}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="btn-primary !px-6 !min-h-[36px] !text-[10px]">{c.gotIt}</button>
        </div>
      </div>
    </div>
  );
}
