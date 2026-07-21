ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_title VARCHAR(255);

ALTER TABLE compositions DROP CONSTRAINT IF EXISTS compositions_user_id_fkey,
  ADD CONSTRAINT compositions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE shared_songs DROP CONSTRAINT IF EXISTS shared_songs_user_id_fkey,
  ADD CONSTRAINT shared_songs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE shared_songs DROP CONSTRAINT IF EXISTS shared_songs_composition_id_fkey,
  ADD CONSTRAINT shared_songs_composition_id_fkey FOREIGN KEY (composition_id) REFERENCES compositions(id) ON DELETE CASCADE;

ALTER TABLE composition_collaborators DROP CONSTRAINT IF EXISTS composition_collaborators_invited_by_fkey,
  ADD CONSTRAINT composition_collaborators_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE;
