-- À exécuter une seule fois sur une base existante (phpMyAdmin).
ALTER TABLE teachers
  ADD COLUMN verified_at DATETIME NULL,
  ADD COLUMN verify_token CHAR(64) NULL,
  ADD COLUMN verify_expires DATETIME NULL;
-- Les comptes déjà créés sont considérés comme confirmés.
UPDATE teachers SET verified_at = NOW() WHERE verified_at IS NULL;
