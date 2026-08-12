ALTER TABLE admiranext_users ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_admiranext_users_google_sub ON admiranext_users(google_sub) WHERE google_sub IS NOT NULL;
