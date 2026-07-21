-- Message attachments

ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(50);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);
