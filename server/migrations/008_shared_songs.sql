CREATE TABLE IF NOT EXISTS shared_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  composition_id UUID REFERENCES compositions(id),
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled',
  description TEXT DEFAULT '',
  lyrics TEXT DEFAULT '',
  structure JSONB NOT NULL DEFAULT '[]',
  audio_url TEXT,
  visibility VARCHAR(24) NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shared_songs_public_idx ON shared_songs (visibility, created_at DESC);
