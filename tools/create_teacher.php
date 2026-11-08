<?php
// Création d'un compte enseignant, en ligne de commande sur le serveur uniquement.
// Usage : php tools/create_teacher.php identifiant "Nom affiché" "mot de passe (12 caractères min.)"
if (PHP_SAPI !== 'cli') {
    exit("Interdit hors ligne de commande.\n");
}
require __DIR__ . '/../lib/db.php';

[$script, $login, $name, $pass] = array_pad($argv, 4, null);
if (!$login || !$name || !$pass || mb_strlen($pass) < 12 || !preg_match('/^[a-z]+(-[a-z]+)*\.[a-z]+(-[a-z]+)*@ac-[a-z]+(-[a-z]+)*\.fr$/i', $login)) {
    exit("Usage : php tools/create_teacher.php identifiant \"Nom\" \"mot de passe (12 caractères min.)\"\n");
}

$st = db()->prepare('INSERT INTO teachers (login, name, password_hash) VALUES (?, ?, ?)');
$st->execute([$login, $name, password_hash($pass, PASSWORD_DEFAULT)]);
echo "Compte « {$login} » créé.\n";
