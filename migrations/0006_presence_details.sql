ALTER TABLE admiranext_presence ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE admiranext_presence ADD COLUMN region TEXT NOT NULL DEFAULT '';
ALTER TABLE admiranext_presence ADD COLUMN latitude REAL;
ALTER TABLE admiranext_presence ADD COLUMN longitude REAL;
ALTER TABLE admiranext_presence ADD COLUMN browser TEXT NOT NULL DEFAULT '';
ALTER TABLE admiranext_presence ADD COLUMN os TEXT NOT NULL DEFAULT '';
ALTER TABLE admiranext_presence ADD COLUMN referrer TEXT NOT NULL DEFAULT '';
