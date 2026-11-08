<?php
// Modèle de configuration. Sur EX2, copier ce fichier en « config.php » et remplir les valeurs.
// config.php n'est jamais versionné sur GitHub (voir .gitignore).
return [
    'session_name' => 'carte_admin',
    'db' => [
        'host' => 'localhost',
        'name' => 'NOM_DE_LA_BASE',
        'user' => 'UTILISATEUR_BASE',
        'pass' => 'MOT_DE_PASSE_BASE',
        'charset' => 'utf8mb4',
    ],
    'ai' => [
        'provider' => 'none',            // 'mistral' | 'gemini' | 'none'
        'paused' => false,               // true = pause des corrections IA
        'mistral_key' => '',
        'mistral_model' => 'mistral-small-latest',
        'gemini_key' => '',
        'gemini_model' => 'gemini-2.0-flash',
    ],
];
