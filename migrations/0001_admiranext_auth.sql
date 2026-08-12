CREATE TABLE IF NOT EXISTS admiranext_users (
  email TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER,
  last_login_ip TEXT,
  last_login_ua TEXT
);

CREATE TABLE IF NOT EXISTS admiranext_user_audit (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  target_email TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admiranext_user_audit_created
  ON admiranext_user_audit(created_at DESC);

INSERT INTO admiranext_users(email,display_name,role,status,session_version,created_at,updated_at)
VALUES
 ('csilva@admira.com','Carlos · Admira','admin','active',1,unixepoch('now')*1000,unixepoch('now')*1000),
 ('csilvasantin@gmail.com','Carlos · Recuperación','admin','active',1,unixepoch('now')*1000,unixepoch('now')*1000)
ON CONFLICT(email) DO NOTHING;
