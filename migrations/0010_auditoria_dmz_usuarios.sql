-- Zona DMZ de /usuarios (19-10-2026): la auditoría guarda también desde qué IP y con qué
-- navegador se hizo cada cambio. asegurarDirectorio() aplica lo mismo en caliente
-- (ALTER TABLE idempotente con try/catch); este fichero lo deja documentado.
ALTER TABLE admiranext_user_audit ADD COLUMN ip TEXT;
ALTER TABLE admiranext_user_audit ADD COLUMN user_agent TEXT;
