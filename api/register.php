<?php
// Inscription d'un enseignant : crée un compte non confirmé et envoie un lien par mail (valable 1 heure).
require __DIR__ . '/../lib/http.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['error' => 'Méthode non autorisée'], 405);
}
csrf_check();

$d = body();
$login = mb_strtolower(trim((string)($d['login'] ?? '')), 'UTF-8');
$name = mb_substr(trim((string)($d['name'] ?? '')), 0, 120);
$pass = (string)($d['password'] ?? '');

// Adresse académique obligatoire : prenom.nom@ac-academie.fr
if (strlen($login) > 60 || !preg_match('/^[a-z]+(-[a-z]+)*\.[a-z]+(-[a-z]+)*@ac-[a-z]+(-[a-z]+)*\.fr$/', $login)) {
    json_out(['error' => "L'adresse doit être de la forme prenom.nom@ac-academie.fr"], 422);
}
if ($name === '') {
    json_out(['error' => 'Le nom affiché est obligatoire'], 422);
}
if (mb_strlen($pass) < 12) {
    json_out(['error' => 'Mot de passe : 12 caractères minimum'], 422);
}

$msg = 'Si cette adresse est valide, un mail de confirmation vient d\'être envoyé (lien valable 1 heure).';
$pdo = db();
$st = $pdo->prepare('SELECT id, verified_at FROM teachers WHERE login = ?');
$st->execute([$login]);
$row = $st->fetch();

// Compte déjà confirmé : on répond la même chose pour ne pas révéler qui a un compte.
if ($row && $row['verified_at'] !== null) {
    json_out(['ok' => true, 'message' => $msg]);
}

$token = bin2hex(random_bytes(32));
$hash = hash('sha256', $token);
$passHash = password_hash($pass, PASSWORD_DEFAULT);

if ($row) {
    $st = $pdo->prepare('UPDATE teachers SET name = ?, password_hash = ?, verify_token = ?, verify_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?');
    $st->execute([$name, $passHash, $hash, $row['id']]);
} else {
    $st = $pdo->prepare('INSERT INTO teachers (login, name, password_hash, verify_token, verify_expires) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))');
    $st->execute([$login, $name, $passHash, $hash]);
}

$cfg = config();
$link = rtrim($cfg['base_url'], '/') . '/verify.php?t=' . $token;
$body = "Bonjour {$name},\n\nPour activer ton compte enseignant de la carte Volcans Séismes Plaques, clique sur ce lien (valable 1 heure) :\n{$link}\n\nSi tu n'es pas à l'origine de cette demande, ignore ce mail.";
$headers = "From: {$cfg['mail_from']}\r\nContent-Type: text/plain; charset=UTF-8\r\n";

if (!mail($login, '=?UTF-8?B?' . base64_encode('Confirme ton compte enseignant') . '?=', $body, $headers)) {
    json_out(['error' => "Envoi du mail impossible. Réessaie plus tard ou préviens l'administrateur."], 500);
}
json_out(['ok' => true, 'message' => $msg]);
