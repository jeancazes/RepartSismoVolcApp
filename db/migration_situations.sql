-- Bibliothèque de situations réutilisables (boutons de carte). À exécuter une fois dans phpMyAdmin.
CREATE TABLE IF NOT EXISTS situations (
  id VARCHAR(40) PRIMARY KEY,
  teacher_id INT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL,
  data JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
