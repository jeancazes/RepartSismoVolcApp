<?php
require __DIR__ . '/../lib/http.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['error' => 'Méthode non autorisée'], 405);
}

$d = body();
$st = db()->prepare('SELECT id, login, name, password_hash, verified_at FROM teachers WHERE login = ?');
$st->execute([mb_strtolower(trim((string)($d['login'] ?? '')), 'UTF-8')]);
$t = $st->fetch();

if (!$t || !password_verify((string)($d['password'] ?? ''), $t['password_hash'])) {
    usleep(400000); // ralentit les essais de mots de passe
    json_out(['error' => 'Identifiants incorrects'], 401);
}
if ($t['verified_at'] === null) {
    json_out(['error' => 'Compte non confirmé : clique sur le lien reçu par mail.'], 403);
}

session_regenerate_id(true);
unset($_SESSION['csrf']);
$_SESSION['teacher'] = ['id' => (int)$t['id'], 'login' => $t['login'], 'name' => $t['name']];
json_out(['ok' => true, 'teacher' => $_SESSION['teacher'], 'csrf' => csrf_token()]);
