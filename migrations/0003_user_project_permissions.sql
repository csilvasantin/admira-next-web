CREATE TABLE IF NOT EXISTS admiranext_user_projects (
  user_email TEXT NOT NULL,
  project_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  PRIMARY KEY(user_email,project_key),
  FOREIGN KEY(user_email) REFERENCES admiranext_users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admiranext_user_projects_email
  ON admiranext_user_projects(user_email);

INSERT INTO admiranext_user_projects(user_email,project_key,created_at,created_by)
SELECT email,'*',unixepoch('now')*1000,'migration-0003'
FROM admiranext_users
WHERE role='admin'
ON CONFLICT(user_email,project_key) DO NOTHING;
