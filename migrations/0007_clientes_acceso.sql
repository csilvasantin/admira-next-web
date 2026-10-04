-- Carlos, 2026-10-04: Starbucks, Altadis y Admira usan las cinco patas.
-- Tabla aparte: admiranext_commercial_projects sigue con cinco columnas
-- porque ensureRegistry inserta con VALUES posicional.
CREATE TABLE IF NOT EXISTS admiranext_clientes_acceso (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  patas TEXT NOT NULL,
  es_global INTEGER NOT NULL,
  origen TEXT NOT NULL,
  por_defecto INTEGER NOT NULL DEFAULT 0
);

INSERT INTO admiranext_clientes_acceso (id, nombre, patas, es_global, origen, por_defecto) VALUES
  ('starbucks', 'Starbucks', '["studio","store","tv","app","biz"]', 1, 'carlos-2026-10-04', 0),
  ('altadis', 'Altadis', '["studio","store","tv","app","biz"]', 1, 'carlos-2026-10-04', 0),
  ('admira', 'Admira', '["studio","store","tv","app","biz"]', 1, 'carlos-2026-10-04', 1)
ON CONFLICT(id) DO UPDATE SET
  nombre = excluded.nombre,
  patas = excluded.patas,
  es_global = excluded.es_global,
  origen = excluded.origen,
  por_defecto = excluded.por_defecto;
