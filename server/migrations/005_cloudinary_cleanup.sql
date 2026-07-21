-- Cloudinary public_id storage for cleanup on delete

ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_public_id TEXT;
