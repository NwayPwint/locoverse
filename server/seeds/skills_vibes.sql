-- LocoVerse Seed Data

-- Skills
INSERT INTO skills (name, category) VALUES
  -- Instruments
  ('Guitar', 'instrument'),
  ('Bass', 'instrument'),
  ('Drums', 'instrument'),
  ('Piano', 'instrument'),
  ('Keyboard', 'instrument'),
  ('Violin', 'instrument'),
  ('Saxophone', 'instrument'),
  ('Trumpet', 'instrument'),
  ('Flute', 'instrument'),
  ('Ukulele', 'instrument'),
  
  -- Vocal
  ('Vocals', 'vocal'),
  ('Rapping', 'vocal'),
  ('Beatboxing', 'vocal'),
  ('Choir', 'vocal'),
  
  -- Production
  ('Production', 'production'),
  ('Mixing', 'production'),
  ('Mastering', 'production'),
  ('Sound Design', 'production'),
  ('Recording', 'production'),
  
  -- Theory
  ('Songwriting', 'theory'),
  ('Lyrics', 'theory'),
  ('Composition', 'theory'),
  ('Music Theory', 'theory'),
  ('Arrangement', 'theory')
ON CONFLICT (name) DO NOTHING;

-- Vibes
INSERT INTO vibes (name) VALUES
  ('Chill'),
  ('Energetic'),
  ('Experimental'),
  ('Nostalgic'),
  ('Dark'),
  ('Melodic'),
  ('Aggressive'),
  ('Dreamy'),
  ('Funky'),
  ('Soulful'),
  ('Ambient'),
  ('Lo-fi'),
  ('Jazzy'),
  ('Electronic'),
  ('Acoustic'),
  ('Raw'),
  ('Polished'),
  ('Raw'),
  ('Vintage'),
  ('Futuristic')
ON CONFLICT (name) DO NOTHING;
