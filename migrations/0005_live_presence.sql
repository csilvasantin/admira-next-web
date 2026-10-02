CREATE TABLE IF NOT EXISTS admiranext_presence (
  host TEXT NOT NULL,
  sid TEXT NOT NULL,
  page_id TEXT NOT NULL,
  path TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  started_at INTEGER NOT NULL,
  seen_at INTEGER NOT NULL,
  PRIMARY KEY(host,sid,page_id)
);
CREATE INDEX IF NOT EXISTS idx_admiranext_presence_seen ON admiranext_presence(seen_at);
