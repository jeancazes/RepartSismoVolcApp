<?php
// Création d'un compte enseignant déjà confirmé, en ligne de commande sur le serveur uniquement.
// Usage : php tools/create_teacher.php prenom.nom@ac-academie.fr "Nom affiché" "mot de passe (12 caractères min.)"
if (PHP_SAPI !== 'cli') {
    exit("Interdit hors ligne de commande.\n");
}
require __DIR__ . '/../lib/db.php';

$usage = "Usage : php tools/create_teacher.php prenom.nom@ac-academie.fr \"Nom affiché\" \"mot de passe (12 caractères min.)\"\n";
[$script, $login, $name, $pass] = array_pad($argv, 4, null);
$login = mb_strtolower(trim((string)$login), 'UTF-8');

if (!$login || !$name || !$pass) {
    exit($usage);
}
if (!preg_match('/^[a-z]+(-[a-z]+)*\.[a-z]+(-[a-z]+)*@ac-[a-z]+(-[a-z]+)*\.fr$/', $login)) {
    exit("Adresse refusée : elle doit être de la forme prenom.nom@ac-academie.fr\n");
}
if (mb_strlen($pass) < 12) {
    exit("Mot de passe refusé : 12 caractères minimum.\n");
}

try {
    $st = db()->prepare('INSERT INTO teachers (login, name, password_hash, verified_at) VALUES (?, ?, ?, NOW())');
    $st->execute([$login, $name, password_hash($pass, PASSWORD_DEFAULT)]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        exit("Ce compte existe déjà : {$login}\n");
    }
    if (str_contains($e->getMessage(), 'verified_at')) {
        exit("La base n'est pas à jour : exécute db/migration_verification.sql dans phpMyAdmin.\n");
    }
    exit('Erreur base de données : ' . $e->getMessage() . "\n");
}
echo "Compte « {$login} » créé et confirmé.\n";
