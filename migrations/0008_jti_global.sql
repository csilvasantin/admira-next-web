-- Carlos, 2026-10-04 (20:39): JTI pasa a proyecto global con las cinco patas.
-- JTI ya existía en admiranext_commercial_projects como «JTI Xtanco» (provisional):
-- se sube a global en la tabla de acceso, sin duplicar el cliente.
INSERT INTO admiranext_clientes_acceso (id, nombre, patas, es_global, origen, por_defecto) VALUES
  ('jti', 'JTI Xtanco', '["studio","store","tv","app","biz"]', 1, 'carlos-2026-10-04', 0)
ON CONFLICT(id) DO UPDATE SET
  nombre = excluded.nombre,
  patas = excluded.patas,
  es_global = excluded.es_global,
  origen = excluded.origen,
  por_defecto = excluded.por_defecto;
