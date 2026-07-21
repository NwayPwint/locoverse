'use client';

import { useState, useEffect, useRef } from 'react';

interface MidiNoteEvent {
  midi: number;
  velocity: number;
}

interface MidiState {
  connected: boolean;
  deviceName: string | null;
  lastNote: MidiNoteEvent | null;
}

export function useMidiInput(onNote?: (note: MidiNoteEvent) => void): MidiState {
  const [state, setState] = useState<MidiState>({ connected: false, deviceName: null, lastNote: null });
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;

  useEffect(() => {
    let midiAccess: MIDIAccess | null = null;

    function onMidiMessage(event: MIDIMessageEvent) {
      if (!event.data || event.data.length < 3) return;
      const status = event.data[0];
      const note = event.data[1];
      const velocity = event.data[2];
      const isNoteOn = (status & 0xf0) === 0x90 && velocity > 0;
      if (!isNoteOn) return;
      const ev = { midi: note, velocity };
      setState(prev => ({ ...prev, lastNote: ev }));
      onNoteRef.current?.(ev);
    }

    function onStateChange() {
      if (!midiAccess) return;
      const inputs = Array.from(midiAccess.inputs.values());
      const connected = inputs.some(i => i.state === 'connected');
      const name = inputs.find(i => i.state === 'connected')?.name || null;
      setState(prev => ({ ...prev, connected, deviceName: name }));
    }

    async function init() {
      if (!navigator.requestMIDIAccess) return;
      try {
        midiAccess = await navigator.requestMIDIAccess();
        for (const input of midiAccess.inputs.values()) {
          input.onmidimessage = onMidiMessage;
        }
        midiAccess.onstatechange = onStateChange;
        onStateChange();
      } catch {
        // MIDI not available
      }
    }

    init();

    return () => {
      if (midiAccess) {
        for (const input of midiAccess.inputs.values()) {
          input.onmidimessage = null;
        }
        midiAccess.onstatechange = null;
      }
    };
  }, []);

  return state;
}
