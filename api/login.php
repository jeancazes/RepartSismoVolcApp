<?php
require __DIR__ . '/../lib/http.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['error' => 'Méthode non autorisée'], 405);
}

$d = body();
$st = db()->prepare('SELECT id, login, name, password_hash FROM teachers WHERE login = ?');
$st->execute([trim((string)($d['login'] ?? ''))]);
$t = $st->fetch();

if (!$t || !password_verify((string)($d['password'] ?? ''), $t['password_hash'])) {
    usleep(400000); // ralentit les essais de mots de passe
    json_out(['error' => 'Identifiants incorrects'], 401);
}

session_regenerate_id(true);
unset($_SESSION['csrf']);
$_SESSION['teacher'] = ['id' => (int)$t['id'], 'login' => $t['login'], 'name' => $t['name']];
json_out(['ok' => true, 'teacher' => $_SESSION['teacher'], 'csrf' => csrf_token()]);
