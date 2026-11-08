# Carte Volcans Séismes Plaques (EX2 / PHP)

Application SVT 4e : carte interactive (séismes, volcans, plaques) et scénarios guidés.

## Structure

- `index.html` : app élève (build du prototype, données dans `data/`).
- `admin.php` : espace enseignant (connexion, scénarios sur le serveur).
- `api/` : `login.php`, `logout.php`, `scenarios.php` (enseignant), `scenarios_public.php` (élève, code de séance), `grade.php` (correction IA).
- `lib/` : connexion MySQL et helpers (protégé par `.htaccess`).
- `db/schema.sql` : tables MySQL.
- `tools/create_teacher.php` : création des comptes enseignants (ligne de commande uniquement).
- `config.example.php` : modèle de configuration.

## Mise en place sur EX2 (une seule fois)

1. Dans phpMyAdmin, créer la base et exécuter `db/schema.sql`.
2. Copier `config.example.php` en `config.php` sur le serveur et remplir les accès MySQL et les clés IA.
3. Créer les comptes : `php tools/create_teacher.php prof1 "Prénom Nom" "mot de passe de 12 caractères"`.
4. Ajouter dans GitHub (Settings > Secrets > Actions) : `EX2_HOST`, `EX2_PORT`, `EX2_USER`, `EX2_PATH` (dossier web), `EX2_SSH_KEY` (clé privée SSH autorisée sur EX2).

## Déploiement

Chaque `push` sur `main` lance `.github/workflows/deploy.yml` et envoie les fichiers sur EX2.
`config.php` n'est jamais écrasé.

## Limites connues (prototype)

- Les réponses des élèves restent dans le navigateur (pas de base élève).
- Les scénarios contiennent encore les bonnes réponses côté élève : à revoir avant une utilisation large.
- Pas encore de limitation de débit sur le code de séance.

<!-- Test de déploiement -->
