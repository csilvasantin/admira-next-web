CREATE TABLE IF NOT EXISTS demos (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  site TEXT,
  status TEXT NOT NULL,
  version INTEGER NOT NULL,
  doc TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS demo_versions (
  id TEXT NOT NULL,
  version INTEGER NOT NULL,
  doc TEXT NOT NULL,
  saved_at INTEGER NOT NULL,
  saved_by TEXT,
  PRIMARY KEY (id, version)
);
