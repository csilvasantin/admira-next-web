-- FLT-100644: terceros (guest|partner) con apps contratadas y caducidad.
-- role sigue admin/editor/viewer; account_kind distingue equipo vs tercero.
-- OWNERS no se degradan desde la API.

ALTER TABLE admiranext_users ADD COLUMN account_kind TEXT NOT NULL DEFAULT 'team';
ALTER TABLE admiranext_users ADD COLUMN expires_at INTEGER;

CREATE TABLE IF NOT EXISTS admiranext_user_apps (
  user_email TEXT NOT NULL,
  app_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  PRIMARY KEY(user_email, app_key),
  FOREIGN KEY(user_email) REFERENCES admiranext_users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admiranext_user_apps_email
  ON admiranext_user_apps(user_email);
